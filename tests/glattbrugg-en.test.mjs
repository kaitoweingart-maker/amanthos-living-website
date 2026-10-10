/**
 * Segment 2: englische Seite long-stay-zurich-airport/index.html
 * (Bauplan glattbrugg-longstay, Kontrakte K5 und K7).
 *
 * Statische Pruefungen der Datei. Jeder Punkt der Akzeptanzkriterien von Segment 2
 * hat einen eigenen Test, damit ein roter Lauf sagt, welche Zusage gebrochen ist.
 * Browserbelege (Harness, Konsole, axe, Lighthouse, 360 px) stehen im Bericht, nicht
 * hier; wo ein Kriterium davon abhaengt, prueft der Test den statischen Anteil und
 * sagt das im Namen.
 *
 * Die Seite wird gegen den Kontrakt gebaut: tests/fixtures/glattbrugg-dom-contract.json
 * (IDs, Kopfreihenfolge, Pflichtmuster) und das Faktenblatt K7, Spalte Englisch. Die
 * Gegenprobe der Erkennung (negative Beispiele) steht im selben Test wie die Pruefung.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const lies = (...teile) => readFileSync(join(root, ...teile), 'utf8');

const dom = JSON.parse(lies('tests', 'fixtures', 'glattbrugg-dom-contract.json'));
const config = require(join(root, 'js', 'glattbrugg-config.js'));
const units = require(join(root, 'js', 'glattbrugg-units.js'));
const PAGE = dom.pages.en;
const html = lies(PAGE);
const nyon = lies(dom.csp_source);

const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
const attr = (tag, name) => {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
};
const countId = (h, id) => (h.match(new RegExp('\\bid="' + id + '"', 'g')) || []).length;
const cspOf = (h) => /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(h)[1];

// Sichtbarer Text: Skripte, Styles, Kommentare und Tags weg, Leerraum zusammengezogen.
const sichtbar = (h) => h
  .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;| /g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

// Preiszahlen, die im HTML nie stehen duerfen: jeder Preis aus K1, jede Zahl mit
// Tausender-Apostroph und jeder CHF-Betrag ab 100. "CHF 10" (Parkplatz) bleibt erlaubt.
function preisTreffer(h) {
  const k1 = units.UNITS.flatMap((u) => [u.price30, u.price60]).filter((p) => p !== null);
  const muster = [/\b\d{1,3}['’]\d{3}\b/g, /CHF\s*\d{3,}/g,
    new RegExp('\\b(' + [...new Set(k1)].join('|') + ')\\b', 'g')];
  return muster.flatMap((re) => h.match(re) || []);
}

// K7, Spalte Englisch (Faktenblatt im Bauplan). Nr 13 und 17 verweisen auf K1 und K2 und
// stehen deshalb nicht als Satz hier.
const K7_EN = {
  P1: 'Hotel stay of 30 to a maximum of 89 nights',
  P2: 'Final cleaning is included',
  P3: 'Bed linen and towels are ready on arrival',
  P4: 'Cleaning and linen change during your stay can be booked at an extra charge',
  P5: 'You complete the registration form on arrival',
  P6: 'Digital check-in around the clock',
  P7: 'Prices are gross, incl. 3.8 % VAT',
  P8: 'There is no laundry room in the building',
  9: 'Furnished suite with fully equipped kitchen, desk workspace, Smart TV, fast Wi-Fi',
  10: 'Oberhauserstrasse 30, 8152 Glattbrugg; lift in the building',
  11: '1 km to Zurich Airport, 9.4 km to Zurich main station, 0.8 km to Glatt, 11 km to ETH',
  12: 'Private parking, CHF 10 per day',
  15: 'Payment in advance for each 30 days',
  16: 'Companies: terms for four suites or more on request'
};
const K7_TEXTE = Object.values(K7_EN).map((s) => s.toLowerCase());

// Aussagen der Seite, die K7 nicht wortgleich traegt, sondern aus K7-Teilen oder K2 setzt.
// Jede steht hier einzeln und wird im Bericht genannt.
const KOMPOSIT = [
  'Glattbrugg, 1 km to Zurich Airport', // Zeile 10 und 11 zusammengezogen (Hero-Zeile)
  `Prices on request: ${config.PHONE} or ${config.EMAIL}`, // "Unbekanntes heisst on request" plus K7 Nr 17 (noscript)
  `Call us on ${config.PHONE} or write to ${config.EMAIL}`, // K7 Nr 17
  'Tell us which category, arrival and length of stay you have in mind' // Formularhinweis, keine Sachaussage
].map((s) => s.toLowerCase());

const saetze = (text) => text.replace(/<strong>[\s\S]*?<\/strong>/g, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ').trim()
  .split(/(?<=\.)\s+/).map((s) => s.replace(/\.$/, '').trim()).filter(Boolean);

// Sachaussagen der Seite: Hero, Untertitel, Listen, noscript, Kontaktzeile.
function aussagen(h) {
  const blocke = [
    ...[...h.matchAll(/<div class="g-hero-inner">([\s\S]*?)<div class="g-cta-row">/g)].flatMap((m) =>
      [...m[1].matchAll(/<p>([\s\S]*?)<\/p>/g)].map((p) => p[1])),
    ...[...h.matchAll(/<p class="section-subtitle">([\s\S]*?)<\/p>/g)].map((m) => m[1]),
    ...[...h.matchAll(/<ul class="gb-facts">([\s\S]*?)<\/ul>/g)].flatMap((m) =>
      [...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((l) => l[1])),
    ...[...h.matchAll(/<noscript>\s*<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => m[1]),
    ...[...h.matchAll(/<div class="container container-narrow g-kontakt">[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/g)]
      .map((m) => m[1])
  ];
  return blocke.flatMap(saetze);
}
const istK7 = (s) => {
  const k = s.toLowerCase();
  return K7_TEXTE.some((t) => t.includes(k)) || KOMPOSIT.includes(k);
};

function optionen(h, id) {
  const m = new RegExp('<select\\b[^>]*\\bid="' + id + '"[^>]*>([\\s\\S]*?)</select>').exec(h);
  assert.ok(m, `${id} ist kein <select>`);
  return [...m[1].matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)].map((o) => o[1]);
}

// ---- Kriterium 1: Suite und Kontrakttest ------------------------------------

test('Kriterium 1: die Seite liegt am Kontraktpfad, damit der K5-Teil des Kontrakttests fuer en laeuft', () => {
  assert.equal(PAGE, 'long-stay-zurich-airport/index.html');
  assert.ok(existsSync(join(root, PAGE)));
  const kontrakt = lies('tests', 'glattbrugg-contract.test.mjs');
  assert.match(kontrakt, /\['en', 2\]/, 'der Kontrakttest kennt Segment 2 nicht');
  assert.match(html, /^<!DOCTYPE html>\s*<html lang="en">/);
});

test('Kriterium 1: jeder Punkt der Kriterienliste hat in dieser Datei einen eigenen Test', () => {
  const quelle = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  for (const nr of [1, 2, 3, 4, 5, 6, 7]) {
    assert.match(quelle, new RegExp("test\\('Kriterium " + nr + ':'), `Kriterium ${nr} ohne Test`);
  }
});

// ---- Kriterium 2: Kopf ------------------------------------------------------

test('Kriterium 2: die CSP ist das erste Element im head und byte-gleich mit nyon-louer (md5)', () => {
  const kopf = html.slice(html.indexOf('<head>') + 6).replace(/^(\s|<!--[\s\S]*?-->)*/, '');
  assert.ok(kopf.startsWith('<meta http-equiv="Content-Security-Policy"'), 'CSP ist nicht das erste Element');
  assert.equal((html.match(/http-equiv="Content-Security-Policy"/g) || []).length, 1);
  assert.equal(cspOf(html), cspOf(nyon));
  assert.equal(md5(cspOf(html)), md5(cspOf(nyon)));
});

