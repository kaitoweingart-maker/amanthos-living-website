(function () {
'use strict';
var API_BASE = window.AMANTHOS_API_BASE || 'https://amanthos-website-api.onrender.com';
var PROPERTIES = {
'GBAL': { name: 'Zurich Airport', short: 'Zurich' },
'GNBE': { name: 'Solothurn / Grenchen', short: 'Solothurn' },
'NYAL': { name: 'Nyon / Duillier', short: 'Nyon' },
};
var selectedOffer = null;
var currentOffers = [];
var searchParams = {};
// dataLayer helper for GTM
window.dataLayer = window.dataLayer || [];
function gtmPush(event, data) {
var obj = { event: event };
if (data) { var k = Object.keys(data); for (var i = 0; i < k.length; i++) { obj[k[i]] = data[k[i]]; } }
window.dataLayer.push(obj);
}
// Promo code configuration
var PROMO_CODES = {
'DM23102901TEST100BBPR': { discount: 1.0, label: '100%' },
};
var appliedPromo = null;
var searchBtn = document.getElementById('bookingSearchBtn');
var bookingSection = document.getElementById('booking');
var offersGrid = document.getElementById('offersGrid');
var offersLoading = document.getElementById('offersLoading');
var guestForm = document.getElementById('guestForm');
var confirmBtn = document.getElementById('confirmBookingBtn');
var cancelBtn = document.getElementById('cancelBookingBtn');
var bookingStatus = document.getElementById('bookingStatus');
function showValidation(el, msg) {
if (!el) return;
var existing = el.parentElement.querySelector('.validation-msg');
if (existing) existing.remove();
var span = document.createElement('span');
span.className = 'validation-msg';
span.textContent = msg;
span.style.cssText = 'color:var(--color-error);font-size:.78rem;font-weight:500;margin-top:.25rem;display:block;';
span.setAttribute('role', 'alert');
el.parentElement.appendChild(span);
el.style.borderColor = 'var(--color-error)';
el.focus();
el.addEventListener('input', function handler() {
el.style.borderColor = '';
var m = el.parentElement.querySelector('.validation-msg');
if (m) m.remove();
el.removeEventListener('input', handler);
});
}
function wakeBackend() {
fetch(API_BASE + '/health', { mode: 'cors' }).catch(function () {});
}
if ('requestIdleCallback' in window) {
requestIdleCallback(wakeBackend);
} else {
setTimeout(wakeBackend, 3000);
}
// Inline validation on blur for guest form fields
['guest-first', 'guest-last', 'guest-email'].forEach(function (id) {
var field = document.getElementById(id);
if (!field) return;
field.addEventListener('blur', function () {
var val = this.value.trim();
var existing = this.parentElement.querySelector('.validation-msg');
if (existing) existing.remove();
this.style.borderColor = '';
if (!val) {
showValidation(this, window.t ? window.t('booking.validation_required') : 'This field is required.');
} else if (id === 'guest-email' && !isValidEmail(val)) {
showValidation(this, window.t ? window.t('booking.validation_valid_email') : 'Please enter a valid email address.');
} else {
this.style.borderColor = 'var(--color-success)';
}
});
});
// Promo code apply button
var applyPromoBtn = document.getElementById('applyPromoBtn');
if (applyPromoBtn) {
applyPromoBtn.addEventListener('click', applyPromoCode);
}
var promoInput = document.getElementById('promoCodeInput');
if (promoInput) {
promoInput.addEventListener('keydown', function (e) {
if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
});
}
if (searchBtn) {
searchBtn.addEventListener('click', function () {
var location = document.getElementById('bb-location');
var checkin = document.getElementById('bb-checkin');
var checkout = document.getElementById('bb-checkout');
var guests = document.getElementById('bb-guests');
var locationVal = location ? location.value : '';
var checkinVal = checkin ? checkin.value : '';
var checkoutVal = checkout ? checkout.value : '';
var guestsVal = guests ? guests.value : '2';
if (!locationVal) { showValidation(location, window.t ? window.t('booking.validation_select_location') : 'Please select a location.'); return; }
if (!checkinVal) { showValidation(checkin, window.t ? window.t('booking.validation_select_checkin') : 'Please select a check-in date.'); return; }
if (!checkoutVal) { showValidation(checkout, window.t ? window.t('booking.validation_select_checkout') : 'Please select a check-out date.'); return; }
if (checkoutVal <= checkinVal) { showValidation(checkout, window.t ? window.t('booking.validation_checkout_after') : 'Check-out must be after check-in.'); return; }
searchParams = {
propertyId: locationVal,
arrival: checkinVal,
departure: checkoutVal,
adults: guestsVal,
};
gtmPush('search_availability', {
location: PROPERTIES[locationVal] ? PROPERTIES[locationVal].name : locationVal,
check_in: checkinVal,
check_out: checkoutVal,
guests: guestsVal
});
fetchOffers();
});
}
function showSkeletonCards() {
if (!offersGrid) return;
var skeletonHtml = '';
for (var s = 0; s < 3; s++) {
skeletonHtml += '<div class="skeleton-card" aria-hidden="true">';
skeletonHtml += '<div class="skeleton skeleton-line w-40"></div>';
skeletonHtml += '<div class="skeleton skeleton-line h-md w-60"></div>';
skeletonHtml += '<div class="skeleton skeleton-line w-80"></div>';
skeletonHtml += '<div class="skeleton skeleton-line h-lg w-40"></div>';
skeletonHtml += '<div class="skeleton skeleton-line w-60"></div>';
skeletonHtml += '<div class="skeleton skeleton-line h-btn w-100"></div>';
skeletonHtml += '</div>';
}
offersGrid.innerHTML = skeletonHtml;
}
function fetchOffers() {
if (!bookingSection || !offersGrid || !offersLoading) return;
bookingSection.style.display = 'block';
offersGrid.innerHTML = '';
if (guestForm) guestForm.style.display = 'none';
if (bookingStatus) bookingStatus.style.display = 'none';
offersLoading.style.display = 'none';
selectedOffer = null;
showSkeletonCards();
setTimeout(function () {
bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, 100);
var query = '';
var keys = Object.keys(searchParams);
for (var i = 0; i < keys.length; i++) {
if (i > 0) query += '&';
query += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(searchParams[keys[i]]);
}
fetch(API_BASE + '/api/offers?' + query, { mode: 'cors' })
.then(function (res) {
if (!res.ok) {
return res.json().then(function (errData) {
throw new Error(errData.error || 'Failed to fetch offers (HTTP ' + res.status + ')');
}).catch(function () {
throw new Error('Failed to fetch offers (HTTP ' + res.status + ')');
});
}
return res.json();
})
.then(function (data) {
offersLoading.style.display = 'none';
currentOffers = data.offers || [];
gtmPush('view_offers', {
location: PROPERTIES[searchParams.propertyId] ? PROPERTIES[searchParams.propertyId].name : searchParams.propertyId,
offer_count: currentOffers.length
});
if (currentOffers.length === 0) {
offersGrid.innerHTML = '<div class="no-offers"><p>' + (window.t ? window.t('booking.no_offers') : 'No availability found for the selected dates. Please try different dates or another location.') + '</p></div>';
return;
}
renderOffers(data);
})
.catch(function (err) {
offersLoading.style.display = 'none';
var msg = window.t ? window.t('booking.unable_to_check') : 'Unable to check availability right now.';
if (err.message && err.message.indexOf('Failed to fetch') !== -1) {
msg = window.t ? window.t('booking.server_waking') : 'Our booking server is waking up (this takes ~30 seconds on first load). Please click "Check Prices" again in a moment.';
}
var noOffersDiv = document.createElement('div');
noOffersDiv.className = 'no-offers';
noOffersDiv.setAttribute('role', 'alert');
var iconSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
iconSvg.setAttribute('width', '40');
iconSvg.setAttribute('height', '40');
iconSvg.setAttribute('viewBox', '0 0 24 24');
iconSvg.setAttribute('fill', 'none');
iconSvg.setAttribute('stroke', 'var(--color-error)');
iconSvg.setAttribute('stroke-width', '1.5');
iconSvg.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';
iconSvg.style.margin = '0 auto 1rem';
iconSvg.style.display = 'block';
noOffersDiv.appendChild(iconSvg);
var msgP = document.createElement('p');
msgP.textContent = msg;
msgP.style.cssText = 'font-size:.95rem;color:var(--color-text);margin-bottom:.5rem;font-weight:500;';
noOffersDiv.appendChild(msgP);
var helpP = document.createElement('p');
helpP.style.cssText = 'font-size:.82rem;color:var(--color-text-muted);margin-bottom:1rem;';
helpP.textContent = window.t ? window.t('booking.error_help') : 'Please try again or contact us at info@amanthosliving.com';
noOffersDiv.appendChild(helpP);
var retryBtn = document.createElement('button');
retryBtn.className = 'btn btn-accent';
retryBtn.style.marginTop = '.5rem';
retryBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:.35rem;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> ' + (window.t ? window.t('booking.try_again') : 'Try Again');
retryBtn.addEventListener('click', function () {
var sb = document.getElementById('bookingSearchBtn');
if (sb) sb.click();
});
noOffersDiv.appendChild(retryBtn);
offersGrid.innerHTML = '';
offersGrid.appendChild(noOffersDiv);
gtmPush('booking_error', { error_message: err.message || 'Unknown error', step: 'fetch_offers' });
console.error('Offers error:', err);
});
}
function renderOffers(data) {
var html = '';
var nights = data.nights || 1;
var propName = PROPERTIES[data.property] ? PROPERTIES[data.property].name : data.propertyName;
html += '<div class="offers-summary">';
html += '<h3>' + escapeHtml(propName) + '</h3>';
var nightLabel = nights === 1 ? (window.t ? window.t('booking.night') : 'night') : (window.t ? window.t('booking.nights') : 'nights');
var guestLabel = data.adults === 1 ? (window.t ? window.t('booking.guest_singular') : 'guest') : (window.t ? window.t('booking.guests_plural') : 'guests');
html += '<p>' + escapeHtml(data.arrival) + ' &rarr; ' + escapeHtml(data.departure) + ' &middot; ' + nights + ' ' + nightLabel + ' &middot; ' + data.adults + ' ' + guestLabel + '</p>';
var viewerCount = Math.floor(Math.random() * 8) + 3;
var lookingMsg = window.t ? window.t('booking.people_looking', { n: viewerCount, loc: escapeHtml(PROPERTIES[data.property] ? PROPERTIES[data.property].short : '') }) : viewerCount + ' people are looking at ' + escapeHtml(PROPERTIES[data.property] ? PROPERTIES[data.property].short : '') + ' right now';
html += '<p class="offers-urgency"><span class="urgency-dot"></span> ' + lookingMsg + '</p>';
html += '</div>';
var refundable = currentOffers.filter(function (o) { return o.category === 'Refundable'; });
var nonRefundable = currentOffers.filter(function (o) { return o.category === 'Non-Refundable'; });
if (nonRefundable.length > 0) {
html += '<h4 class="offers-category-title">' + (window.t ? window.t('booking.best_price_label') : 'Best Price — Non-Refundable') + '</h4>';
nonRefundable.forEach(function (offer, i) {
html += renderOfferCard(offer, 'non-refundable', i, true);
});
}
if (refundable.length > 0) {
html += '<h4 class="offers-category-title">' + (window.t ? window.t('booking.flexible_label') : 'Flexible — Refundable') + '</h4>';
refundable.forEach(function (offer, i) {
html += renderOfferCard(offer, 'refundable', nonRefundable.length + i, false);
});
}
offersGrid.innerHTML = html;
offersGrid.querySelectorAll('.offer-card').forEach(function (card) {
card.addEventListener('click', function () {
var idx = parseInt(this.getAttribute('data-index'));
selectOffer(idx);
});
card.addEventListener('keydown', function (e) {
if (e.key === 'Enter' || e.key === ' ') {
e.preventDefault();
var idx = parseInt(this.getAttribute('data-index'));
selectOffer(idx);
}
});
});
}
function renderOfferCard(offer, categoryClass, index, isBestPrice) {
var total = offer.totalGrossAmount || {};
var perNight = offer.averagePerNight || {};
var currency = total.currency || 'CHF';
var totalAmount = total.amount ? total.amount.toFixed(2) : '\u2014';
var perNightAmount = perNight.amount ? perNight.amount.toFixed(2) : '\u2014';
var html = '<div class="offer-card' + (isBestPrice ? ' best-price' : '') + '" data-index="' + index + '" tabindex="0" role="button" aria-label="Select ' + escapeHtml(offer.unitGroupName || '') + ' ' + escapeHtml(offer.category) + '">';
if (isBestPrice) {
html += '<div class="offer-best-tag">' + (window.t ? window.t('booking.best_price_tag') : 'Best Price') + '</div>';
}
html += '<span class="offer-category ' + categoryClass + '">' + escapeHtml(offer.category) + '</span>';
html += '<div class="offer-unit">' + escapeHtml(offer.unitGroupName || (window.t ? window.t('booking.apartment') : 'Apartment')) + '</div>';
html += '<div class="offer-rate-name">' + escapeHtml(offer.ratePlanName || '') + '</div>';
html += '<div class="offer-price">' + currency + ' ' + totalAmount + ' <small>' + (window.t ? window.t('booking.total') : 'total') + '</small></div>';
html += '<div class="offer-per-night">' + currency + ' ' + perNightAmount + ' ' + (window.t ? window.t('booking.per_night') : '/ night') + '</div>';
if (offer.availableUnits > 0 && offer.availableUnits <= 3) {
html += '<div class="offer-scarcity">' + (window.t ? window.t('booking.only_left', { n: offer.availableUnits }) : 'Only ' + offer.availableUnits + ' left!') + '</div>';
} else if (offer.availableUnits > 0) {
html += '<div class="offer-availability">' + (window.t ? window.t('booking.available', { n: offer.availableUnits }) : offer.availableUnits + ' available') + '</div>';
}
html += '<div class="offer-trust">';
html += '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
html += categoryClass === 'refundable' ? ' ' + (window.t ? window.t('booking.free_cancellation') : 'Free cancellation') : ' ' + (window.t ? window.t('booking.best_rate_guaranteed') : 'Best rate guaranteed');
html += '</div>';
html += '<div class="offer-select-btn">' + (window.t ? window.t('booking.select') : 'Select') + ' &rarr;</div>';
html += '</div>';
return html;
}
function selectOffer(index) {
selectedOffer = currentOffers[index];
if (!selectedOffer || !guestForm) return;
offersGrid.querySelectorAll('.offer-card').forEach(function (card, i) {
card.classList.toggle('selected', i === index);
});
guestForm.style.display = 'block';
if (bookingStatus) bookingStatus.style.display = 'none';
// Reset promo code on new selection
appliedPromo = null;
var promoMsg = document.getElementById('promoMessage');
if (promoMsg) promoMsg.textContent = '';
var promoInput = document.getElementById('promoCodeInput');
if (promoInput) promoInput.value = '';
updatePriceDisplay();
gtmPush('select_offer', {
rate_name: selectedOffer.ratePlanName || '',
category: selectedOffer.category || '',
total_price: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0,
currency: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
unit_type: selectedOffer.unitGroupName || ''
});
gtmPush('begin_checkout', {
rate_name: selectedOffer.ratePlanName || '',
total_price: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0
});
guestForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// Promo code functions
function applyPromoCode() {
var input = document.getElementById('promoCodeInput');
var msg = document.getElementById('promoMessage');
if (!input || !msg) return;
var code = input.value.trim().toUpperCase();
if (!code) { msg.textContent = window.t ? window.t('booking.promo_enter') : 'Please enter a promo code.'; msg.style.color = 'var(--color-error)'; return; }
if (PROMO_CODES[code]) {
appliedPromo = { code: code, discount: PROMO_CODES[code].discount, label: PROMO_CODES[code].label };
msg.textContent = (window.t ? window.t('booking.promo_applied') : 'Promo code applied!') + ' -' + PROMO_CODES[code].label;
msg.style.color = '#059669';
gtmPush('promo_code_applied', { promo_code: code, discount: PROMO_CODES[code].label });
updatePriceDisplay();
} else {
appliedPromo = null;
msg.textContent = window.t ? window.t('booking.promo_invalid') : 'Invalid promo code.';
msg.style.color = 'var(--color-error)';
updatePriceDisplay();
}
}
function getDiscountedTotal() {
if (!selectedOffer || !selectedOffer.totalGrossAmount) return null;
var total = selectedOffer.totalGrossAmount.amount;
if (appliedPromo) { total = total * (1 - appliedPromo.discount); }
return { amount: Math.round(total * 100) / 100, currency: selectedOffer.totalGrossAmount.currency };
}
function updatePriceDisplay() {
var display = document.getElementById('promoDiscountDisplay');
if (!display || !selectedOffer || !selectedOffer.totalGrossAmount) return;
if (appliedPromo) {
var orig = selectedOffer.totalGrossAmount;
var disc = getDiscountedTotal();
display.innerHTML = '<span style="text-decoration:line-through;color:var(--color-text-muted);font-size:.9rem;">' + orig.currency + ' ' + orig.amount.toFixed(2) + '</span> <span style="color:#059669;font-weight:700;font-size:1.1rem;">' + disc.currency + ' ' + disc.amount.toFixed(2) + '</span>';
display.style.display = 'block';
} else {
display.style.display = 'none';
display.innerHTML = '';
}
}
if (confirmBtn) {
confirmBtn.addEventListener('click', function () {
if (!selectedOffer) return;
var firstName = document.getElementById('guest-first').value.trim();
var lastName = document.getElementById('guest-last').value.trim();
var email = document.getElementById('guest-email').value.trim();
var phone = document.getElementById('guest-phone').value.trim();
if (!firstName || !lastName || !email) {
showStatus('error', window.t ? window.t('booking.validation_fill_required') : 'Please fill in all required fields (First Name, Last Name, Email).');
return;
}
if (!isValidEmail(email)) {
showStatus('error', window.t ? window.t('booking.validation_valid_email') : 'Please enter a valid email address.');
return;
}
confirmBtn.disabled = true;
confirmBtn.textContent = window.t ? window.t('booking.processing') : 'Processing...';
gtmPush('submit_booking', {
location: PROPERTIES[searchParams.propertyId] ? PROPERTIES[searchParams.propertyId].name : searchParams.propertyId,
rate_name: selectedOffer.ratePlanName || '',
promo_code: appliedPromo ? appliedPromo.code : ''
});
var discountedTotal = getDiscountedTotal();
var finalTotal = discountedTotal ? discountedTotal.amount : (selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0);
var payload = {
propertyId: searchParams.propertyId,
ratePlanId: selectedOffer.ratePlanId,
arrival: searchParams.arrival,
departure: searchParams.departure,
adults: parseInt(searchParams.adults),
totalAmount: finalTotal,
currency: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
booker: {
firstName: firstName,
lastName: lastName,
email: email,
phone: phone,
},
comment: appliedPromo ? 'Booked via amanthosliving.com | Promo: ' + appliedPromo.code + ' (' + appliedPromo.label + ' off)' : 'Booked via amanthosliving.com',
};
fetch(API_BASE + '/api/bookings', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload),
mode: 'cors',
})
.then(function (res) { return res.json(); })
.then(function (data) {
confirmBtn.disabled = false;
confirmBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ' + (window.t ? window.t('booking.confirm_reservation') : 'Confirm Reservation');
if (data.success) {
gtmPush('booking_confirmed', {
booking_id: data.confirmationId || '',
total_price: finalTotal,
currency: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
promo_code: appliedPromo ? appliedPromo.code : ''
});
guestForm.querySelector('.form-grid').style.display = 'none';
guestForm.querySelector('.form-actions').style.display = 'none';
// Hide promo section after booking
var promoSection = guestForm.querySelector('.promo-code-section');
if (promoSection) promoSection.style.display = 'none';
if (data.paymentRequired === false) {
// Free booking via promo code — no payment needed
showFreeBookingConfirmation(data.confirmationId, email);
} else if (data.paymentLink) {
showPaymentStep(data.confirmationId, data.paymentLink, email, data);
} else {
// Payment link failed — show retry UI
showPaymentRetry(data.confirmationId, email, data);
}
} else {
gtmPush('booking_error', { error_message: data.error || 'Booking failed', step: 'confirm_booking' });
showStatus('error', data.error || (window.t ? window.t('booking.error_booking_failed') : 'Booking failed. Please try again or contact us at info@amanthosliving.com.'));
}
})
.catch(function (err) {
confirmBtn.disabled = false;
confirmBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ' + (window.t ? window.t('booking.confirm_reservation') : 'Confirm Reservation');
showStatus('error', window.t ? window.t('booking.error_connection') : 'Connection error. Please try again or contact us at info@amanthosliving.com.');
console.error('Booking error:', err);
});
});
}
if (cancelBtn) {
cancelBtn.addEventListener('click', function () {
if (guestForm) guestForm.style.display = 'none';
selectedOffer = null;
if (offersGrid) {
offersGrid.querySelectorAll('.offer-card').forEach(function (card) {
card.classList.remove('selected');
});
}
});
}
function showStatus(type, message) {
if (!bookingStatus) return;
bookingStatus.className = 'booking-status ' + type;
bookingStatus.textContent = message;
bookingStatus.style.display = 'block';
}
function isValidEmail(email) {
return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function escapeHtml(str) {
if (!str) return '';
var div = document.createElement('div');
div.textContent = str;
return div.innerHTML;
}
function getOrCreatePaymentSection() {
var paymentSection = document.getElementById('paymentStep');
if (!paymentSection) {
paymentSection = document.createElement('div');
paymentSection.id = 'paymentStep';
paymentSection.className = 'payment-step';
guestForm.appendChild(paymentSection);
}
return paymentSection;
}
function showFreeBookingConfirmation(confirmationId, email) {
if (bookingStatus) bookingStatus.style.display = 'none';
var paymentSection = getOrCreatePaymentSection();
var html = '';
html += '<div class="payment-step-success" style="border-left:4px solid #059669;background:#ECFDF5;">';
html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
html += '<div>';
html += '<h4 style="color:#065F46;">Booking Confirmed — Reference: ' + escapeHtml(confirmationId) + '</h4>';
html += '<p style="font-size:.82rem;color:#059669;margin-top:.25rem;">' + escapeHtml(email) + '</p>';
html += '</div>';
html += '</div>';
html += '<div class="payment-step-action" style="text-align:center;padding:1.5rem;">';
html += '<div style="display:inline-flex;align-items:center;gap:.5rem;background:#ECFDF5;color:#059669;padding:.5rem 1rem;border-radius:2rem;font-size:.85rem;font-weight:700;margin-bottom:1rem;">';
html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
html += ' NO PAYMENT REQUIRED';
html += '</div>';
html += '<p style="font-weight:500;color:var(--color-text);margin-bottom:.75rem;">Your promo code covers the full amount. Your reservation is confirmed!</p>';
html += '<p style="font-size:.85rem;color:var(--color-text-muted);">A confirmation email will be sent to <strong>' + escapeHtml(email) + '</strong>.</p>';
html += '</div>';
paymentSection.innerHTML = html;
paymentSection.style.display = 'block';
paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function showPaymentStep(confirmationId, paymentLink, email, bookingData) {
gtmPush('payment_initiated', { booking_id: confirmationId });
if (bookingStatus) bookingStatus.style.display = 'none';
var paymentSection = getOrCreatePaymentSection();
var confirmMsg = window.t ? window.t('booking.payment_confirmed_id', { id: confirmationId }) : 'Reservation created — Reference: ' + confirmationId;
var paymentMsg = window.t ? window.t('booking.payment_instruction') : 'Payment is required to confirm your reservation. Without payment, your booking will be automatically cancelled.';
var payBtnText = window.t ? window.t('booking.pay_now') : 'Pay Now — Secure Payment';
var emailNote = window.t ? window.t('booking.payment_email_note', { email: email }) : 'A confirmation email will be sent to ' + email + ' after payment.';
var secureNote = window.t ? window.t('booking.payment_secure_note') : 'You will be redirected to a secure payment page powered by Adyen.';
var totalText = '';
if (selectedOffer && selectedOffer.totalGrossAmount) {
totalText = selectedOffer.totalGrossAmount.currency + ' ' + selectedOffer.totalGrossAmount.amount.toFixed(2);
}
var html = '';
html += '<div class="payment-step-success" style="border-left:4px solid #F59E0B;background:#FFFBEB;">';
html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
html += '<div>';
html += '<h4 style="color:#92400E;">' + escapeHtml(confirmMsg) + '</h4>';
html += '<p style="font-size:.82rem;color:#B45309;margin-top:.25rem;">' + escapeHtml(email) + '</p>';
html += '</div>';
html += '</div>';
html += '<div class="payment-step-action">';
html += '<div style="display:inline-flex;align-items:center;gap:.5rem;background:#FEE2E2;color:#DC2626;padding:.5rem 1rem;border-radius:2rem;font-size:.85rem;font-weight:700;margin-bottom:1rem;letter-spacing:.3px;">';
html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
html += ' ' + (window.t ? window.t('booking.payment_pending') : 'PAYMENT REQUIRED');
html += '</div>';
html += '<p class="payment-instruction" style="font-weight:500;color:var(--color-text);margin-bottom:.75rem;">' + escapeHtml(paymentMsg) + '</p>';
if (totalText) {
html += '<p style="font-size:1.8rem;font-weight:800;color:var(--color-primary);font-family:var(--font-heading);margin:.75rem 0;letter-spacing:-.5px;">' + escapeHtml(totalText) + '</p>';
}
html += '<a href="' + escapeHtml(paymentLink) + '" target="_blank" rel="noopener" class="btn btn-accent btn-lg payment-btn" style="font-size:1.1rem;padding:1rem 2.5rem;font-weight:700;">';
html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
html += ' ' + escapeHtml(payBtnText);
html += '</a>';
html += '<p class="payment-secure-note" style="margin-top:1rem;">';
html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ';
html += escapeHtml(secureNote);
html += '</p>';
html += '<p class="payment-email-note">' + escapeHtml(emailNote) + '</p>';
html += '</div>';
paymentSection.innerHTML = html;
paymentSection.style.display = 'block';
paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function showPaymentRetry(confirmationId, email, bookingData) {
if (bookingStatus) bookingStatus.style.display = 'none';
var paymentSection = getOrCreatePaymentSection();
var totalText = '';
if (selectedOffer && selectedOffer.totalGrossAmount) {
totalText = selectedOffer.totalGrossAmount.currency + ' ' + selectedOffer.totalGrossAmount.amount.toFixed(2);
}
var html = '';
html += '<div class="payment-step-success" style="border-left:4px solid #F59E0B;background:#FFFBEB;">';
html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
html += '<div>';
html += '<h4 style="color:#92400E;">' + (window.t ? window.t('booking.payment_confirmed_id', { id: confirmationId }) : 'Reservation created — Reference: ' + confirmationId) + '</h4>';
html += '<p style="font-size:.82rem;color:#DC2626;font-weight:600;margin-top:.25rem;">' + (window.t ? window.t('booking.payment_link_expired') : 'Payment link could not be generated. Please retry.') + '</p>';
html += '</div>';
html += '</div>';
html += '<div class="payment-step-action">';
html += '<div style="display:inline-flex;align-items:center;gap:.5rem;background:#FEE2E2;color:#DC2626;padding:.5rem 1rem;border-radius:2rem;font-size:.85rem;font-weight:700;margin-bottom:1rem;">';
html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
html += ' ' + (window.t ? window.t('booking.payment_pending') : 'PAYMENT REQUIRED');
html += '</div>';
html += '<p class="payment-instruction" style="font-weight:500;color:var(--color-text);margin-bottom:.75rem;">' + (window.t ? window.t('booking.payment_instruction') : 'Payment is required to confirm your reservation. Without payment, your booking will be automatically cancelled.') + '</p>';
if (totalText) {
html += '<p style="font-size:1.8rem;font-weight:800;color:var(--color-primary);font-family:var(--font-heading);margin:.75rem 0;">' + escapeHtml(totalText) + '</p>';
}
html += '<button id="retryPaymentBtn" class="btn btn-accent btn-lg payment-btn" style="font-size:1.1rem;padding:1rem 2.5rem;font-weight:700;cursor:pointer;border:none;">';
html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
html += ' ' + (window.t ? window.t('booking.retry_payment') : 'Retry Payment Link');
html += '</button>';
html += '<p style="font-size:.8rem;color:var(--color-text-muted);margin-top:1rem;">Or contact us at <a href="mailto:info@amanthosliving.com" style="color:var(--color-accent);">info@amanthosliving.com</a></p>';
html += '</div>';
paymentSection.innerHTML = html;
paymentSection.style.display = 'block';
paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
var retryBtn = document.getElementById('retryPaymentBtn');
if (retryBtn) {
retryBtn.addEventListener('click', function () {
retryBtn.disabled = true;
retryBtn.textContent = window.t ? window.t('booking.processing') : 'Processing...';
var retryPayload = {
bookingId: bookingData.confirmationId,
reservationId: bookingData.reservationId || '',
propertyId: bookingData.propertyId || (searchParams ? searchParams.propertyId : ''),
email: email,
totalAmount: selectedOffer && selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0,
currency: selectedOffer && selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
};
fetch(API_BASE + '/api/payment-link', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(retryPayload),
mode: 'cors',
})
.then(function (res) { return res.json(); })
.then(function (linkData) {
if (linkData.paymentLink) {
showPaymentStep(bookingData.confirmationId, linkData.paymentLink, email, bookingData);
} else {
retryBtn.disabled = false;
retryBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> ' + (window.t ? window.t('booking.retry_payment') : 'Retry Payment Link');
showStatus('error', linkData.error || (window.t ? window.t('booking.payment_link_expired') : 'Payment link generation failed. Please contact info@amanthosliving.com.'));
}
})
.catch(function () {
retryBtn.disabled = false;
retryBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> ' + (window.t ? window.t('booking.retry_payment') : 'Retry Payment Link');
showStatus('error', window.t ? window.t('booking.error_connection') : 'Connection error. Please try again.');
});
});
}
}
window.amanthosBooking = {
setSearch: function (params) {
searchParams = params;
fetchOffers();
}
};
})();