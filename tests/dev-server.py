#!/usr/bin/env python3
"""Test-Harness fuer die Browserpruefung (Deep-Link K7, Grenchen K8, Wohnen auf
Zeit und Nyon FR nach K9 des Plans living-wohnen-nyon-fr, Glattbrugg Longstay
nach K14 des Plans glattbrugg-longstay).

Serviert das Repo-Verzeichnis und schreibt beim Ausliefern ausschliesslich im
Speicher um: API-Host auf die gleiche Origin, Script-Tag fuer deeplink.js vor
booking.js, gtag-Stub mit window.__gtagCalls. Beantwortet /health, /api/offers
aus tests/fixtures/offers-<code>-<nights>.json (wenn vorhanden, sonst
offers-<code>.json) und /api/bookings synthetisch.

Fuer die Seiten grenchen-mieten, zurich, appartements-nyon und die Skelette
kommt derselbe Gedanke ein zweites Mal: die Seite bekommt vor </head> einen
Stub, der die API auf die gleiche Origin zeigen laesst und gtag und fbq
mitschreibt (window.__gtagCalls, window.__fbqCalls). Der fbq-Stub verhindert
nebenbei, dass js/meta.js das echte Pixel nachlaedt; dessen Loader bricht ab,
sobald window.fbq existiert. Mit ?contact=fail beziehungsweise ?contact=429
haengt ein fetch-Wrapper fail=502 oder fail=429 an die Anfrage, damit die
Fehlertexte pruefbar sind; mit ?fixture=empty haengt er fixture=empty an
/api/offers, damit der Rueckfall ohne Angebote pruefbar ist. POST /api/contact
antwortet danach mit 502, 429 oder 200 und druckt den Body als CONTACT-BODY.

Legt nie eine Datei an und ist kein Produktivcode.
Aufruf: python3 tests/dev-server.py [port]
"""
import json
import os
import sys
from datetime import date
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES = os.path.join(ROOT, "tests", "fixtures")
LIVE_API = "https://amanthos-website-api.onrender.com"
BOOKING_TAG = '<script src="./js/booking.js" defer></script>'
HARNESS = (
    "<script>"
    "(function(){var prev=window.gtag;window.__gtagCalls=[];"
    "window.gtag=function(){window.__gtagCalls.push(Array.prototype.slice.call(arguments));"
    "if(prev){try{prev.apply(null,arguments);}catch(e){}}};"
    "if(location.search.indexOf('fixture=empty')!==-1){var f=window.fetch;"
    "window.fetch=function(u,o){"
    "return f(typeof u==='string'&&u.indexOf('/api/offers')!==-1?u+'&fixture=empty':u,o);};}"
    "})();</script>\n"
    '  <script src="./js/deeplink.js" defer></script>\n  '
)
# Seiten, die den Stub vor </head> bekommen (K9): URL-Pfad zu Datei im Repo.
STUBBED_PAGES = {
    "/grenchen-mieten/": os.path.join("grenchen-mieten", "index.html"),
    "/grenchen-mieten/index.html": os.path.join("grenchen-mieten", "index.html"),
    "/tests/fixtures/grenchen-skeleton.html": os.path.join("tests", "fixtures", "grenchen-skeleton.html"),
    "/zurich/": os.path.join("zurich", "index.html"),
    "/zurich/index.html": os.path.join("zurich", "index.html"),
    "/tests/fixtures/longstay-skeleton.html": os.path.join("tests", "fixtures", "longstay-skeleton.html"),
    "/appartements-nyon/": os.path.join("appartements-nyon", "index.html"),
    "/appartements-nyon/index.html": os.path.join("appartements-nyon", "index.html"),
    # Glattbrugg Longstay (K14 des Plans glattbrugg-longstay): zwei Seiten und das Skelett.
    "/longstay-zuerich-flughafen/": os.path.join("longstay-zuerich-flughafen", "index.html"),
    "/longstay-zuerich-flughafen/index.html": os.path.join("longstay-zuerich-flughafen", "index.html"),
    "/long-stay-zurich-airport/": os.path.join("long-stay-zurich-airport", "index.html"),
    "/long-stay-zurich-airport/index.html": os.path.join("long-stay-zurich-airport", "index.html"),
    "/tests/fixtures/glattbrugg-skeleton.html": os.path.join("tests", "fixtures", "glattbrugg-skeleton.html"),
}
GRENCHEN_STUB = (
    "<script>"
    "(function(){window.AMANTHOS_API_BASE='';"
    "var g=window.gtag;window.__gtagCalls=[];"
    "window.gtag=function(){window.__gtagCalls.push(Array.prototype.slice.call(arguments));"
    "if(g){try{g.apply(null,arguments);}catch(e){}}};"
    "window.__fbqCalls=[];"
    "window.fbq=function(){window.__fbqCalls.push(Array.prototype.slice.call(arguments));};"
    "window.fbq.loaded=true;window.fbq.version='2.0';window.fbq.queue=[];window._fbq=window.fbq;"
    "var m=/[?&]contact=(fail|429)/.exec(location.search);"
    "var e=/[?&]fixture=empty/.test(location.search);"
    "if(m||e){var f=window.fetch;var q=m?(m[1]==='429'?'fail=429':'fail=502'):'';"
    "window.fetch=function(u,o){"
    "if(typeof u==='string'){"
    "if(m&&u.indexOf('/api/contact')!==-1){u+=(u.indexOf('?')===-1?'?':'&')+q;}"
    "if(e&&u.indexOf('/api/offers')!==-1){u+=(u.indexOf('?')===-1?'?':'&')+'fixture=empty';}}"
    "return f(u,o);};}"
    "})();</script>\n</head>"
)


