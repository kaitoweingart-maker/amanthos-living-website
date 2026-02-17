"""
Amanthos Living — Website API Server
Handles: Apaleo availability/booking, AI Chat (Claude), Property info
"""

import http.server
import json
import os
import ssl
import time
import uuid
import urllib.request
import urllib.parse
import urllib.error
import mimetypes
from http.server import HTTPServer
from datetime import datetime, timedelta
import debitoren_logic

# Debitoren frontend static files directory (relative to repo root)
DEBITOREN_FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'debitoren-dashboard', 'frontend')

# SSL context
ssl_ctx = ssl.create_default_context()
try:
    import certifi
    ssl_ctx.load_verify_locations(certifi.where())
except ImportError:
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

PORT = int(os.environ.get('PORT', 3002))

# Apaleo Config
APALEO_TOKEN_URL = 'https://identity.apaleo.com/connect/token'
APALEO_API_BASE = 'https://api.apaleo.com'
CLIENT_ID = os.environ.get('APALEO_CLIENT_ID', 'RFUO-SP-GRUPPENBUCHUNG')
CLIENT_SECRET = os.environ.get('APALEO_CLIENT_SECRET', '')

# Anthropic Config
ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY', '')
ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

# Allowed properties
PROPERTIES = {
    'GBAL': {
        'name': 'Amanthos Living Zurich Airport',
        'city': 'Glattbrugg (Opfikon)',
        'address': 'Oberhauserstrasse 30, 8152 Glattbrugg',
        'description': 'Business suites with perfect connections to the city and airport.',
        'lat': 47.4325, 'lng': 8.5647,
        'amenities': ['Free Wi-Fi', 'Fully Equipped Kitchen', 'Smart TV', 'Air Conditioning', 'Desk Workspace', 'Digital Check-in', 'Private Parking', 'Lift Access'],
        'rating': 4.4, 'reviews': 99,
    },
    'GNBE': {
        'name': 'Amanthos Living Solothurn',
        'city': 'Grenchen',
        'address': 'Bettlachstrasse 20, 2540 Grenchen',
        'description': 'Spacious serviced apartments in the heart of the watchmaking region.',
        'lat': 47.1942, 'lng': 7.3956,
        'amenities': ['Free Wi-Fi', 'Fully Equipped Kitchen', 'Smart TV', 'On-Site Parking', 'Digital Check-in', 'Lift Access', 'Work-Friendly Spaces'],
        'rating': 4.0, 'reviews': 9,
    },
    'NYAL': {
        'name': 'Amanthos Living Nyon',
        'city': 'Duillier',
        'address': 'Rue du Château 11, 1266 Duillier',
        'description': 'Modern apartments with stunning Lake Geneva and Alps views.',
        'lat': 46.3865, 'lng': 6.2291,
        'amenities': ['Free Wi-Fi', 'Lake Views', 'Kitchenette', 'Smart TV', 'Parking Available', 'Digital Check-in', 'Historic Building'],
        'rating': 4.3, 'reviews': 50,
    },
}

# Rate plan patterns to exclude (OTA and B2B)
EXCLUDED_RATE_PATTERNS = ['ota', 'b2b', 'agency', 'wholesale', 'expedia', 'booking.com']

# CORS allowed origins
ALLOWED_ORIGINS = [
    'https://amanthosliving.com',
    'https://www.amanthosliving.com',
    'https://kaitoweingart-maker.github.io',
    'http://localhost:8080',
    'http://localhost:8000',
    'http://localhost:5500',
    'http://localhost:3000',
    'http://localhost:3002',
    'http://127.0.0.1:8080',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:3002',
]

# Token cache
_token_cache = {'token': None, 'expires': 0}

# Chat session store (in-memory)
_chat_sessions = {}
CHAT_SESSION_TTL = 1800  # 30 minutes
CHAT_MAX_MESSAGES = 20

# Rate limiting for public APIs (booking, chat, payment-link)
import threading
_rate_limits = {}  # {ip: [timestamp, ...]}
_rate_lock = threading.Lock()
RATE_LIMIT_WINDOW = 60   # 1 minute window
RATE_LIMIT_MAX = {
    'booking': 5,         # max 5 bookings per minute per IP
    'chat': 20,           # max 20 chat messages per minute per IP
    'payment_link': 10,   # max 10 payment link requests per minute per IP
}

def check_rate_limit(ip, action='booking'):
    """Returns True if the request should be allowed, False if rate-limited."""
    key = f'{ip}:{action}'
    now = time.time()
    max_req = RATE_LIMIT_MAX.get(action, 10)
    with _rate_lock:
        timestamps = _rate_limits.get(key, [])
        timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
        if len(timestamps) >= max_req:
            _rate_limits[key] = timestamps
            return False
        timestamps.append(now)
        _rate_limits[key] = timestamps
        return True

# Pending bookings tracker (in-memory, persisted to file for cron job)
PENDING_BOOKINGS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'pending_bookings.json')

def load_pending_bookings():
    """Load pending bookings from file."""
    try:
        if os.path.exists(PENDING_BOOKINGS_FILE):
            with open(PENDING_BOOKINGS_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f'Error loading pending bookings: {e}')
    return []

def save_pending_bookings(bookings):
    """Save pending bookings to file."""
    try:
        with open(PENDING_BOOKINGS_FILE, 'w') as f:
            json.dump(bookings, f, indent=2)
    except Exception as e:
        print(f'Error saving pending bookings: {e}')

def add_pending_booking(booking_id, reservation_id, property_id, email, first_name, last_name, payment_link, amount, currency):
    """Track a new booking that needs payment."""
    bookings = load_pending_bookings()
    bookings.append({
        'bookingId': booking_id,
        'reservationId': reservation_id,
        'propertyId': property_id,
        'email': email,
        'firstName': first_name,
        'lastName': last_name,
        'paymentLink': payment_link,
        'amount': amount,
        'currency': currency,
        'createdAt': datetime.utcnow().isoformat() + 'Z',
        'reminderSent': False,
        'reminderSentAt': None,
        'warningSent': False,
        'warningSentAt': None,
        'status': 'pending_payment',
    })
    save_pending_bookings(bookings)

# ============================================================
# Apaleo Helpers
# ============================================================

def get_apaleo_token():
    if _token_cache['token'] and time.time() < _token_cache['expires']:
        return _token_cache['token']
    data = urllib.parse.urlencode({
        'grant_type': 'client_credentials',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
    }).encode()
    req = urllib.request.Request(APALEO_TOKEN_URL, data=data, headers={
        'Content-Type': 'application/x-www-form-urlencoded',
    })
    with urllib.request.urlopen(req, context=ssl_ctx) as resp:
        result = json.loads(resp.read())
        _token_cache['token'] = result['access_token']
        _token_cache['expires'] = time.time() + result.get('expires_in', 3600) - 60
        return _token_cache['token']