test('Kriterium 2: lang="en" am html-Element', () => {
  assert.equal(attr(/<html\b[^>]*>/.exec(html)[0], 'lang'), 'en');
});

test('Kriterium 2: robots ist genau einmal noindex, nofollow', () => {
  const robots = html.match(/<meta\b[^>]*\bname="robots"[^>]*>/g) || [];
  assert.equal(robots.length, 1);
  assert.equal(attr(robots[0], 'content'), 'noindex, nofollow');
});

test('Kriterium 2: canonical zeigt auf die Seite selbst', () => {
  const canonical = /<link\b[^>]*\brel="canonical"[^>]*>/.exec(html);
  assert.equal(canonical && attr(canonical[0], 'href'), config.PAGE_URL_EN);
  assert.equal(config.PAGE_URL_EN, 'https://www.amanthosliving.com/' + dirname(PAGE) + '/');
});

test('Kriterium 2: hreflang de auf die deutsche Seite, en und x-default auf diese Seite', () => {
  const alt = {};
  for (const m of html.matchAll(/<link\b[^>]*\brel="alternate"[^>]*>/g)) alt[attr(m[0], 'hreflang')] = attr(m[0], 'href');
  assert.deepEqual(alt, { de: config.PAGE_URL_DE, en: config.PAGE_URL_EN, 'x-default': config.PAGE_URL_EN });
});