def read(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as handle:
        return handle.read()


class Harness(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def log_message(self, fmt, *args):
        pass  # zu laut; interessant ist allein der Buchungs-Body unten

    def _json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _text(self, body, ctype):
        raw = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        if parsed.path == "/health":
            return self._json({"status": "ok"})
        if parsed.path == "/api/offers":
            return self._offers(query)
        if parsed.path in ("/", "/index.html"):
            html = read(ROOT, "index.html").replace(BOOKING_TAG, HARNESS + BOOKING_TAG, 1)
            return self._text(html, "text/html; charset=utf-8")
        if parsed.path in STUBBED_PAGES:
            return self._stubbed(STUBBED_PAGES[parsed.path])
        if parsed.path == "/js/booking.js":
            src = read(ROOT, "js", "booking.js").replace(LIVE_API, "")
            return self._text(src, "application/javascript; charset=utf-8")
        return super().do_GET()

    # Der Stub geht vor </head>, damit AMANTHOS_API_BASE steht, bevor irgendein
    # defer-Skript laeuft. Fehlt die Seite noch (appartements-nyon bis Segment 3),
    # sagt der Harness das deutlich, statt ein Verzeichnis aufzulisten.
    def _stubbed(self, relpath):
        pfad = os.path.join(ROOT, relpath)
        if not os.path.exists(pfad):
            return self.send_error(404, "%s fehlt noch" % relpath)
        html = read(pfad)
        if "</head>" in html:
            html = html.replace("</head>", GRENCHEN_STUB, 1)
        return self._text(html, "text/html; charset=utf-8")

    # Angebote nach Naechten (K9): fuer 30 Naechte bei GBAL liegt
    # offers-gbal-30.json, sonst gilt offers-<code>.json wie bisher. Die Naechte
    # kommen aus arrival und departure der Anfrage.
    def _offers(self, query):
        code = (query.get("propertyId") or [""])[0]
        arrival = (query.get("arrival") or [""])[0]
        departure = (query.get("departure") or [""])[0]
        try:
            nights = (date.fromisoformat(departure) - date.fromisoformat(arrival)).days
        except ValueError:
            nights = None
        path = os.path.join(FIXTURES, "offers-%s-%s.json" % (code.lower(), nights))
        if nights is None or not os.path.exists(path):
            path = os.path.join(FIXTURES, "offers-%s.json" % code.lower())
        data = json.loads(read(path)) if os.path.exists(path) else {"offers": []}
        data["property"] = code.upper()
        data["propertyName"] = data.get("propertyName", code.upper())
        data["arrival"] = arrival or data.get("arrival", "")
        data["departure"] = departure or data.get("departure", "")
        data["adults"] = int((query.get("adults") or ["2"])[0])
        try:
            data["nights"] = (
                date.fromisoformat(data["departure"]) - date.fromisoformat(data["arrival"])
            ).days
        except ValueError:
            data["nights"] = 1
        if "empty" in query.get("fixture", []):
            data["offers"] = []
        return self._json(data)

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        parsed = urlparse(self.path)
        if parsed.path == "/api/contact":
            return self._contact(raw, parse_qs(parsed.query))
        if parsed.path != "/api/bookings":
            return self._json({"error": "unbekannter Pfad"}, 404)
        return self._booking(raw)

    # Mock fuer POST /api/contact (K8). fail=502 und fail=429 kommen aus dem
    # fetch-Wrapper des Stubs; ohne fail wird der Body gedruckt, damit sich der
    # Payload nach K3 im Terminal pruefen laesst. Schreibt nichts auf die Platte.
    def _contact(self, raw, query):
        fail = (query.get("fail") or [""])[0]
        if fail == "502":
            return self._json({"error": "Mailversand fehlgeschlagen"}, 502)
        if fail == "429":
            return self._json({"error": "Zu viele Anfragen"}, 429)
        print("CONTACT-BODY " + raw, flush=True)
        return self._json({"ok": True})

    def _booking(self, raw):
        print("BOOKING-BODY " + raw, flush=True)
        try:
            property_id = json.loads(raw).get("propertyId", "")
        except ValueError:
            property_id = ""
        return self._json({
            "success": True,
            "confirmationId": "TEST-0001",
            "reservationId": "TEST-RES-0001",
            "propertyId": property_id,
            "paymentRequired": False,
        })


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print("Harness auf http://localhost:%d (Repo %s)" % (port, ROOT), flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), Harness).serve_forever()