def apaleo_api_call(method, path, body=None):
    token = get_apaleo_token()
    url = f'{APALEO_API_BASE}{path}'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ssl_ctx, timeout=30) as resp:
            response_body = resp.read()
            result = {}
            if response_body:
                try:
                    result = json.loads(response_body)
                except json.JSONDecodeError:
                    pass
            location = resp.headers.get('Location', '')
            return {'status': resp.status, 'data': result, 'location': location}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode()
        return {'status': e.code, 'error': error_body}


# Initialize debitoren module with shared apaleo function
debitoren_logic.init(apaleo_api_call, ssl_ctx)


def filter_offers(offers_data):
    """Filter Apaleo offers: only Refundable and Non-Refundable, no OTA/B2B."""
    filtered = []
    for offer in offers_data.get('offers', []):
        rate_plan = offer.get('ratePlan', {})
        rate_code = (rate_plan.get('code', '') or '').lower()
        rate_name = (rate_plan.get('name', '') or '').lower()

        # Skip OTA and B2B rate plans
        skip = False
        for pattern in EXCLUDED_RATE_PATTERNS:
            if pattern in rate_code or pattern in rate_name:
                skip = True
                break
        if skip:
            continue

        # Categorize
        cancellation = offer.get('cancellationFee', {})
        cancel_code = (cancellation.get('code', '') or '').lower()
        if 'nonref' in rate_code or 'non-ref' in rate_code or cancel_code == 'nonrefundable':
            category = 'Non-Refundable'
        else:
            category = 'Refundable'

        # Extract pricing
        total = offer.get('totalGrossAmount', {})
        nights = offer.get('timeSlices', [])
        avg_per_night = None
        if nights and len(nights) > 0:
            avg_per_night = {
                'amount': round(total.get('amount', 0) / len(nights), 2),
                'currency': total.get('currency', 'CHF'),
            }

        filtered.append({
            'ratePlanId': rate_plan.get('id', ''),
            'ratePlanCode': rate_plan.get('code', ''),
            'ratePlanName': rate_plan.get('name', ''),
            'category': category,
            'unitGroupId': offer.get('unitGroup', {}).get('id', ''),
            'unitGroupName': offer.get('unitGroup', {}).get('name', ''),
            'unitGroupDescription': offer.get('unitGroup', {}).get('description', ''),
            'availableUnits': offer.get('availableUnits', 0),
            'totalGrossAmount': total,
            'averagePerNight': avg_per_night,
            'cancellationFee': cancellation,
            'cityTax': offer.get('cityTax', {}),
            'timeSlices': [{'from': ts.get('from', ''), 'to': ts.get('to', ''), 'amount': ts.get('totalGrossAmount', {})} for ts in nights],
        })

    return filtered


def create_payment_link(reservation_id, property_id, payer_email, booking_id=None, amount=None, currency='CHF'):
    """Create an Apaleo Pay payment link that shows the actual amount.

    Uses the folio payments/by-link endpoint which displays the booking amount
    on the Adyen payment page. Flow:
    1. Find the folio for the reservation
    2. POST /finance/v1/folios/{folioId}/payments/by-link with amount
    3. GET the payment to retrieve the Adyen URL
    Falls back to payment-accounts/by-link if folio approach fails.
    Expiry: 3 days (72 hours).
    """
    expires_at = (datetime.utcnow() + timedelta(days=3)).strftime('%Y-%m-%dT%H:%M:%SZ')

    if not reservation_id and not booking_id:
        print('ERROR: No reservation_id or booking_id provided for payment link')
        return None

    label = f'reservation {reservation_id}' if reservation_id else f'booking {booking_id}'

    # --- Primary: Folio payment by link (shows amount on Adyen page) ---
    folio_id = None
    if reservation_id:
        print(f'Finding folio for {label}...')
        folio_result = apaleo_api_call('GET', f'/finance/v1/folios?reservationIds={reservation_id}')
        if 'error' not in folio_result:
            folios = folio_result.get('data', {}).get('folios', [])
            # Pick the main/open folio
            for f in folios:
                if f.get('isMainFolio') and f.get('status') == 'Open':
                    folio_id = f.get('id')
                    break
            if not folio_id and folios:
                folio_id = folios[0].get('id')
            print(f'Found folio: {folio_id}' if folio_id else f'No folio found (folios={len(folios)})')
        else:
            print(f'Folio lookup failed: {folio_result.get("error", "")[:200]}')

    if folio_id:
        # Determine the amount: use provided amount, or get from folio balance
        pay_amount = amount
        pay_currency = currency or 'CHF'

        if not pay_amount or pay_amount <= 0:
            # Try to get amount from folio balance (negative balance = guest owes)
            folio_detail = apaleo_api_call('GET', f'/finance/v1/folios/{folio_id}')
            if 'error' not in folio_detail:
                balance = folio_detail.get('data', {}).get('balance', {})
                bal_amount = balance.get('amount', 0)
                if bal_amount < 0:
                    pay_amount = abs(bal_amount)
                    pay_currency = balance.get('currency', 'CHF')
                    print(f'Got amount from folio balance: {pay_amount} {pay_currency}')

        if pay_amount and pay_amount > 0:
            payment_payload = {
                'amount': {
                    'amount': round(pay_amount, 2),
                    'currency': pay_currency,
                },
                'expiresAt': expires_at,
                'countryCode': 'CH',
                'description': 'Payment for your stay at Amanthos Living',
                'payerEmail': payer_email,
            }
            print(f'Creating FOLIO PAYMENT link for {label}, folio={folio_id}, amount={pay_amount} {pay_currency}')
            result = apaleo_api_call('POST', f'/finance/v1/folios/{folio_id}/payments/by-link', payment_payload)
            print(f'Folio payment result: status={result.get("status")}, has_error={"error" in result}')

            if 'error' not in result:
                payment_id = result.get('data', {}).get('id', '')
                payment_link_url = ''

                if payment_id:
                    # Fetch payment to get the Adyen URL
                    print(f'Fetching payment {payment_id} for URL...')
                    time.sleep(1)
                    get_result = apaleo_api_call('GET', f'/finance/v1/folios/{folio_id}/payments/{payment_id}')
                    if 'error' not in get_result:
                        pay_data = get_result.get('data', {})
                        payment_link_url = pay_data.get('url', '')
                        print(f'Payment GET: status={pay_data.get("status")}, url={payment_link_url[:80] if payment_link_url else "EMPTY"}')

                        if not payment_link_url:
                            print('URL empty, retrying after 2s...')
                            time.sleep(2)
                            get_result2 = apaleo_api_call('GET', f'/finance/v1/folios/{folio_id}/payments/{payment_id}')
                            if 'error' not in get_result2:
                                pay_data2 = get_result2.get('data', {})
                                payment_link_url = pay_data2.get('url', '')
                                print(f'Retry GET: url={payment_link_url[:80] if payment_link_url else "STILL EMPTY"}')

                if payment_link_url:
                    print(f'Folio payment link URL: {payment_link_url[:80]}')
                    return {
                        'url': payment_link_url,
                        'expiresAt': expires_at,
                        'status': 'Pending',
                    }
            else:
                error_msg = result.get('error', '')
                print(f'Folio payment link failed: {str(error_msg)[:300]}')

                # Check if there's already a pending payment link
                if 'pending' in str(error_msg).lower() or 'already' in str(error_msg).lower():
                    print(f'Checking for existing pending payment on folio {folio_id}...')
                    payments_result = apaleo_api_call('GET', f'/finance/v1/folios/{folio_id}/payments')
                    if 'error' not in payments_result:
                        payments = payments_result.get('data', {}).get('payments', [])
                        for p in payments:
                            if p.get('status') == 'Pending' and p.get('type') == 'PaymentLink' and p.get('url'):
                                print(f'Found existing payment link: {p["url"][:80]}')
                                return {
                                    'url': p['url'],
                                    'expiresAt': p.get('expiresAt', expires_at),
                                    'status': 'Pending',
                                }

    # --- Fallback: payment-accounts/by-link (card-on-file, no amount shown) ---
    print(f'Falling back to payment-accounts/by-link for {label} (no amount will be shown)')
    if reservation_id:
        target = {'type': 'Reservation', 'id': reservation_id}
    elif booking_id:
        target = {'type': 'Booking', 'id': booking_id}
    else:
        return None

    pa_payload = {
        'target': target,
        'propertyId': property_id,
        'expiresAt': expires_at,
        'countryCode': 'CH',
        'description': 'Payment for your stay at Amanthos Living',
        'payerEmail': payer_email,
    }

    result = apaleo_api_call('POST', '/booking/v1/payment-accounts/by-link', pa_payload)
    print(f'Payment account result: status={result.get("status")}, has_error={"error" in result}')

    if 'error' in result:
        error_msg = result.get('error', '')
        print(f'Payment account error: {error_msg}')
        if 'already has Pending' in str(error_msg) or 'already has' in str(error_msg):
            print(f'Already has payment account, fetching existing...')
            search_param = f'reservationIds={reservation_id}' if reservation_id else f'bookingId={booking_id}'
            existing = apaleo_api_call('GET', f'/booking/v1/payment-accounts?{search_param}')
            if 'error' not in existing:
                accounts = existing.get('data', {}).get('paymentAccounts', [])
                for acc in accounts:
                    if acc.get('status') == 'Pending' and acc.get('paymentLink', {}).get('url'):
                        url = acc['paymentLink']['url']
                        print(f'Found existing payment link: {url[:80]}')
                        return {
                            'url': url,
                            'expiresAt': acc['paymentLink'].get('expiresAt', expires_at),
                            'status': 'Pending',
                        }
        return None

    data = result.get('data', {})
    pa_id = data.get('id', '')
    payment_link_url = ''

    if pa_id:
        print(f'Fetching payment account {pa_id} for URL...')
        time.sleep(1.5)
        get_result = apaleo_api_call('GET', f'/booking/v1/payment-accounts/{pa_id}')
        if 'error' not in get_result:
            account_data = get_result.get('data', {})
            payment_link_url = account_data.get('paymentLink', {}).get('url', '')
            if not payment_link_url:
                time.sleep(2)
                get_result2 = apaleo_api_call('GET', f'/booking/v1/payment-accounts/{pa_id}')
                if 'error' not in get_result2:
                    payment_link_url = get_result2.get('data', {}).get('paymentLink', {}).get('url', '')

    if not payment_link_url:
        payment_link_url = data.get('paymentLink', {}).get('url', '') or data.get('url', '')

    print(f'Final payment link URL: {payment_link_url[:80] if payment_link_url else "EMPTY"}')
    return {
        'url': payment_link_url,
        'expiresAt': expires_at,
        'status': 'Pending',
    }


