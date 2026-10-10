/**
 * Tests der reinen Helfer aus js/glattbrugg-page.js (Bauplan glattbrugg-longstay,
 * Segment 3, Kontrakte K1, K3, K4, K5).
 *
 * Ohne DOM: die Datei exportiert die Funktionen, die Karten, Payload, Kampagne,
 * Kennung, Statustexte, Anreisefenster und Ereignisse erzeugen. Die DOM-Strecke
 * (Rendern, Formular, Erfolg) wird im Harness im Browser geprueft, nicht hier.
 * Die Ereignisse laufen gegen ein Fake-window, das nur aufzeichnet.
 *
 * Alle Werte sind synthetisch (Testperson Muster, test-lead@example.invalid,
 * +41 79 123 45 67). Kein Test ruft einen Produktionsendpunkt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const scriptFile = join(here, '..', 'js', 'glattbrugg-page.js');
const page = require(scriptFile);
const units = require(join(here, '..', 'js', 'glattbrugg-units.js'));
const config = require(join(here, '..', 'js', 'glattbrugg-config.js'));
const src = readFileSync(scriptFile, 'utf8');

// Genau die 18 Schluessel aus K3, in dieser Reihenfolge.
const K3_KEYS = [
  'form', 'name', 'email', 'phone', 'company', 'unit', 'arrival_month', 'duration_months',
  'persons', 'message', 'event_id', 'locale', 'utm_source', 'utm_medium', 'utm_campaign',
  'gclid', 'fbclid', 'company_website'
];

const VOLL = {
  name: '  Testperson Muster  ',
  email: ' test-lead@example.invalid ',
  phone: '+41 79 123 45 67',
  company: 'Beispiel AG',
  unit: 'business',
  arrival: '2026-11',
  duration: '2',
  persons: '2',
  message: 'Testnachricht',
  eventId: 'abcd-1234-efgh-5678',
  lang: 'de',
  campaign: { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'glattbrugg-longstay' },
  gclid: 'Cj0KTEST', fbclid: 'IwARTEST', companyWebsite: ''
};

const listed = units.UNITS.filter((u) => u.listed);
const unlisted = units.UNITS.filter((u) => !u.listed);
const byKey = (k) => units.UNITS.find((u) => u.key === k);

// ---- Modulform ------------------------------------------------------------

test('das Modul exportiert die reinen Helfer und laeuft ohne DOM', () => {
  assert.equal(page.VERSION, '1');
  for (const fn of ['formatChf', 'perNight', 'cardModel', 'buildPayload', 'readCampaign',
    'newEventId', 'statusText', 'localeOf', 'arrivalBounds', 'leadEvents']) {
    assert.equal(typeof page[fn], 'function', `${fn} fehlt im Export`);
  }
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof globalThis.window, 'undefined');
});

// ---- Preise (K1) ----------------------------------------------------------

test('formatChf setzt den Tausender-Apostroph und die Waehrung davor', () => {
  assert.equal(page.formatChf(2100), "CHF 2'100");
  assert.equal(page.formatChf(250), 'CHF 250');
  assert.equal(page.formatChf(12345), "CHF 12'345");
});

test('perNight rundet den Preis je 30 Naechte auf eine Nacht', () => {
  assert.equal(page.perNight(2100), 70);
  assert.equal(page.perNight(2240), 75);
  assert.equal(page.perNight(2300), 77);
  assert.equal(page.perNight(2440), 81);
});

// ---- Karten ---------------------------------------------------------------

test('cardModel liefert fuer jede gelistete Kategorie in de und en beide Preiszeilen und die Eckdaten', () => {
  assert.deepEqual(listed.map((u) => u.key), ['business', 'business-plus']);
  for (const u of listed) {
    for (const lang of ['de', 'en']) {
      const m = page.cardModel(u, lang);
      assert.ok(m, `${u.key}/${lang}: kein Modell`);
      assert.equal(m.key, u.key);
      assert.equal(m.name, u.name);
      assert.equal(m.sqm, u.sqm);
      assert.equal(m.persons, u.maxPersons);
      assert.equal(m.units, u.longstayUnits);
      assert.ok(m.sqmText.includes(String(u.sqm)), 'Flaeche fehlt');
      assert.ok(m.personsText.includes(String(u.maxPersons)), 'Personen fehlen');
      assert.ok(m.unitsText.includes(String(u.longstayUnits)), 'freie Einheiten fehlen');
      assert.equal(m.lines.length, 2);
      assert.deepEqual(m.lines.map((l) => l.price), [u.price30, u.price60]);
      assert.ok(m.lines[0].priceText.includes(page.formatChf(u.price30)));
      assert.ok(m.lines[1].priceText.includes(page.formatChf(u.price60)));
      for (const l of m.lines) {
        assert.ok(l.nightText.includes('CHF ' + page.perNight(l.price)), `${u.key}/${lang}: Nachtpreis`);
        assert.ok(l.label.length > 0);
      }
      assert.ok(m.extraText.includes(page.formatChf(units.EXTRA_PERSON)), 'Zuschlag je Person fehlt');
    }
  }
});

test('cardModel: die Texte stehen in der Sprache der Seite', () => {
  const de = page.cardModel(byKey('business-plus'), 'de');
  const en = page.cardModel(byKey('business-plus'), 'en');
  assert.equal(de.lines[1].priceText, "CHF 2'240 je 30 Nächte");
  assert.equal(de.lines[1].nightText, 'rund CHF 75 pro Nacht');
  assert.equal(en.lines[1].priceText, "CHF 2'240 per 30 nights");
  assert.equal(en.lines[1].nightText, 'about CHF 75 per night');
  assert.equal(de.lines[0].label, '30 bis 59 Nächte');
  assert.equal(de.lines[1].label, '60 bis 89 Nächte');
  assert.equal(en.lines[0].label, '30 to 59 nights');
  assert.equal(en.lines[1].label, '60 to 89 nights');
  assert.equal(page.cardModel(byKey('business'), 'de').lines[1].nightText, 'rund CHF 70 pro Nacht');
});

test('nicht gelistete Kategorien werden nie gerendert', () => {
  assert.equal(unlisted.length, 3);
  for (const u of unlisted) {
    assert.equal(page.cardModel(u, 'de'), null, u.key);
    assert.equal(page.cardModel(u, 'en'), null, u.key);
  }
  // auch ein manipulierter Eintrag ohne Preis oder ohne listed-Flag bleibt draussen
  assert.equal(page.cardModel({ ...byKey('business'), listed: false }, 'de'), null);
  assert.equal(page.cardModel({ ...byKey('business'), price60: null }, 'de'), null);
  assert.equal(page.cardModel(null, 'de'), null);
  assert.equal(page.cardModel(undefined, 'en'), null);
});

// ---- Sprache --------------------------------------------------------------

test('localeOf: en bleibt en, alles andere ist de', () => {
  assert.equal(page.localeOf('en'), 'en');
  assert.equal(page.localeOf('EN-GB'), 'en');
  assert.equal(page.localeOf('de'), 'de');
  assert.equal(page.localeOf('fr'), 'de');
  assert.equal(page.localeOf(''), 'de');
  assert.equal(page.localeOf(undefined), 'de');
});

// ---- K3: Payload ----------------------------------------------------------

test('K3: buildPayload liefert genau die 18 Schluessel in der Reihenfolge des Kontrakts', () => {
  const p = page.buildPayload(VOLL);
  assert.deepEqual(Object.keys(p), K3_KEYS);
  assert.equal(Object.keys(p).length, 18);
  for (const k of K3_KEYS) assert.equal(typeof p[k], 'string', `${k} ist kein String`);
  assert.equal(p.form, 'glattbrugg');
  assert.equal(p.name, 'Testperson Muster');
  assert.equal(p.email, 'test-lead@example.invalid');
  assert.equal(p.company, 'Beispiel AG');
  assert.equal(p.unit, 'business');
  assert.equal(p.arrival_month, '2026-11');
  assert.equal(p.duration_months, '2');
  assert.equal(p.persons, '2');
  assert.equal(p.event_id, 'abcd-1234-efgh-5678');
  assert.equal(p.locale, 'de');
  assert.equal(p.utm_source, 'meta');
  assert.equal(p.gclid, 'Cj0KTEST');
  assert.equal(p.fbclid, 'IwARTEST');
  assert.equal(p.company_website, '');
});

test('K3: ohne Eingabe stehen alle 18 Schluessel mit leerem String da', () => {
  for (const arg of [undefined, null, {}]) {
    const p = page.buildPayload(arg);
    assert.deepEqual(Object.keys(p), K3_KEYS);
    for (const k of K3_KEYS) {
      if (k === 'form') assert.equal(p.form, 'glattbrugg');
      else if (k === 'locale') assert.equal(p.locale, 'de');
      else assert.equal(p[k], '', `${k} muss leer sein`);
    }
  }
});

test('K3: unbekannte unit und duration_months "4" fallen auf ""', () => {
  assert.equal(page.buildPayload({ ...VOLL, unit: 'penthouse' }).unit, '');
  assert.equal(page.buildPayload({ ...VOLL, unit: 'Business' }).unit, '');
  assert.equal(page.buildPayload({ ...VOLL, duration: '4' }).duration_months, '');
  assert.equal(page.buildPayload({ ...VOLL, duration: '0' }).duration_months, '');
  assert.equal(page.buildPayload({ ...VOLL, duration: '12' }).duration_months, '');
  assert.equal(page.buildPayload({ ...VOLL, persons: '4' }).persons, '');
  for (const d of ['1', '2', '3']) assert.equal(page.buildPayload({ ...VOLL, duration: d }).duration_months, d);
  for (const u of units.UNITS) assert.equal(page.buildPayload({ ...VOLL, unit: u.key }).unit, u.key);
});

test('K3: arrival_month nur als YYYY-MM, sonst ""', () => {
  assert.equal(page.buildPayload({ ...VOLL, arrival: '2027-02' }).arrival_month, '2027-02');
  for (const bad of ['2026-13', '2026-00', '2026-1', '26-11', '2026-11-01', 'November', '']) {
    assert.equal(page.buildPayload({ ...VOLL, arrival: bad }).arrival_month, '', bad);
  }
});

test('K3: locale kommt aus lang', () => {
  assert.equal(page.buildPayload({ ...VOLL, lang: 'en' }).locale, 'en');
  assert.equal(page.buildPayload({ ...VOLL, lang: 'de' }).locale, 'de');
  assert.equal(page.buildPayload({ ...VOLL, lang: 'fr' }).locale, 'de');
  assert.equal(page.buildPayload({ ...VOLL, lang: undefined }).locale, 'de');
});

test('K3: Laengen werden wie im Backend gekuerzt', () => {
  const p = page.buildPayload({
    ...VOLL, name: 'n'.repeat(300), phone: '1'.repeat(80), company: 'c'.repeat(300),
    message: 'm'.repeat(6000), gclid: 'g'.repeat(700), fbclid: 'f'.repeat(700)
  });
  assert.equal(p.name.length, 200);
  assert.equal(p.phone.length, 40);
  assert.equal(p.company.length, 200);
  assert.equal(p.message.length, 5000);
  assert.equal(p.gclid.length, 512);
  assert.equal(p.fbclid.length, 512);
});

test('K3: ein gefuellter Honigtopf wird unveraendert durchgereicht, damit das Backend ihn erkennt', () => {
  assert.equal(page.buildPayload({ ...VOLL, companyWebsite: 'https://spam.invalid' }).company_website,
    'https://spam.invalid');
});

test('K3: ungueltige utm-Werte in buildPayload werden einzeln verworfen', () => {
  const p = page.buildPayload({
    ...VOLL, campaign: { utm_source: 'meta', utm_medium: 'a b', utm_campaign: '<x>' }
  });
  assert.equal(p.utm_source, 'meta');
  assert.equal(p.utm_medium, '');
  assert.equal(p.utm_campaign, '');
});

// ---- Kampagne -------------------------------------------------------------

test('readCampaign liest die drei utm-Werte aus der URL', () => {
  assert.deepEqual(
    page.readCampaign('?utm_source=meta&utm_medium=paid&utm_campaign=glattbrugg-longstay'),
    { utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'glattbrugg-longstay' });
  assert.deepEqual(page.readCampaign(''), { utm_source: '', utm_medium: '', utm_campaign: '' });
  assert.deepEqual(page.readCampaign(undefined), { utm_source: '', utm_medium: '', utm_campaign: '' });
});

test('readCampaign verwirft ungueltige utm-Werte einzeln', () => {
  const c = page.readCampaign('?utm_source=google&utm_medium=a%20b&utm_campaign=' + 'x'.repeat(65));
  assert.equal(c.utm_source, 'google');
  assert.equal(c.utm_medium, '');
  assert.equal(c.utm_campaign, '');
  assert.equal(page.readCampaign('?utm_source=<script>').utm_source, '');
  assert.equal(page.readCampaign('?utm_source=' + 'x'.repeat(64)).utm_source.length, 64);
  assert.equal(page.readCampaign('?utm_source=a.b_c-d').utm_source, 'a.b_c-d');
});

test('readCampaign traegt keine Klick-IDs (die kommen nur ueber amMeta)', () => {
  const c = page.readCampaign('?gclid=Cj0KTEST&fbclid=IwARTEST&utm_source=meta');
  assert.deepEqual(Object.keys(c), ['utm_source', 'utm_medium', 'utm_campaign']);
});

// ---- Kennung --------------------------------------------------------------

test('newEventId passt auf das Muster des Backends und ist je Aufruf neu', () => {
  const re = /^[A-Za-z0-9-]{8,64}$/;
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const id = page.newEventId();
    assert.match(id, re);
    ids.add(id);
  }
  assert.equal(ids.size, 50);
});

test('newEventId faellt ohne randomUUID auf eine eigene Kennung zurueck, die ebenfalls passt', () => {
  const re = /^[A-Za-z0-9-]{8,64}$/;
  for (const c of [{}, { randomUUID: null }, { randomUUID() { throw new Error('nein'); } }]) {
    const id = page.newEventId(c);
    assert.match(id, re);
    assert.ok(id.startsWith('g-'), id);
  }
});

// ---- Statustexte ----------------------------------------------------------

test('statusText kennt 200, 400, 429, 502, 503 und Netzfehler in de und en', () => {
  const de = (s) => page.statusText(s, 'de');
  const en = (s) => page.statusText(s, 'en');
  assert.equal(de(200), 'Vielen Dank. Wir melden uns persönlich bei Ihnen.');
  assert.equal(en(200), 'Thank you. We will get back to you personally.');
  assert.equal(de(400), 'Bitte prüfen Sie Name und E-Mail-Adresse.');
  assert.equal(en(400), 'Please check your name and email address.');
  assert.equal(de(429), 'Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einer Minute erneut.');
  assert.equal(en(429), 'Too many requests in a short time. Please try again in a minute.');
  const deFail = 'Die Anfrage konnte nicht gesendet werden. Rufen Sie uns an: '
    + config.PHONE + ', oder schreiben Sie an ' + config.EMAIL + '.';
  const enFail = 'Your request could not be sent. Please call us on ' + config.PHONE
    + ' or write to ' + config.EMAIL + '.';
  for (const s of [502, 503, 0, undefined, null]) {
    assert.equal(de(s), deFail, `de ${s}`);
    assert.equal(en(s), enFail, `en ${s}`);
  }
});

test('statusText gibt nie einen Servertext aus und faellt ohne Sprache auf de', () => {
  assert.equal(page.statusText(502), page.statusText(502, 'de'));
  assert.equal(page.statusText(200), page.statusText(200, 'de'));
  assert.equal(page.statusText(500, 'de'), page.statusText(502, 'de'));
  assert.equal(page.statusText(413, 'en'), page.statusText(503, 'en'));
});

// ---- Anreisefenster -------------------------------------------------------

test('arrivalBounds: laufender Monat bis plus zwoelf', () => {
  assert.deepEqual(page.arrivalBounds(new Date(2026, 9, 10)), { min: '2026-10', max: '2027-10' });
  assert.deepEqual(page.arrivalBounds(new Date(2026, 0, 31)), { min: '2026-01', max: '2027-01' });
  assert.deepEqual(page.arrivalBounds(new Date(2026, 11, 1)), { min: '2026-12', max: '2027-12' });
  assert.deepEqual(page.arrivalBounds(new Date(2026, 4, 15)), { min: '2026-05', max: '2027-05' });
});

// ---- K4: Ereignisse -------------------------------------------------------

// Fake-window, das nur aufzeichnet. Wer die Einwilligung dreht, baut ein neues.
function fakeWindow(opts) {
  const o = opts || {};
  const w = { gtagCalls: [], fbqCalls: [], plausibleCalls: [] };
  w.gtag = function () { w.gtagCalls.push(Array.prototype.slice.call(arguments)); };
  if (o.fbq !== false) w.fbq = function () { w.fbqCalls.push(Array.prototype.slice.call(arguments)); };
  if (o.plausible !== false) w.plausible = function () { w.plausibleCalls.push(Array.prototype.slice.call(arguments)); };
  w.amConsent = { get: () => (o.consent === undefined ? 'granted' : o.consent) };
  return w;
}

function mitFenster(w, fn) {
  globalThis.window = w;
  try { fn(); } finally { delete globalThis.window; }
}

const PAYLOAD = () => page.buildPayload(VOLL);
const events = (w) => w.gtagCalls.filter((c) => c[0] === 'event');

test('K4: generate_lead feuert immer, ohne Name, E-Mail, Telefon, Firma oder Nachricht', () => {
  for (const consent of ['granted', 'denied', null]) {
    const w = fakeWindow({ consent });
    mitFenster(w, () => page.leadEvents(PAYLOAD(), {}));
    const lead = events(w).filter((c) => c[1] === 'generate_lead');
    assert.equal(lead.length, 1, String(consent));
    assert.deepEqual(lead[0][2], { lead_form: 'glattbrugg', unit: 'business', duration_months: '2', locale: 'de' });
    const alles = JSON.stringify(w.gtagCalls) + JSON.stringify(w.fbqCalls) + JSON.stringify(w.plausibleCalls);
    for (const pii of ['Testperson', 'example.invalid', '+41 79', 'Beispiel AG', 'Testnachricht']) {
      assert.ok(!alles.includes(pii), `PII im Ereignis: ${pii}`);
    }
  }
});

test('K4: ohne Einwilligung keine Conversion, kein Meta-Lead; Plausible laeuft trotzdem', () => {
  for (const consent of ['denied', null, undefined]) {
    const w = fakeWindow({ consent: consent === undefined ? 'unbekannt' : consent });
    mitFenster(w, () => page.leadEvents(PAYLOAD(), { ADS_SEND_TO: 'AW-000/test', CONTENT_NAME: 'x' }));
    assert.equal(events(w).filter((c) => c[1] === 'conversion').length, 0, String(consent));
    assert.equal(w.fbqCalls.length, 0, String(consent));
    assert.equal(w.plausibleCalls.length, 1, String(consent));
  }
});

test('K4: mit Einwilligung und gesetztem ADS_SEND_TO feuert die Conversion, mit leerem nicht', () => {
  const mit = fakeWindow();
  mitFenster(mit, () => page.leadEvents(PAYLOAD(), { ADS_SEND_TO: 'AW-000/test' }));
  assert.deepEqual(events(mit).filter((c) => c[1] === 'conversion').map((c) => c[2]), [{ send_to: 'AW-000/test' }]);

  for (const leer of ['', undefined]) {
    const ohne = fakeWindow();
    mitFenster(ohne, () => page.leadEvents(PAYLOAD(), { ADS_SEND_TO: leer }));
    assert.equal(events(ohne).filter((c) => c[1] === 'conversion').length, 0, String(leer));
  }
});

test('K4: Meta Lead mit eventID gleich event_id und content_name aus der Konfiguration', () => {
  const w = fakeWindow();
  mitFenster(w, () => page.leadEvents(PAYLOAD(), { CONTENT_NAME: config.CONTENT_NAME }));
  assert.deepEqual(w.fbqCalls, [['track', 'Lead', { content_name: 'glattbrugg-longstay' },
    { eventID: 'abcd-1234-efgh-5678' }]]);
});

test('K4: Plausible Lead traegt props.form und locale', () => {
  const w = fakeWindow();
  mitFenster(w, () => page.leadEvents(page.buildPayload({ ...VOLL, lang: 'en' }), {}));
  assert.deepEqual(w.plausibleCalls, [['Lead', { props: { form: 'glattbrugg', locale: 'en' } }]]);
});

test('K4: fehlende Kanaele werfen nicht', () => {
  const w = fakeWindow({ fbq: false, plausible: false });
  assert.doesNotThrow(() => mitFenster(w, () => page.leadEvents(PAYLOAD(), { ADS_SEND_TO: 'AW-000/test' })));
  assert.equal(w.fbqCalls.length, 0);
  assert.doesNotThrow(() => mitFenster({}, () => page.leadEvents(PAYLOAD(), {})));
  assert.doesNotThrow(() => mitFenster({
    gtag() { throw new Error('x'); }, plausible() { throw new Error('x'); },
    amConsent: { get() { throw new Error('x'); } }
  }, () => page.leadEvents(PAYLOAD(), {})));
});

// ---- Quelltext ------------------------------------------------------------

test('der Quelltext traegt keinen Preis aus K1, kein Speichern im Browser und keine Klick-IDs aus der URL', () => {
  const ohneKommentare = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const preise = units.UNITS.flatMap((u) => [u.price30, u.price60])
    .concat([units.EXTRA_PERSON]).filter((p) => p !== null);
  for (const p of new Set(preise)) {
    assert.ok(!new RegExp('\\b' + p + '\\b').test(src), `Preis ${p} im Quelltext`);
  }
  assert.ok(!/\d['’]\d{3}/.test(src), 'Zahl mit Tausender-Apostroph im Quelltext');
  assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(ohneKommentare), 'Speichern im Browser');
  assert.ok(!/URLSearchParams[^;]*gclid/.test(ohneKommentare), 'gclid aus der URL gelesen');
  assert.ok(!src.includes(String.fromCharCode(0x2014)), 'Gedankenstrich im Quelltext');
  assert.ok(src.split('\n').length <= 400, 'mehr als 400 Zeilen');
});

test('der Quelltext liest gclid und fbclid nur ueber amMeta.tracking()', () => {
  assert.ok(/amMeta\.tracking\(\)/.test(src));
  // readCampaign kennt nur die drei utm-Schluessel
  assert.deepEqual(Object.keys(page.readCampaign('?gclid=a&fbclid=b')), ['utm_source', 'utm_medium', 'utm_campaign']);
});