test('Kriterium 2: Kopf in der Reihenfolge des Kontrakts (head_order)', () => {
  const pos = dom.head_order.map((s) => html.indexOf(s));
  pos.forEach((p, i) => assert.ok(p >= 0, `${dom.head_order[i]} fehlt`));
  for (let i = 1; i < pos.length; i++) {
    assert.ok(pos[i] > pos[i - 1], `${dom.head_order[i]} muss nach ${dom.head_order[i - 1]} kommen`);
  }
  assert.ok(pos.at(-1) < html.indexOf('</head>'));
});

test('Kriterium 2: Titel aus K7, Beschreibung aus K7-Aussagen, JSON-LD ohne Preis und Bewertung', () => {
  assert.match(html, /<title>Long stay suites at Zurich Airport, up to 89 nights \| Amanthos Living<\/title>/);
  const beschreibung = attr(/<meta\b[^>]*\bname="description"[^>]*>/.exec(html)[0], 'content');
  for (const s of saetze(beschreibung.replace(/^Furnished suites in Glattbrugg, /, ''))) {
    assert.ok(istK7(s), `Beschreibung: "${s}" steht nicht in K7`);
  }
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(ld['@type'], 'LodgingBusiness');
  assert.equal(ld.url, config.PAGE_URL_EN);
  assert.equal(ld.telephone, config.PHONE);
  assert.equal(ld.priceRange, undefined);
  assert.equal(ld.aggregateRating, undefined);
});

test('Kriterium 2: die Nav verweist auf die Schwesterseite mit lang und hreflang de', () => {
  const nav = /<nav\b[\s\S]*?<\/nav>/.exec(html)[0];
  const link = [...nav.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]).find((a) => attr(a, 'href') === '../longstay-zuerich-flughafen/');
  assert.ok(link, 'Link auf ../longstay-zuerich-flughafen/ fehlt');
  assert.equal(attr(link, 'lang'), 'de');
  assert.equal(attr(link, 'hreflang'), 'de');
  for (const anker of ['#suiten', '#anfrage', '#lage', '#faq']) assert.ok(nav.includes('href="' + anker + '"'), anker);
});

// ---- Kriterium 3: Skripte, IDs, leere Karten, kein Preis --------------------

test('Kriterium 3: Skripte am Ende genau nach K5, alle defer, nichts Verbotenes, plausible.init()', () => {
  const body = html.slice(html.indexOf('<body'));
  const liste = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => ({
    src: m[1].replace(/^(\.\.\/)+/, ''), defer: /\sdefer(\s|>)/.test(m[0])
  }));
  assert.deepEqual(liste.map((s) => s.src), dom.scripts_end);
  for (const s of liste) assert.ok(s.defer, `${s.src} ohne defer`);
  for (const wort of dom.forbidden) assert.ok(!html.includes(wort), `${wort} darf nicht vorkommen`);
  assert.match(html, /plausible\.init\(\)/);
  assert.match(html, /<script src="\.\.\/js\/consent\.js"><\/script>/);
  assert.match(html, /<script defer src="\.\.\/js\/meta\.js"><\/script>/);
});