def call_claude(messages, tools=None):
    """Call Claude API with optional tool use."""
    if not ANTHROPIC_API_KEY:
        return {'error': 'AI chat not configured'}

    payload = {
        'model': 'claude-sonnet-4-20250514',
        'max_tokens': 2048,
        'system': CHAT_SYSTEM_PROMPT,
        'messages': messages,
    }
    if tools:
        payload['tools'] = tools

    req = urllib.request.Request(
        ANTHROPIC_API_URL,
        data=json.dumps(payload).encode(),
        headers={
            'x-api-key': ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        method='POST'
    )
    with urllib.request.urlopen(req, context=ssl_ctx, timeout=60) as resp:
        return json.loads(resp.read())


# Chat system prompt
CHAT_SYSTEM_PROMPT = """You are the Amanthos Living booking assistant. You help guests find and book serviced apartments in Switzerland.

PROPERTIES:
1. Amanthos Living Zurich Airport (GBAL) — Oberhauserstrasse 30, 8152 Glattbrugg. Near Zurich Airport (1km) and city center (9.4km). Amenities: Free Wi-Fi, fully equipped kitchen, air conditioning, Smart TV, desk workspace, digital check-in, private parking (CHF 10/day), lift access.
2. Amanthos Living Solothurn (GNBE) — Bettlachstrasse 20, 2540 Grenchen. 23 fully furnished units. Amenities: Free Wi-Fi, fully equipped kitchen, Smart TV, on-site parking, digital check-in, lift access.
3. Amanthos Living Nyon (NYAL) — Rue du Château 11, 1266 Duillier. 12 rooms/apartments overlooking Lake Geneva with Alps views. Amenities: Free Wi-Fi, kitchenette, Smart TV, parking, digital check-in.

LONG-STAY DISCOUNTS:
- 7+ nights: 25% off
- 14+ nights: 30% off
- 30+ nights: 35% off

RULES:
- Always use the get_offers tool to check real-time prices. NEVER make up or estimate prices.
- Show only Refundable and Non-Refundable rates. Never mention OTA or B2B rates.
- Respond in the same language the guest uses (German or English).
- Be warm, professional, and helpful.
- If a guest wants to book, collect: property, dates, number of guests, first name, last name, email.
- Contact: info@amanthosliving.com / +41 41 562 97 01
- Currency is always CHF.
"""

CHAT_TOOLS = [
    {
        'name': 'get_offers',
        'description': 'Get real-time availability and prices for a specific property and date range from the booking system.',
        'input_schema': {
            'type': 'object',
            'properties': {
                'propertyId': {
                    'type': 'string',
                    'enum': ['GBAL', 'GNBE', 'NYAL'],
                    'description': 'Property ID: GBAL (Zurich Airport), GNBE (Solothurn/Grenchen), NYAL (Nyon/Duillier)',
                },
                'arrival': {
                    'type': 'string',
                    'description': 'Check-in date in YYYY-MM-DD format',
                },
                'departure': {
                    'type': 'string',
                    'description': 'Check-out date in YYYY-MM-DD format',
                },
                'adults': {
                    'type': 'integer',
                    'minimum': 1,
                    'maximum': 4,
                    'description': 'Number of adult guests',
                },
            },
            'required': ['propertyId', 'arrival', 'departure', 'adults'],
        },
    },
    {
        'name': 'create_booking',
        'description': 'Create a reservation in the booking system after collecting all required guest information.',
        'input_schema': {
            'type': 'object',
            'properties': {
                'propertyId': {'type': 'string', 'enum': ['GBAL', 'GNBE', 'NYAL']},
                'ratePlanId': {'type': 'string', 'description': 'The rate plan ID from get_offers'},
                'arrival': {'type': 'string'},
                'departure': {'type': 'string'},
                'adults': {'type': 'integer', 'minimum': 1},
                'firstName': {'type': 'string'},
                'lastName': {'type': 'string'},
                'email': {'type': 'string'},
                'phone': {'type': 'string'},
            },
            'required': ['propertyId', 'ratePlanId', 'arrival', 'departure', 'adults', 'firstName', 'lastName', 'email'],
        },
    },
]


def cleanup_chat_sessions():
    """Remove expired chat sessions."""
    now = time.time()
    expired = [sid for sid, s in _chat_sessions.items() if now - s['last_active'] > CHAT_SESSION_TTL]
    for sid in expired:
        del _chat_sessions[sid]


def get_chat_session(session_id):
    """Get or create a chat session."""
    cleanup_chat_sessions()
    if session_id not in _chat_sessions:
        _chat_sessions[session_id] = {
            'messages': [],
            'last_active': time.time(),
        }
    session = _chat_sessions[session_id]
    session['last_active'] = time.time()
    return session


def execute_tool_call(tool_name, tool_input):
    """Execute a tool call from Claude and return the result."""
    if tool_name == 'get_offers':
        prop_id = tool_input.get('propertyId', '')
        arrival = tool_input.get('arrival', '')
        departure = tool_input.get('departure', '')
        adults = tool_input.get('adults', 1)

        params = urllib.parse.urlencode({
            'propertyId': prop_id,
            'arrival': arrival,
            'departure': departure,
            'adults': adults,
            'channelCode': 'Direct',
        })
        result = apaleo_api_call('GET', f'/booking/v1/offers?{params}')
        if 'error' in result:
            return json.dumps({'error': result['error']})

        filtered = filter_offers(result.get('data', {}))
        return json.dumps({'offers': filtered, 'property': prop_id, 'arrival': arrival, 'departure': departure})

    elif tool_name == 'create_booking':
        # Calculate number of nights for time slices
        try:
            arr_date = datetime.strptime(tool_input['arrival'], '%Y-%m-%d')
            dep_date = datetime.strptime(tool_input['departure'], '%Y-%m-%d')
            chat_nights = (dep_date - arr_date).days
        except (ValueError, TypeError):
            chat_nights = 1
        if chat_nights < 1:
            chat_nights = 1

        chat_time_slices = [{'ratePlanId': tool_input['ratePlanId']} for _ in range(chat_nights)]

        booking_payload = {
            'booker': {
                'firstName': tool_input['firstName'],
                'lastName': tool_input['lastName'],
                'email': tool_input['email'],
                'phone': tool_input.get('phone', ''),
            },
            'reservations': [{
                'arrival': tool_input['arrival'],
                'departure': tool_input['departure'],
                'adults': tool_input['adults'],
                'channelCode': 'Direct',
                'primaryGuest': {
                    'firstName': tool_input['firstName'],
                    'lastName': tool_input['lastName'],
                    'email': tool_input['email'],
                },
                'timeSlices': chat_time_slices,
            }],
        }
        result = apaleo_api_call('POST', '/booking/v1/bookings', booking_payload)
        if 'error' in result:
            return json.dumps({'error': result['error']})

        booking_data = result.get('data', {})
        booking_id = booking_data.get('id', '')
        # Apaleo returns 'reservationIds' (not 'reservations')
        reservation_ids = booking_data.get('reservationIds', []) or booking_data.get('reservations', [])
        reservation_id = reservation_ids[0].get('id', '') if reservation_ids else ''

        response = {
            'success': True,
            'confirmationId': booking_id,
            'reservationId': reservation_id,
            'status': result.get('status', 0),
        }

        # Generate payment link for chat-created bookings (reservation-level)
        # Chat bookings may not have amount info — falls back to payment-accounts/by-link
        chat_amount = tool_input.get('totalAmount', 0)
        chat_currency = tool_input.get('currency', 'CHF')
        try:
            chat_amount = float(chat_amount)
        except (ValueError, TypeError):
            chat_amount = 0

        if reservation_id or booking_id:
            payment_link_data = create_payment_link(
                reservation_id=reservation_id if reservation_id else None,
                property_id=tool_input['propertyId'],
                payer_email=tool_input['email'],
                booking_id=booking_id if booking_id else None,
                amount=chat_amount,
                currency=chat_currency,
            )
            if payment_link_data and payment_link_data.get('url'):
                response['paymentLink'] = payment_link_data['url']

        return json.dumps(response)

    return json.dumps({'error': f'Unknown tool: {tool_name}'})


# ============================================================
# HTTP Handler
# ============================================================

class Handler(http.server.BaseHTTPRequestHandler):

    def _set_cors(self):
        origin = self.headers.get('Origin', '')
        if origin in ALLOWED_ORIGINS:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        # No wildcard fallback — only whitelisted origins get CORS
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key')
        self.send_header('Access-Control-Max-Age', '86400')

    def _set_security_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        self.send_header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')

    def _json_response(self, status, data):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._set_cors()
        self._set_security_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def _error(self, status, message):
        self._json_response(status, {'error': message})

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def do_GET(self):
        path = self.path.split('?')[0]

        if path == '/health':
            self._json_response(200, {'status': 'ok', 'service': 'amanthos-website-api'})

        elif path == '/api/properties':
            self._json_response(200, {'properties': PROPERTIES})

        elif path == '/api/offers':
            self._handle_offers()

        elif path == '/api/availability':
            self._handle_availability()

        elif path == '/api/pending-bookings':
            # Protected: require API key header to prevent PII exposure
            api_key = self.headers.get('X-API-Key', '')
            if not api_key or api_key != os.environ.get('ADMIN_API_KEY', ''):
                return self._error(403, 'Forbidden')
            bookings = load_pending_bookings()
            self._json_response(200, {'pendingBookings': bookings, 'count': len(bookings)})

        # Debitoren Dashboard API routes
        elif path.startswith('/debitoren/api/'):
            self._handle_debitoren_get(path)

        # Debitoren Dashboard frontend (static files)
        elif path == '/debitoren' or path == '/debitoren/':
            self._serve_debitoren_file('index.html')
        elif path.startswith('/debitoren/'):
            rel_path = path[len('/debitoren/'):]
            self._serve_debitoren_file(rel_path)

        else:
            self._error(404, 'Not found')

    def do_POST(self):
        path = self.path.split('?')[0]

        if path == '/api/bookings':
            self._handle_booking()

        elif path == '/api/payment-link':
            self._handle_payment_link()

        elif path == '/api/chat':
            self._handle_chat()

        elif path.startswith('/debitoren/api/'):
            self._handle_debitoren_post(path)

        else:
            self._error(404, 'Not found')

    def _get_query_params(self):
        if '?' not in self.path:
            return {}
        query = self.path.split('?', 1)[1]
        return dict(urllib.parse.parse_qsl(query))

    def _read_body(self, max_size=1_048_576):
        """Read and parse JSON body with size limit (default 1MB)."""
        length = int(self.headers.get('Content-Length', 0))
        if length == 0:
            return {}
        if length > max_size:
            raise ValueError(f'Request body too large: {length} > {max_size}')
        return json.loads(self.rfile.read(length))

    # ---- Debitoren Dashboard Static Files ----
    def _serve_debitoren_file(self, rel_path):
        # Sanitize path to prevent directory traversal
        rel_path = rel_path.replace('\\', '/')
        if '..' in rel_path or rel_path.startswith('/'):
            self._error(403, 'Forbidden')
            return
        file_path = os.path.join(DEBITOREN_FRONTEND_DIR, rel_path)
        # Canonical path check to prevent symlink/traversal attacks
        real_path = os.path.realpath(file_path)
        if not real_path.startswith(os.path.realpath(DEBITOREN_FRONTEND_DIR)):
            self._error(403, 'Forbidden')
            return
        if not os.path.isfile(real_path):
            self._error(404, 'Not found')
            return
        content_type, _ = mimetypes.guess_type(real_path)
        if not content_type:
            content_type = 'application/octet-stream'
        with open(real_path, 'rb') as f:
            content = f.read()
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self._set_security_headers()
        self.end_headers()
        self.wfile.write(content)

    # ---- Debitoren Dashboard API Routes ----
    def _handle_debitoren_get(self, path):
        params = self._get_query_params()
        prop_keys = ','.join(debitoren_logic.DEBITOREN_PROPERTIES.keys())
        property_ids = params.get('propertyIds', prop_keys).split(',')
        valid_ids = [pid for pid in property_ids if pid in debitoren_logic.DEBITOREN_PROPERTIES]

        try:
            if path == '/debitoren/api/properties':
                self._json_response(200, {'properties': debitoren_logic.DEBITOREN_PROPERTIES})
            elif path == '/debitoren/api/historical':
                date_from = params.get('from', (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d'))
                date_to = params.get('to', datetime.utcnow().strftime('%Y-%m-%d'))
                rate_type = params.get('rateType', '')
                data = debitoren_logic.get_historical_data(valid_ids, date_from, date_to)
                if rate_type:
                    for prop_id in data:
                        filtered_res = [r for r in data[prop_id]['reservations'] if r['rateType'] == rate_type]
                        data[prop_id]['reservations'] = filtered_res
                        data[prop_id]['charged'] = sum(1 for r in filtered_res if r['chargeStatus'] == 'charged')
                        data[prop_id]['not_charged_nonref'] = sum(1 for r in filtered_res if r['chargeStatus'] == 'not_charged_nonref')
                        data[prop_id]['not_charged_ref'] = sum(1 for r in filtered_res if r['chargeStatus'] == 'not_charged_ref')
                        data[prop_id]['expired'] = sum(1 for r in filtered_res if r['chargeStatus'] == 'expired')
                        data[prop_id]['total'] = len(filtered_res)
                self._json_response(200, {'dateRange': {'from': date_from, 'to': date_to}, 'rateTypeFilter': rate_type or 'all', 'properties': data})
            elif path == '/debitoren/api/kpi':
                date_from = params.get('from', (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d'))
                date_to = params.get('to', datetime.utcnow().strftime('%Y-%m-%d'))
                data = debitoren_logic.get_kpi_summary(valid_ids, date_from, date_to)
                self._json_response(200, {'dateRange': {'from': date_from, 'to': date_to}, **data})
            elif path == '/debitoren/api/open-charges':
                data = debitoren_logic.get_open_charges_by_deadline(valid_ids)
                self._json_response(200, {'timestamp': datetime.utcnow().isoformat(), 'properties': data})
            elif path == '/debitoren/api/cashflow':
                data = debitoren_logic.get_cashflow_forecast(valid_ids)
                totals_7 = {'count': 0, 'totalRevenue': 0, 'openAmount': 0, 'paidAmount': 0}
                totals_14 = {'count': 0, 'totalRevenue': 0, 'openAmount': 0, 'paidAmount': 0}
                for p in data.values():
                    for key in ('count', 'totalRevenue', 'openAmount', 'paidAmount'):
                        totals_7[key] += p['next7'][key]
                        totals_14[key] += p['next14'][key]
                self._json_response(200, {'timestamp': datetime.now().isoformat(), 'totals': {'next7': {**totals_7, 'currency': 'CHF'}, 'next14': {**totals_14, 'currency': 'CHF'}}, 'properties': data})
            elif path == '/debitoren/api/past-outstanding':
                date_from = params.get('from', (datetime.now() - timedelta(days=180)).strftime('%Y-%m-%d'))
                date_to = params.get('to', datetime.now().strftime('%Y-%m-%d'))
                data = debitoren_logic.get_past_outstanding(valid_ids, date_from, date_to)
                total_outstanding = sum(p['totalOutstanding'] for p in data.values())
                total_count = sum(p['count'] for p in data.values())
                self._json_response(200, {'dateRange': {'from': date_from, 'to': date_to}, 'totals': {'count': total_count, 'totalOutstanding': round(total_outstanding, 2), 'currency': 'CHF'}, 'properties': data})

            # NEW: Liquiditaetsabfrage IST
            elif path == '/debitoren/api/liquidity':
                data = debitoren_logic.get_liquidity_ist(valid_ids)
                self._json_response(200, data)

            # NEW: Aging Analysis
            elif path == '/debitoren/api/aging':
                data = debitoren_logic.get_aging_analysis(valid_ids)
                self._json_response(200, data)

            # NEW: Trend Analysis
            elif path == '/debitoren/api/trends':
                months = int(params.get('months', '6'))
                data = debitoren_logic.get_trend_data(valid_ids, months)
                self._json_response(200, data)

            # NEW: Property Ranking
            elif path == '/debitoren/api/ranking':
                date_from = params.get('from', (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d'))
                date_to = params.get('to', datetime.utcnow().strftime('%Y-%m-%d'))
                data = debitoren_logic.get_property_ranking(valid_ids, date_from, date_to)
                self._json_response(200, data)

            # NEW: Debtor Groups
            elif path == '/debitoren/api/debtor-groups':
                date_from = params.get('from', (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d'))
                date_to = params.get('to', datetime.utcnow().strftime('%Y-%m-%d'))
                data = debitoren_logic.get_debtor_groups(valid_ids, date_from, date_to)
                self._json_response(200, data)

            # NEW: Reminder Templates
            elif path == '/debitoren/api/reminder-templates':
                data = debitoren_logic.get_reminder_templates()
                self._json_response(200, {'templates': data})

            # NEW: Reminder Log
            elif path == '/debitoren/api/reminder-log':
                data = debitoren_logic.get_reminder_log()
                self._json_response(200, {'log': data})

            # NEW: Folio-Check (PRD v2.0)
            elif path == '/debitoren/api/folio-check':
                reservation_id = params.get('reservationId', '')
                property_id = params.get('propertyId', '')
                if not reservation_id:
                    return self._error(400, 'Missing reservationId')
                data = debitoren_logic.folio_check(reservation_id, property_id)
                if 'error' in data:
                    return self._error(502, data['error'])
                self._json_response(200, data)

            # Auto-Charge Log
            elif path == '/debitoren/api/auto-charge-log':
                data = debitoren_logic.get_auto_charge_log()
                self._json_response(200, {'log': data})

            # NEW: Abacus Config Status (Phase 2 stub)
            elif path == '/debitoren/api/abacus-config':
                data = debitoren_logic.get_abacus_config()
                self._json_response(200, data)

            # NEW: Channel Intelligence
            elif path == '/debitoren/api/channel-intelligence':
                self._json_response(200, {'channels': debitoren_logic.CHANNEL_INTELLIGENCE})

            elif path == '/debitoren/api/export':
                date_from = params.get('from', (datetime.utcnow() - timedelta(days=90)).strftime('%Y-%m-%d'))
                date_to = params.get('to', datetime.utcnow().strftime('%Y-%m-%d'))
                data = debitoren_logic.get_historical_data(valid_ids, date_from, date_to)
                lines = ['Property,ReservationID,BookingID,Arrival,Departure,Guest,Email,Company,RateType,RatePlan,ChargeStatus,Amount,Currency,Balance,Channel,Nights,NightlyRate']
                for prop_id, prop_data in data.items():
                    for res in prop_data['reservations']:
                        amount = res.get('totalAmount', {})
                        balance = res.get('balance', {})
                        line = ','.join([debitoren_logic.DEBITOREN_PROPERTIES.get(prop_id, {}).get('name', prop_id), res.get('id', ''), res.get('bookingId', ''), res.get('arrival', ''), res.get('departure', ''), f'"{res.get("guestName", "")}"', f'"{res.get("guestEmail", "")}"', f'"{res.get("company", "")}"', res.get('rateType', ''), f'"{res.get("ratePlanName", "")}"', res.get('chargeStatus', ''), str(amount.get('amount', '')), amount.get('currency', 'CHF'), str(balance.get('amount', '')), res.get('channelCode', ''), str(res.get('nights', '')), str(res.get('nightlyRate', ''))])
                        lines.append(line)
                csv_content = '\n'.join(lines)
                self.send_response(200)
                self.send_header('Content-Type', 'text/csv; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="debitoren-export-{date_from}-{date_to}.csv"')
                self._set_cors()
                self.end_headers()
                self.wfile.write(csv_content.encode('utf-8'))
            else:
                self._error(404, 'Not found')
        except Exception as e:
            print(f'Debitoren error: {e}')
            import traceback; traceback.print_exc()
            self._error(500, str(e))

    def _handle_debitoren_post(self, path):
        if path == '/debitoren/api/auth':
            body = self._read_body()
            pw = body.get('password', '').strip()
            client_ip = self.client_address[0] if self.client_address else 'unknown'
            ok, reason = debitoren_logic.check_password(pw, client_ip)
            if ok:
                self._json_response(200, {'authenticated': True})
            elif reason == 'rate_limited':
                self._error(429, 'Too many attempts. Try again later.')
            else:
                self._error(401, 'Invalid password')
        elif path == '/debitoren/api/cache/clear':
            debitoren_logic.clear_cache()
            self._json_response(200, {'message': 'Cache cleared'})
        elif path == '/debitoren/api/send-reminder':
            body = self._read_body()
            template_key = body.get('templateKey', '1st')
            reservation_data = body.get('reservation', {})
            property_id = body.get('propertyId', '')
            if not reservation_data or not property_id:
                return self._error(400, 'Missing reservation data or propertyId')
            result = debitoren_logic.send_reminder_email(template_key, reservation_data, property_id)
            self._json_response(200, result)
        elif path == '/debitoren/api/generate-reminder':
            body = self._read_body()
            template_key = body.get('templateKey', '1st')
            reservation_data = body.get('reservation', {})
            property_id = body.get('propertyId', '')
            if not reservation_data or not property_id:
                return self._error(400, 'Missing reservation data or propertyId')
            result = debitoren_logic.generate_reminder(template_key, reservation_data, property_id)
            self._json_response(200, result)
        elif path == '/debitoren/api/charge-folio':
            body = self._read_body()
            reservation_id = body.get('reservationId', '')
            property_id = body.get('propertyId', '')
            if not reservation_id:
                return self._error(400, 'Missing reservationId')
            result = debitoren_logic.charge_folio(reservation_id, property_id)
            if result.get('success'):
                self._json_response(200, result)
            else:
                self._json_response(422, result)
        elif path == '/debitoren/api/auto-charge':
            self._error(403, 'Auto-Charge ist deaktiviert.')
        elif path == '/debitoren/api/manual-payment':
            body = self._read_body()
            reservation_id = body.get('reservationId', '')
            property_id = body.get('propertyId', '')
            method = body.get('method', 'Other')
            amount = body.get('amount', None)
            receipt = body.get('receipt', 'Bank Transfer')
            if not reservation_id:
                return self._error(400, 'Missing reservationId')
            try:
                result = debitoren_logic.add_manual_payment(reservation_id, property_id, method=method, receipt=receipt, amount_override=amount)
                if result.get('success'):
                    self._json_response(200, result)
                else:
                    self._json_response(422, result)
            except Exception as e:
                print(f'Manual payment error: {e}')
                import traceback; traceback.print_exc()
                self._error(500, str(e))
        elif path == '/debitoren/api/bulk-manual-payment':
            body = self._read_body()
            reservations = body.get('reservations', [])
            if not reservations:
                return self._error(400, 'Missing reservations')
            try:
                result = debitoren_logic.bulk_add_manual_payment(reservations)
                self._json_response(200, result)
            except Exception as e:
                print(f'Bulk manual payment error: {e}')
                import traceback; traceback.print_exc()
                self._error(500, str(e))
        elif path == '/debitoren/api/bulk-allowances':
            body = self._read_body()
            reservation_ids = body.get('reservationIds', [])
            property_id = body.get('propertyId', '')
            reason = body.get('reason', 'Cancelled reservation')
            if not reservation_ids:
                return self._error(400, 'Missing reservationIds')
            try:
                result = debitoren_logic.bulk_post_allowances(reservation_ids, property_id, reason)
                self._json_response(200, result)
            except Exception as e:
                print(f'Bulk allowances error: {e}')
                import traceback; traceback.print_exc()
                self._error(500, str(e))
        elif path == '/debitoren/api/fix-vcc':
            body = self._read_body()
            reservation_id = body.get('reservationId', '')
            property_id = body.get('propertyId', '')
            if not reservation_id or not property_id:
                return self._error(400, 'Missing reservationId or propertyId')
            try:
                result = debitoren_logic.fix_expedia_vcc(reservation_id, property_id)
                self._json_response(200, result)
            except Exception as e:
                print(f'VCC fix error: {e}')
                import traceback; traceback.print_exc()
                self._error(500, str(e))
        elif path == '/debitoren/api/bulk-fix-vcc':
            body = self._read_body()
            reservation_ids = body.get('reservationIds', [])
            property_id = body.get('propertyId', '')
            if not reservation_ids or not property_id:
                return self._error(400, 'Missing reservationIds or propertyId')
            try:
                result = debitoren_logic.bulk_fix_vcc(reservation_ids, property_id)
                self._json_response(200, result)
            except Exception as e:
                print(f'Bulk VCC fix error: {e}')
                import traceback; traceback.print_exc()
                self._error(500, str(e))
        else:
            self._error(404, 'Not found')

    # ---- Offers ----
    def _handle_offers(self):
        params = self._get_query_params()
        prop_id = params.get('propertyId', '')
        arrival = params.get('arrival', '')
        departure = params.get('departure', '')
        adults = params.get('adults', '1')

        if not prop_id or prop_id not in PROPERTIES:
            return self._error(400, f'Invalid propertyId. Must be one of: {", ".join(PROPERTIES.keys())}')
        if not arrival or not departure:
            return self._error(400, 'arrival and departure dates required (YYYY-MM-DD)')

        query = urllib.parse.urlencode({
            'propertyId': prop_id,
            'arrival': arrival,
            'departure': departure,
            'adults': adults,
            'channelCode': 'Direct',
        })
        result = apaleo_api_call('GET', f'/booking/v1/offers?{query}')

        if 'error' in result:
            print(f'Offers API error: {result["error"][:300]}')
            return self._error(502, 'Could not retrieve offers. Please try again.')

        offers = filter_offers(result.get('data', {}))

        # Calculate nights
        try:
            d1 = datetime.strptime(arrival, '%Y-%m-%d')
            d2 = datetime.strptime(departure, '%Y-%m-%d')
            nights = (d2 - d1).days
        except ValueError:
            nights = 0

        self._json_response(200, {
            'property': prop_id,
            'propertyName': PROPERTIES[prop_id]['name'],
            'arrival': arrival,
            'departure': departure,
            'nights': nights,
            'adults': int(adults),
            'offers': offers,
        })

    # ---- Availability ----
    def _handle_availability(self):
        params = self._get_query_params()
        prop_id = params.get('propertyId', '')
        arrival = params.get('arrival', '')
        departure = params.get('departure', '')

        if not prop_id or prop_id not in PROPERTIES:
            return self._error(400, 'Invalid propertyId')

        query = urllib.parse.urlencode({
            'propertyId': prop_id,
            'from': arrival,
            'to': departure,
            'timeSliceTemplate': 'OverNight',
        })
        result = apaleo_api_call('GET', f'/availability/v1/unit-groups?{query}')

        if 'error' in result:
            print(f'Availability API error: {result["error"][:300]}')
            return self._error(502, 'Could not check availability. Please try again.')

        self._json_response(200, result.get('data', {}))

    # ---- Booking ----
    def _handle_booking(self):
        client_ip = self.client_address[0] if self.client_address else 'unknown'
        if not check_rate_limit(client_ip, 'booking'):
            return self._error(429, 'Too many requests. Please try again later.')
        try:
            body = self._read_body()
        except Exception:
            return self._error(400, 'Invalid JSON body')

        prop_id = body.get('propertyId', '')
        if not prop_id or prop_id not in PROPERTIES:
            return self._error(400, 'Invalid propertyId')

        required = ['ratePlanId', 'arrival', 'departure', 'adults', 'booker']
        for field in required:
            if field not in body:
                return self._error(400, f'Missing required field: {field}')

        booker = body['booker']
        for field in ['firstName', 'lastName', 'email']:
            if field not in booker:
                return self._error(400, f'Missing booker field: {field}')

        # Calculate number of nights for time slices (Apaleo requires one per night)
        try:
            arr_date = datetime.strptime(body['arrival'], '%Y-%m-%d')
            dep_date = datetime.strptime(body['departure'], '%Y-%m-%d')
            num_nights = (dep_date - arr_date).days
        except (ValueError, TypeError):
            num_nights = 1
        if num_nights < 1:
            num_nights = 1

        time_slices = [{'ratePlanId': body['ratePlanId']} for _ in range(num_nights)]

        booking_payload = {
            'booker': {
                'firstName': booker['firstName'],
                'lastName': booker['lastName'],
                'email': booker['email'],
                'phone': booker.get('phone', ''),
            },
            'reservations': [{
                'arrival': body['arrival'],
                'departure': body['departure'],
                'adults': body['adults'],
                'channelCode': 'Direct',
                'primaryGuest': {
                    'firstName': booker['firstName'],
                    'lastName': booker['lastName'],
                    'email': booker['email'],
                },
                'timeSlices': time_slices,
            }],
        }

        if body.get('comment'):
            booking_payload['reservations'][0]['comment'] = body['comment']

        result = apaleo_api_call('POST', '/booking/v1/bookings', booking_payload)

        if 'error' in result:
            print(f'Booking API error: {result["error"][:300]}')
            return self._error(502, 'Booking could not be created. Please try again or contact info@amanthosliving.com.')

        booking_data = result.get('data', {})
        booking_id = booking_data.get('id', '')
        # Apaleo returns 'reservationIds' (not 'reservations') with format [{"id": "XXX-1"}]
        reservation_ids = booking_data.get('reservationIds', []) or booking_data.get('reservations', [])
        reservation_id = reservation_ids[0].get('id', '') if reservation_ids else ''
        print(f'Booking created: id={booking_id}, reservation_id={reservation_id}, raw_keys={list(booking_data.keys())}')

        # Get amount from frontend (totalAmount + currency)
        total_amount = body.get('totalAmount', 0)
        currency = body.get('currency', 'CHF')
        promo_comment = body.get('comment', '')
        try:
            total_amount = float(total_amount)
        except (ValueError, TypeError):
            total_amount = 0

        # Check if promo code made the booking free (100% discount)
        is_free_booking = total_amount <= 0 and 'Promo:' in promo_comment
        if is_free_booking:
            print(f'FREE BOOKING via promo code for {booking_id} — skipping payment link')

        # Generate payment link directly on reservation level (3-day expiry)
        payment_link_data = None
        if not is_free_booking:
            if reservation_id:
                payment_link_data = create_payment_link(
                    reservation_id=reservation_id,
                    property_id=prop_id,
                    payer_email=booker['email'],
                    booking_id=booking_id,
                    amount=total_amount,
                    currency=currency,
                )
            elif booking_id:
                # Fallback: booking-level if no reservation ID
                payment_link_data = create_payment_link(
                    reservation_id=None,
                    property_id=prop_id,
                    payer_email=booker['email'],
                    booking_id=booking_id,
                    amount=total_amount,
                    currency=currency,
                )

        response_data = {
            'success': True,
            'confirmationId': booking_id,
            'reservationId': reservation_id,
            'propertyId': prop_id,
        }

        if is_free_booking:
            response_data['paymentRequired'] = False
            response_data['paymentLink'] = None
            response_data['message'] = 'Your reservation is confirmed! No payment required — your promo code covers the full amount.'
        elif payment_link_data and payment_link_data.get('url'):
            response_data['paymentRequired'] = True
            response_data['paymentLink'] = payment_link_data['url']
            response_data['paymentLinkExpiresAt'] = payment_link_data.get('expiresAt', '')
            response_data['message'] = 'Your reservation has been created but is NOT yet confirmed. Please complete the payment to confirm your booking.'
            # Track this booking for payment reminder / auto-cancel
            add_pending_booking(
                booking_id=booking_id,
                reservation_id=reservation_id,
                property_id=prop_id,
                email=booker['email'],
                first_name=booker['firstName'],
                last_name=booker['lastName'],
                payment_link=payment_link_data['url'],
                amount=total_amount,
                currency=currency,
            )
        else:
            response_data['paymentRequired'] = True
            print(f'WARNING: No payment link generated for booking {booking_id}')
            response_data['paymentLink'] = None
            response_data['message'] = 'Your reservation has been created but the payment link could not be generated. Please use the retry button or contact us.'

        self._json_response(201, response_data)

    # ---- Payment Link (retry/resend) ----
    def _handle_payment_link(self):
        client_ip = self.client_address[0] if self.client_address else 'unknown'
        if not check_rate_limit(client_ip, 'payment_link'):
            return self._error(429, 'Too many requests. Please try again later.')
        try:
            body = self._read_body()
        except Exception:
            return self._error(400, 'Invalid JSON body')

        booking_id = body.get('bookingId', '')
        property_id = body.get('propertyId', '')
        reservation_id = body.get('reservationId', '')
        email = body.get('email', '')

        if not property_id or not email:
            return self._error(400, 'Missing required fields: propertyId, email')

        if not booking_id and not reservation_id:
            return self._error(400, 'Missing required field: bookingId or reservationId')

        if property_id not in PROPERTIES:
            return self._error(400, 'Invalid propertyId')

        # Get amount from retry request
        total_amount = body.get('totalAmount', 0)
        currency = body.get('currency', 'CHF')
        try:
            total_amount = float(total_amount)
        except (ValueError, TypeError):
            total_amount = 0

        # Create payment link on reservation level (preferred) or booking level
        payment_link_data = create_payment_link(
            reservation_id=reservation_id if reservation_id else None,
            property_id=property_id,
            payer_email=email,
            booking_id=booking_id if booking_id else None,
            amount=total_amount,
            currency=currency,
        )

        if not payment_link_data or not payment_link_data.get('url'):
            return self._error(502, 'Failed to generate payment link. Please contact info@amanthosliving.com.')

        self._json_response(200, {
            'paymentLink': payment_link_data['url'],
            'expiresAt': payment_link_data.get('expiresAt', ''),
        })

    # ---- Chat ----
    def _handle_chat(self):
        client_ip = self.client_address[0] if self.client_address else 'unknown'
        if not check_rate_limit(client_ip, 'chat'):
            return self._error(429, 'Too many requests. Please try again later.')
        try:
            body = self._read_body()
        except Exception:
            return self._error(400, 'Invalid JSON body')

        user_message = body.get('message', '').strip()
        if not user_message:
            return self._error(400, 'Message is required')
        # Limit message length to prevent abuse
        if len(user_message) > 2000:
            return self._error(400, 'Message too long (max 2000 characters)')

        session_id = body.get('session_id', str(uuid.uuid4()))
        session = get_chat_session(session_id)

        # Add user message
        session['messages'].append({'role': 'user', 'content': user_message})

        # Trim old messages
        if len(session['messages']) > CHAT_MAX_MESSAGES:
            session['messages'] = session['messages'][-CHAT_MAX_MESSAGES:]

        try:
            # Call Claude with tools
            response = call_claude(session['messages'], CHAT_TOOLS)

            # Handle tool use loop (max 3 iterations)
            iterations = 0
            while response.get('stop_reason') == 'tool_use' and iterations < 3:
                iterations += 1

                # Extract assistant content (text + tool_use blocks)
                assistant_content = response.get('content', [])
                session['messages'].append({'role': 'assistant', 'content': assistant_content})

                # Execute each tool call
                tool_results = []
                for block in assistant_content:
                    if block.get('type') == 'tool_use':
                        result = execute_tool_call(block['name'], block['input'])
                        tool_results.append({
                            'type': 'tool_result',
                            'tool_use_id': block['id'],
                            'content': result,
                        })

                session['messages'].append({'role': 'user', 'content': tool_results})

                # Call Claude again with tool results
                response = call_claude(session['messages'], CHAT_TOOLS)

            # Extract final text response
            reply = ''
            action = None
            offers_data = None

            for block in response.get('content', []):
                if block.get('type') == 'text':
                    reply += block['text']

            # Add assistant reply to session
            session['messages'].append({'role': 'assistant', 'content': reply})

            self._json_response(200, {
                'reply': reply,
                'session_id': session_id,
                'action': action,
            })

        except Exception as e:
            import traceback
            print(f'Chat error: {e}')
            traceback.print_exc()
            self._error(500, 'Chat service temporarily unavailable. Please try again.')

    def log_message(self, format, *args):
        print(f'[{datetime.now().strftime("%H:%M:%S")}] {args[0]}' if args else '')


# ============================================================
# Start Server
# ============================================================

if __name__ == '__main__':
    print(f'Amanthos Website API starting on port {PORT}...')
    print(f'Properties: {", ".join(PROPERTIES.keys())}')
    print(f'Apaleo Client: {CLIENT_ID[:10]}...' if CLIENT_ID else 'Apaleo: NOT CONFIGURED')
    print(f'Claude AI: {"Configured" if ANTHROPIC_API_KEY else "NOT CONFIGURED"}')
    server = HTTPServer(('0.0.0.0', PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down...')
        server.server_close()