test('Kriterium 3: jede ID aus dem Fixture genau einmal, jeder Abschnitt einmal in Reihenfolge', () => {
  for (const id of [...dom.ids, ...dom.sections]) assert.equal(countId(html, id), 1, `ID ${id}`);
  const pos = [html.search(new RegExp('<section\\b[^>]*class="[^"]*\\b' + dom.hero + '\\b')),
    ...dom.sections.map((id) => html.search(new RegExp('<section\\b[^>]*\\bid="' + id + '"'))),
    html.search(/<footer\b[^>]*class="[^"]*\bfooter\b/)];
  pos.forEach((p, i) => assert.ok(p >= 0, `Abschnitt ${i} fehlt`));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1], `Abschnitt ${i} steht zu frueh`);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
});

test('Kriterium 3: Felder tragen Tag, Attribute und Optionen des Kontrakts, gb-success ist verborgen', () => {
  for (const [id, spec] of Object.entries(dom.fields)) {
    const m = new RegExp('<' + spec.tag + '\\b[^>]*\\bid="' + id + '"[^>]*>').exec(html);
    assert.ok(m, `${id} ist kein <${spec.tag}>`);
    for (const [name, value] of Object.entries(spec.attrs)) {
      if (value === '') assert.match(m[0], new RegExp('\\s' + name + '(\\s|>|=)'), `${id} ohne ${name}`);
      else assert.equal(attr(m[0], name), value, `${id} ${name}`);
    }
  }
  assert.match(html, /<div\b[^>]*\bid="gb-success"[^>]*\shidden(\s|>)/);
  assert.match(html, /<div class="hp" aria-hidden="true">(?:(?!<\/div>)[\s\S])*\bid="gb-company-website"/);
});

test('Kriterium 3: gb-cards ist leer, gb-unit hat nur die leere Option, Dauer 1 bis 3 und Personen 1 bis 3', () => {
  assert.match(html, /<div\b[^>]*\bid="gb-cards"[^>]*>\s*<\/div>/);
  assert.match(html, /<p\b[^>]*\bid="gb-price-note"[^>]*>\s*<\/p>/);
  assert.deepEqual(optionen(html, 'gb-unit'), ['']);
  assert.deepEqual(optionen(html, 'gb-duration'), ['', '1', '2', '3']);
  assert.deepEqual(optionen(html, 'gb-persons'), ['1', '2', '3']);
  assert.match(html, /\bid="gb-status"[^>]*role="status"/);
});

test('Kriterium 3: kein Preis aus K1, kein CHF-Betrag ab 100, keine Zahl mit Tausenderzeichen (mit Gegenprobe)', () => {
  assert.deepEqual(preisTreffer(html), []);
  // Gegenprobe: die Erkennung schlaegt bei jedem Preis an und laesst den Parkplatz durch.
  for (const k1 of units.UNITS.flatMap((u) => [u.price30, u.price60]).filter((p) => p !== null)) {
    assert.ok(preisTreffer('<p>' + k1 + '</p>').length > 0, 'K1-Preis ' + k1 + ' wird nicht erkannt');
  }
  assert.ok(preisTreffer("<p>CHF 2'100</p>").length > 0);
  assert.ok(preisTreffer('<p>CHF 100</p>').length > 0);
  assert.deepEqual(preisTreffer('<p>Private parking, CHF 10 per day</p>'), []);
  assert.ok(html.includes('Private parking, CHF 10 per day'));
});

test('Kriterium 3: die Einheit des Aufenthalts ist Naechte, nie Monate', () => {
  assert.doesNotMatch(sichtbar(html), /\bmonths?\b|\bmonthly\b/i);
  for (const [wert, label] of [...html.matchAll(/<option\b[^>]*\bvalue="([123])"[^>]*>([^<]*)<\/option>/g)]
    .map((m) => [m[1], m[2]]).slice(0, 3)) {
    assert.match(label, /nights/, `Dauer ${wert}: ${label}`);
  }
});

// ---- Kriterium 4: Pflichtaussagen und K7 ------------------------------------

for (const p of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']) {
  test(`Kriterium 4: Pflichtaussage ${p} steht im sichtbaren Text, nach dem Muster des Fixtures`, () => {
    assert.match(sichtbar(html), new RegExp(dom.pflichtmuster.en[p], 'i'));
    assert.match(K7_EN[p], new RegExp(dom.pflichtmuster.en[p], 'i'), `${p}: Muster und K7-Satz passen nicht zusammen`);
  });
}

test('Kriterium 4: die Pflichtaussagen stehen nicht nur in meta, Skript oder Kommentar (Gegenprobe der Sichtbarkeit)', () => {
  const nurMeta = '<head><meta name="description" content="' + K7_EN.P2 + '"><!-- ' + K7_EN.P3 + ' --><script>"' + K7_EN.P6 + '"</script></head>';
  for (const p of ['P2', 'P3', 'P6']) assert.doesNotMatch(sichtbar(nurMeta), new RegExp(dom.pflichtmuster.en[p], 'i'));
});

test('Kriterium 4: jede Sachaussage der Seite steht in K7 (Spalte Englisch) oder in der Liste der Zusammensetzungen', () => {
  const alle = aussagen(html);
  assert.ok(alle.length >= 20, 'zu wenige Aussagen gefunden: ' + alle.length);
  const fremd = alle.filter((s) => !istK7(s));
  assert.deepEqual(fremd, [], 'nicht in K7: ' + fremd.join(' | '));
  // Gegenprobe: eine erfundene Aussage faellt durch.
  assert.equal(istK7('Coffee and tea are provided'), false);
  assert.equal(istK7('Parking is guaranteed'), false);
});

test('Kriterium 4: das Faktenblatt in diesem Test stimmt mit K7 im Plan ueberein, soweit der Plan im Repo liegt', (t) => {
  const plan = join(root, 'docs', 'bauplan-glattbrugg-longstay-2026-10-09.md');
  if (!existsSync(plan)) { t.diagnostic('Plan nicht im Repo, K7-Abgleich uebersprungen'); return; }
  const k7 = readFileSync(plan, 'utf8').split('### K7')[1].split('**Nicht behaupten:**')[0];
  const zeilen = [...k7.matchAll(/^\| (P\d|\d+) \| .*? \| (.*?) \|$/gm)].map((m) => [m[1], m[2]]);
  for (const [nr, en] of zeilen) {
    const key = /^P/.test(nr) ? nr : Number(nr);
    if (key in K7_EN) assert.equal(K7_EN[key], en, 'K7 Nr ' + nr);
  }
  assert.ok(zeilen.length >= 17);
});

test('Kriterium 4: jede Zahl im sichtbaren Text steht in K7, K2 oder im Formularkontrakt', () => {
  const zahlen = (s) => new Set(s.match(/\d+(?:\.\d+)?/g) || []);
  const erlaubt = new Set([...zahlen(Object.values(K7_EN).join(' ')), ...zahlen(config.PHONE),
    '59', '60', '75', '1', '2', '3']);
  const fremd = [...zahlen(sichtbar(html))].filter((z) => !erlaubt.has(z));
  assert.deepEqual(fremd, [], 'Zahlen ohne Quelle: ' + fremd.join(', '));
  // Gegenprobe: eine Zahl ohne Quelle faellt durch.
  assert.deepEqual([...zahlen('Suite 305 and 12 nights')].filter((z) => !erlaubt.has(z)), ['305', '12']);
});

test('Kriterium 4: nichts aus der Liste "Nicht behaupten" des Plans (Bewertung, Kaffee und Tee, Datum, Frist, Storno, Garantie, Waschsalon, Gemeinde)', () => {
  const text = sichtbar(html);
  const verboten = [/\breviews?\b|\brated\b|\brating\b|\bstars?\b/i, /\bcoffee\b|\btea\b/i, /\bavailab/i,
    /\bwithin \d|\bhours?\b|\bbusiness days?\b/i, /\bcancel/i, /\bguarantee/i, /launderette|laundromat|laundrette|laundry (shop|nearby)/i,
    /municipality|\bcommune\b|town hall|city hall/i];
  for (const re of verboten) assert.doesNotMatch(text, re, String(re));
  // Gegenprobe: das Muster erkennt die Behauptung.
  assert.match('Free cancellation until 24 hours before', verboten[4]);
  assert.match('Coffee and tea in the room', verboten[1]);
});

// ---- Kriterium 5: Harness (statischer Anteil) --------------------------------

test('Kriterium 5: noscript in #suiten ist englisch und nennt Telefon und Adresse (statischer Anteil des Harness-Belegs)', () => {
  const suiten = /<section\b[^>]*\bid="suiten"[\s\S]*?<\/section>/.exec(html)[0];
  const hinweis = /<noscript>([\s\S]*?)<\/noscript>/.exec(suiten);
  assert.ok(hinweis, 'noscript in #suiten fehlt');
  assert.match(sichtbar(hinweis[1]), /^ ?Prices on request:/);
  assert.ok(hinweis[1].includes('href="' + config.PHONE_HREF + '"'));
  assert.ok(hinweis[1].includes('href="mailto:' + config.EMAIL + '"'));
});

test('Kriterium 5: alle lokalen Verweise der Seite existieren, ausser dem Seitenskript von Segment 3 (Konsole ohne 404)', (t) => {
  const refs = [...html.matchAll(/\b(?:src|href)="([^"#:]+)"/g)].map((m) => m[1])
    .filter((r) => !/^(https?:|mailto:|tel:)/.test(r));
  assert.ok(refs.length >= 10);
  const fehlt = [];
  for (const r of new Set(refs)) {
    const ziel = r.startsWith('/') ? join(root, r) : normalize(join(root, dirname(PAGE), r));
    const datei = existsSync(ziel) && !ziel.endsWith('/') ? ziel : join(ziel, 'index.html');
    if (!existsSync(datei)) fehlt.push(r);
  }
  const erwartet = ['../js/glattbrugg-page.js', '../longstay-zuerich-flughafen/'];
  const unerwartet = fehlt.filter((r) => !erwartet.includes(r));
  assert.deepEqual(unerwartet, [], 'fehlende Dateien: ' + unerwartet.join(', '));
  for (const r of fehlt) t.diagnostic('fehlt noch (Segment 1 oder 3): ' + r);
});

test('Kriterium 5: Consent-Banner kommt von consent.js, das synchron vor allem anderen laedt; der Footer-Knopf oeffnet es', () => {
  const kopf = html.slice(0, html.indexOf('</head>'));
  assert.ok(kopf.indexOf('js/consent.js') < kopf.indexOf('js/meta.js'));
  assert.ok(kopf.indexOf('js/consent.js') < kopf.indexOf("gtag('config'"));
  assert.match(html, /<footer\b[\s\S]*<button type="button" id="gb-consent">Cookie settings<\/button>[\s\S]*<\/footer>/);
  assert.match(lies('js', 'consent.js'), /amConsent/);
});

// ---- Kriterium 6: Zugaenglichkeit (statischer Anteil) und Datenschutz-Link ---

test('Kriterium 6: jedes Feld hat ein sichtbares label (der Honigtopf ist ausgenommen)', () => {
  const felder = [...html.matchAll(/<(?:input|select|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  assert.equal(felder.length, 10);
  for (const id of felder) {
    const label = new RegExp('<label for="' + id + '">([^<]+)</label>').exec(html);
    assert.ok(label && label[1].trim(), `${id} ohne sichtbares label`);
    assert.doesNotMatch(html, new RegExp('\\bid="' + id + '"[^>]*\\bplaceholder='), `${id} nur mit placeholder`);
  }
});

test('Kriterium 6: Tastaturreihenfolge Nav, Karten, Formular, Absenden, ohne positives tabindex', () => {
  const pos = ['<nav', 'id="gb-cards"', 'id="gb-form"', 'id="gb-name"', 'id="gb-message"', 'id="gb-submit"']
    .map((s) => html.indexOf(s));
  pos.forEach((p) => assert.ok(p >= 0));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1]);
  assert.doesNotMatch(html, /tabindex="[1-9]/);
  assert.match(html, /<a href="#main" class="sr-only sr-only-focusable">Skip to main content<\/a>/);
});

test('Kriterium 6: Bilder tragen alt, Masse, und liegen unter images/zurich/ (keine neuen Bilder)', () => {
  const bilder = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(bilder.length >= 1);
  for (const b of bilder) {
    assert.ok((attr(b, 'alt') || '').trim().length > 10, 'alt fehlt: ' + b);
    assert.ok(attr(b, 'width') && attr(b, 'height'), 'Masse fehlen: ' + b);
    assert.match(attr(b, 'src'), /^\.\.\/images\/zurich\/[\w-]+\.(webp|jpg)$/);
    assert.ok(existsSync(join(root, attr(b, 'src').replace(/^\.\.\//, ''))), attr(b, 'src'));
  }
  const alle = [...html.matchAll(/(?:src|href|content)="([^"]*images\/[^"]+)"/g)].map((m) => m[1]);
  for (const r of alle) assert.match(r, /images\/(zurich\/[\w-]+\.(webp|jpg)|logo\.svg)$/, 'Bild ausserhalb images/zurich: ' + r);
});

test('Kriterium 6: Datenschutz-Link traegt hreflang der Sprache von privacy/index.html, und eine fremde Sprache steht im Linktext', () => {
  const privacy = lies('privacy', 'index.html');
  const sprache = attr(/<html\b[^>]*>/.exec(privacy)[0], 'lang');
  assert.equal(sprache, 'en');
  // Das lang-Attribut allein genuegt nicht: der Titel der Seite muss dieselbe Sprache sprechen.
  assert.match(privacy, /<title>Privacy Policy/);
  const links = [...html.matchAll(/<a\b([^>]*)>([^<]*)<\/a>/g)].filter((m) => attr(m[0], 'href') === '../privacy/');
  assert.equal(links.length, 2, 'Datenschutz-Link in Formularhinweis und Footer');
  for (const l of links) {
    assert.equal(attr(l[0], 'hreflang'), sprache);
    if (sprache !== 'en') assert.match(l[2], /\((in )?(German|French|Italian)\)/);
  }
});

// ---- Kriterium 7: Umfang, kein eigenes JavaScript, keine Personendaten ------

test('Kriterium 7: hoechstens 400 Zeilen Produktivcode in der Seite', () => {
  assert.ok(html.split('\n').length - 1 <= 400, html.split('\n').length - 1 + ' Zeilen');
});

test('Kriterium 7: kein eigenes JavaScript ausser den Ladern im Kopf, keine Handler im Body', () => {
  const body = html.slice(html.indexOf('<body'));
  assert.equal((body.match(/<script\b(?![^>]*\bsrc=)/g) || []).length, 0, 'Inline-Skript im body');
  assert.doesNotMatch(body, /\son[a-z]+="/);
  const kopf = html.slice(0, html.indexOf('</head>'));
  const inline = [...kopf.matchAll(/<script\b(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  assert.equal(inline.length, 2, 'erwartet: gtag-Lader und plausible.init()');
  assert.doesNotMatch(inline.join('\n'), /fetch\(|XMLHttpRequest|sendBeacon|localStorage\.setItem|document\.cookie/);
  assert.ok(inline[0].includes("gtag('config', 'G-8LPLG0BPJ6')") && inline[1].includes('plausible.init()'));
  // Der einzige Handler im Kopf ist der Ladetrick fuer style.css, wie auf den Nyon-Seiten.
  assert.deepEqual([...kopf.matchAll(/\son[a-z]+="([^"]*)"/g)].map((m) => m[1]), ["this.media='all'"]);
});

test('Kriterium 7: keine Personendaten, nur die Adresse und die Nummer aus K2', () => {
  const mails = [...new Set(html.match(/[\w.+-]+@[\w-]+\.[A-Za-z.]+/g) || [])].sort();
  assert.deepEqual(mails, [config.EMAIL]);
  // Schreibweise mit Leerzeichen und tel:-Link sind dieselbe Nummer.
  const nummern = [...new Set((html.match(/\+41[\d ]{9,}/g) || []).map((n) => n.replace(/\s/g, '')))];
  assert.deepEqual(nummern, [config.PHONE.replace(/\s/g, '')]);
  // Mess-IDs aus K2 sind keine Personendaten; jede andere Kennung mit langer Zahl waere eine Referenz.
  const ohneMessIds = html.split(config.ADS_ID).join('').split(config.GA4_ID).join('');
  assert.equal((ohneMessIds.match(/\b[A-Z]{2,3}-?\d{5,}\b/) || [null])[0], null, 'Buchungs- oder Referenznummer');
});

test('Kriterium 7: kein Gedankenstrich in der Seite und in diesem Test', () => {
  // Das Zeichen wird aus dem Codepoint gebaut, damit diese Datei es selbst nicht traegt.
  const strich = String.fromCharCode(0x2014);
  assert.equal(html.split(strich).length - 1, 0);
  const quelle = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  assert.equal(quelle.split(strich).length - 1, 0);
});
