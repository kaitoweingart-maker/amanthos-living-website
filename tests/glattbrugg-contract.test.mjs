/**
 * Kontrakttest Glattbrugg Longstay (Bauplan glattbrugg-longstay, Segment 0,
 * Kontrakte K1, K2, K5, K14).
 *
 * Prueft sofort: die Datendatei (K1), die Konstanten (K2), das DOM-Fixture,
 * das Skelett und die Stildatei (K5) sowie die Pfade des Harness (K14). Die
 * Gegenprobe an den zwei Seiten und am Seitenskript laeuft, sobald die Dateien
 * existieren (Segmente 1, 2, 3); fehlt eine Datei, wird der Teil uebersprungen
 * statt rot, und der letzte Test nennt die uebersprungenen Teile beim Namen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const lies = (...teile) => readFileSync(join(root, ...teile), 'utf8');

const unitsFile = join(root, 'js', 'glattbrugg-units.js');
const configFile = join(root, 'js', 'glattbrugg-config.js');
const units = require(unitsFile);
const config = require(configFile);
const unitsSrc = readFileSync(unitsFile, 'utf8');
const configSrc = readFileSync(configFile, 'utf8');
const css = lies('css', 'glattbrugg.css');
const dom = JSON.parse(lies('tests', 'fixtures', 'glattbrugg-dom-contract.json'));
const skeleton = lies('tests', 'fixtures', 'glattbrugg-skeleton.html');
const harness = lies('tests', 'dev-server.py');

const UNIT_FIELDS = ['key', 'code', 'name', 'sqm', 'maxPersons', 'units', 'longstayUnits',
  'price30', 'price60', 'listed'];
const K1_ROWS = [
  ['classic', 'CLS', 'Classic Suite', 34, 2, 8, 0],
  ['business', 'BUS', 'Business Suite', 39, 2, 4, 4],
  ['superior', 'SUPS', 'Superior Suite', null, 3, 4, 0],
  ['business-plus', 'BUPS', 'Business Plus Suite', 41, 3, 4, 4],
  ['sky', 'SKS', 'Sky Suite', 38, 3, 2, 0]
];
const K2_KEYS = ['API_BASE', 'CONTACT_PATH', 'FORM_KIND', 'PAGE_URL_DE', 'PAGE_URL_EN', 'GA4_ID',
  'ADS_ID', 'ADS_SEND_TO', 'CONTENT_NAME', 'PHONE', 'PHONE_HREF', 'EMAIL', 'VERSION'];
const P_KEYS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
const LABELLED = ['gb-name', 'gb-email', 'gb-phone', 'gb-company', 'gb-unit', 'gb-arrival',
  'gb-duration', 'gb-persons', 'gb-message', 'gb-company-website'];
const PAGE_URL = { de: config.PAGE_URL_DE, en: config.PAGE_URL_EN };

const ohneKommentare = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const countId = (html, id) => (html.match(new RegExp('\\bid="' + id + '"', 'g')) || []).length;
const attr = (tag, name) => {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
};

// Laedt eine der zwei Dateien wie der Browser: ohne module, mit window.
function inBrowser(src, name, apiBase) {
  const w = {};
  w.window = w;
  if (apiBase !== undefined) w.AMANTHOS_API_BASE = apiBase;
  vm.runInContext(src, vm.createContext(w), { filename: name });
  return w;
}

// Sichtbarer Text: Skripte, Styles, Kommentare und Tags weg, Leerraum zusammengezogen.
function sichtbar(html) {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;| /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');
}

// Preiszahlen, die im HTML nie stehen duerfen: jeder Preis aus K1, jede Zahl mit
// Tausender-Apostroph und jeder CHF-Betrag ab 100. CHF 10 fuer den Parkplatz bleibt erlaubt.
function preisTreffer(html) {
  const k1 = units.UNITS.flatMap((u) => [u.price30, u.price60]).filter((p) => p !== null);
  const muster = [/\b\d{1,3}['’]\d{3}\b/g, /CHF\s*\d{3,}/g,
    new RegExp('\\b(' + [...new Set(k1)].join('|') + ')\\b', 'g')];
  return muster.flatMap((re) => html.match(re) || []);
}

function optionen(html, id) {
  const m = new RegExp('<select\\b[^>]*\\bid="' + id + '"[^>]*>([\\s\\S]*?)</select>').exec(html);
  assert.ok(m, `${id} ist kein <select>`);
  return [...m[1].matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)].map((o) => o[1]);
}

function endSkripte(html) {
  const body = html.slice(html.indexOf('<body'));
  return [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => ({
    src: m[1].replace(/^(\.\.\/)+/, ''), defer: /\sdefer(\s|>)/.test(m[0])
  }));
}

// Pruefungen, die fuer das Skelett und fuer jede der zwei Seiten gleich lauten.
function pruefeIds(html, wo) {
  for (const id of [...dom.ids, ...dom.sections]) {
    assert.equal(countId(html, id), 1, `${wo}: ID ${id} kommt ${countId(html, id)} mal vor`);
  }
}

function pruefeAbschnitte(html, wo) {
  const pos = [html.search(new RegExp('<section\\b[^>]*class="[^"]*\\b' + dom.hero + '\\b')),
    ...dom.sections.map((id) => html.search(new RegExp('<section\\b[^>]*\\bid="' + id + '"'))),
    html.search(/<footer\b[^>]*class="[^"]*\bfooter\b/)];
  const namen = ['section.' + dom.hero, ...dom.sections.map((s) => '#' + s), 'footer'];
  pos.forEach((p, i) => assert.ok(p >= 0, `${wo}: ${namen[i]} fehlt`));
  for (let i = 1; i < pos.length; i++) {
    assert.ok(pos[i] > pos[i - 1], `${wo}: ${namen[i]} muss nach ${namen[i - 1]} kommen`);
  }
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${wo}: genau ein h1`);
}

function pruefeFelder(html, wo) {
  for (const [id, spec] of Object.entries(dom.fields)) {
    const m = new RegExp('<' + spec.tag + '\\b[^>]*\\bid="' + id + '"[^>]*>').exec(html);
    assert.ok(m, `${wo}: ${id} ist kein <${spec.tag}>`);
    for (const [name, value] of Object.entries(spec.attrs)) {
      if (value === '') assert.match(m[0], new RegExp('\\s' + name + '(\\s|>|=)'), `${wo}: ${id} ohne ${name}`);
      else assert.equal(attr(m[0], name), value, `${wo}: ${id} ${name}`);
    }
    if (spec.options) assert.deepEqual(optionen(html, id), spec.options, `${wo}: Optionen von ${id}`);
  }
  assert.match(html, /<div\b[^>]*\bid="gb-cards"[^>]*>\s*<\/div>/, `${wo}: gb-cards ist nicht leer`);
  assert.match(html, /<div class="hp" aria-hidden="true">(?:(?!<\/div>)[\s\S])*\bid="gb-company-website"/,
    `${wo}: der Honigtopf steht nicht in div.hp`);
  for (const id of LABELLED) {
    assert.equal((html.match(new RegExp('<label\\b[^>]*\\bfor="' + id + '"', 'g')) || []).length, 1,
      `${wo}: genau ein label fuer ${id}`);
  }
  const ns = /<section\b[^>]*\bid="suiten"[\s\S]*?<\/section>/.exec(html);
  const hinweis = ns && /<noscript>([\s\S]*?)<\/noscript>/.exec(ns[0]);
  assert.ok(hinweis, `${wo}: noscript in #suiten fehlt`);
  assert.ok(hinweis[1].includes('href="' + config.PHONE_HREF + '"'), `${wo}: noscript ohne Telefon`);
  assert.ok(hinweis[1].includes('href="mailto:' + config.EMAIL + '"'), `${wo}: noscript ohne Adresse`);
}

function pruefeSkripte(html, wo) {
  const liste = endSkripte(html);
  assert.deepEqual(liste.map((s) => s.src), dom.scripts_end, `${wo}: Skriptliste am Ende`);
  for (const s of liste) assert.ok(s.defer, `${wo}: ${s.src} ohne defer`);
  for (const wort of dom.forbidden) assert.ok(!html.includes(wort), `${wo}: ${wort} darf nicht vorkommen`);
  assert.match(html, /plausible\.init\(\)/, `${wo}: plausible.init() fehlt`);
  assert.match(html, /<script src="(\.\.\/)+js\/consent\.js"><\/script>/, `${wo}: consent.js nicht synchron`);
  assert.match(html, /<script defer src="(\.\.\/)+js\/meta\.js"><\/script>/, `${wo}: meta.js ohne defer`);
}

function pruefeOhnePreis(html, wo) {
  assert.deepEqual(preisTreffer(html), [], `${wo}: Preiszahl im HTML`);
  assert.equal((html.match(/\u2014/g) || []).length, 0, `${wo}: Gedankenstrich`);
}

function pruefePflicht(html, lang, wo) {
  const text = sichtbar(html);
  for (const p of P_KEYS) {
    assert.match(text, new RegExp(dom.pflichtmuster[lang][p], 'i'), `${wo}: Pflichtaussage ${p} fehlt`);
  }
}

// ---- K1: Kategorienliste ---------------------------------------------------

test('K1: fuenf Kategorien, Schluessel, Codes, Namen, Flaechen, Personen und Bestand in fester Reihenfolge', () => {
  assert.deepEqual(units.UNITS.map((u) => [u.key, u.code, u.name, u.sqm, u.maxPersons, u.units,
    u.longstayUnits]), K1_ROWS);
  for (const u of units.UNITS) assert.deepEqual(Object.keys(u), UNIT_FIELDS, `Felder von ${u.key}`);
});

test('K1: 22 Einheiten im Haus, 8 davon fuer Longstay', () => {
  assert.equal(units.UNITS.reduce((s, u) => s + u.units, 0), 22);
  assert.equal(units.UNITS.reduce((s, u) => s + u.longstayUnits, 0), 8);
  for (const u of units.UNITS) assert.ok(u.longstayUnits <= u.units, `${u.key}: mehr frei als vorhanden`);
});

test('K1: gelistet genau dann, wenn Einheiten fuer Longstay frei sind', () => {
  for (const u of units.UNITS) assert.equal(u.listed, u.longstayUnits > 0, u.key);
  assert.deepEqual(units.UNITS.filter((u) => u.listed).map((u) => u.key), ['business', 'business-plus']);
});

test('K1: gelistet heisst beide Preise gesetzt, 200 Abstand und mindestens 2100 ab 60 Naechten', () => {
  for (const u of units.UNITS.filter((x) => x.listed)) {
    assert.ok(Number.isInteger(u.price30) && Number.isInteger(u.price60), `${u.key}: Preis fehlt`);
    assert.equal(u.price30 - u.price60, 200, `${u.key}: Abstand`);
    assert.ok(u.price60 >= 2100, `${u.key}: price60 unter 2100`);
  }
});

test('K1: nicht gelistet heisst kein Preis, und nur superior ist ohne Flaeche', () => {
  for (const u of units.UNITS.filter((x) => !x.listed)) {
    assert.equal(u.price30, null, `${u.key}: price30`);
    assert.equal(u.price60, null, `${u.key}: price60`);
  }
  assert.deepEqual(units.UNITS.filter((u) => u.sqm === null).map((u) => u.key), ['superior']);
});

test('K1: Zuschlag, Naechte, Steuer, Waehrung und Version', () => {
  assert.deepEqual(Object.keys(units), ['UNITS', 'EXTRA_PERSON', 'MIN_NIGHTS', 'MAX_NIGHTS',
    'VAT_LABEL', 'CURRENCY', 'VERSION']);
  assert.equal(units.EXTRA_PERSON, 250);
  assert.equal(units.MIN_NIGHTS, 30);
  assert.equal(units.MAX_NIGHTS, 89);
  assert.equal(units.VAT_LABEL, '3.8 %');
  assert.equal(units.CURRENCY, 'CHF');
  assert.equal(units.VERSION, '1');
});

test('K1: keine Zimmernummer und keine Zahl ausser den gelisteten Preisen im Code', () => {
  const code = ohneKommentare(unitsSrc);
  assert.doesNotMatch(code, /rooms/);
  assert.doesNotMatch(code, /['"]\d{2,3}['"]/, 'eine Zimmernummer sieht so aus');
  const vierstellig = [...new Set(code.match(/\b\d{4,}\b/g) || [])].sort();
  const erlaubt = units.UNITS.filter((u) => u.listed).flatMap((u) => [u.price30, u.price60]);
  assert.deepEqual(vierstellig, [...new Set(erlaubt)].map(String).sort());
});

test('K1: im Browser haengt die Liste an window.GLATTBRUGG_UNITS, ohne Logik und DOM', () => {
  const w = inBrowser(unitsSrc, 'js/glattbrugg-units.js');
  assert.equal(JSON.stringify(w.GLATTBRUGG_UNITS), JSON.stringify(units));
  assert.doesNotMatch(unitsSrc, /document\.|fetch\(|addEventListener/);
  assert.equal((unitsSrc.match(/\u2014/g) || []).length, 0);
});

// ---- K2: Konstanten --------------------------------------------------------

test('K2: glattbrugg-config.js exportiert genau die vereinbarten Schluessel', () => {
  assert.deepEqual(Object.keys(config), K2_KEYS);
  assert.equal(config.VERSION, '1');
});

test('K2: Formularart, Pfade, Seiten-URLs, Mess-IDs und Ereignisname', () => {
  assert.equal(config.API_BASE, 'https://amanthos-website-api.onrender.com');
  assert.equal(config.CONTACT_PATH, '/api/contact');
  assert.equal(config.FORM_KIND, 'glattbrugg');
  assert.equal(config.PAGE_URL_DE, 'https://www.amanthosliving.com/longstay-zuerich-flughafen/');
  assert.equal(config.PAGE_URL_EN, 'https://www.amanthosliving.com/long-stay-zurich-airport/');
  assert.equal(config.GA4_ID, 'G-8LPLG0BPJ6');
  assert.equal(config.ADS_ID, 'AW-702540316');
  assert.equal(config.CONTENT_NAME, 'glattbrugg-longstay');
  for (const lang of ['de', 'en']) {
    assert.equal(PAGE_URL[lang], 'https://www.amanthosliving.com/' + dirname(dom.pages[lang]) + '/');
  }
});

test('K2: ADS_SEND_TO ist leer (kein Conversion-Aufruf) oder ein Label des eigenen Kontos', () => {
  // Leer ist der Stand von Segment 0. Die Verdrahtung traegt das Label ein, sobald die
  // Aktion im Konto existiert; eine fremde Konto-ID bleibt verboten.
  assert.equal(typeof config.ADS_SEND_TO, 'string');
  if (config.ADS_SEND_TO !== '') {
    assert.match(config.ADS_SEND_TO, /^AW-702540316\/[A-Za-z0-9_-]+$/);
    assert.equal(config.ADS_SEND_TO.split('/')[0], config.ADS_ID);
  }
});

test('K2: Telefon ist die Nummer aus dem JSON-LD von zurich/index.html, Adresse ist sales', () => {
  assert.equal(config.PHONE, '+41 41 562 97 00');
  assert.equal(config.PHONE_HREF, 'tel:' + config.PHONE.replace(/\s/g, ''));
  assert.ok(lies('zurich', 'index.html').includes('"telephone": "' + config.PHONE + '"'));
  assert.equal(config.EMAIL, 'sales@amanthosliving.com');
});

test('K2: im Browser haengt die Konfiguration an window.GLATTBRUGG_CONFIG und folgt AMANTHOS_API_BASE', () => {
  const ohne = inBrowser(configSrc, 'js/glattbrugg-config.js').GLATTBRUGG_CONFIG;
  assert.equal(JSON.stringify(ohne), JSON.stringify(config));
  const mit = inBrowser(configSrc, 'js/glattbrugg-config.js', '').GLATTBRUGG_CONFIG;
  assert.equal(mit.API_BASE, '', 'leerer String (Harness, gleiche Origin) muss gelten');
});

test('K2: keine Preiszahl, keine Logik, kein Gedankenstrich in der Datei', () => {
  assert.deepEqual(preisTreffer(configSrc), []);
  assert.doesNotMatch(configSrc, /document\.|fetch\(|addEventListener/);
  assert.equal((configSrc.match(/\u2014/g) || []).length, 0);
});

// ---- K5: DOM-Fixture und Stildatei ------------------------------------------

test('K5: das Fixture traegt 17 eindeutige IDs, fuenf Abschnitte und zu jeder ID ein Feld', () => {
  assert.equal(dom.version, '1');
  assert.deepEqual(dom.ids, ['gb-cards', 'gb-price-note', 'gb-form', 'gb-name', 'gb-email',
    'gb-phone', 'gb-company', 'gb-unit', 'gb-arrival', 'gb-duration', 'gb-persons', 'gb-message',
    'gb-company-website', 'gb-submit', 'gb-status', 'gb-success', 'gb-consent']);
  assert.equal(new Set(dom.ids).size, 17);
  assert.deepEqual(dom.sections, ['suiten', 'anfrage', 'lage', 'faq', 'kontakt']);
  assert.deepEqual(Object.keys(dom.fields), dom.ids);
  assert.deepEqual(dom.hidden_initially, ['gb-success']);
  assert.deepEqual(dom.scripts_end, ['js/glattbrugg-config.js', 'js/glattbrugg-units.js',
    'js/glattbrugg-page.js', 'js/anruf.js']);
  assert.deepEqual(dom.forbidden, ['i18n.js', 'booking.js', 'data-animate', 'langSelector']);
  assert.equal(dom.robots_until_wiring, 'noindex, nofollow');
});

test('K5: Dauer kennt nur 1, 2, 3 und Personen nur 1, 2, 3', () => {
  assert.deepEqual(dom.fields['gb-duration'].options, ['', '1', '2', '3']);
  assert.deepEqual(dom.fields['gb-persons'].options, ['1', '2', '3']);
  assert.deepEqual(dom.fields['gb-unit'].options, ['']);
  const maxPersons = Math.max(...units.UNITS.filter((u) => u.listed).map((u) => u.maxPersons));
  assert.equal(Number(dom.fields['gb-persons'].options.at(-1)), maxPersons);
});

test('K5: die Pflichtmuster P1 bis P8 stehen je Sprache im Fixture und sind gueltige Ausdruecke', () => {
  for (const lang of ['de', 'en']) {
    assert.deepEqual(Object.keys(dom.pflichtmuster[lang]), P_KEYS, lang);
    for (const p of P_KEYS) assert.doesNotThrow(() => new RegExp(dom.pflichtmuster[lang][p], 'i'));
  }
  assert.match(dom.pflichtmuster.de.P1, /30 bis höchstens 89/);
  assert.match(dom.pflichtmuster.en.P1, /30 to a maximum of 89/);
  assert.ok(dom.pflichtmuster.de.P7.includes(units.VAT_LABEL.replace('.', '\\.')));
  assert.ok(dom.pflichtmuster.en.P7.includes(units.VAT_LABEL.replace('.', '\\.')));
});

test('K5: bestehende Klassen stehen in style.css oder grenchen.css, die acht neuen nur in glattbrugg.css', () => {
  const bestand = lies('css', 'style.css') + lies('css', 'grenchen.css');
  assert.equal(dom.classes_existing.length, 20);
  // g-status--error ist ein Zustandsmarker ohne eigene Regel (wie in js/nyon-page.js); bekommt
  // er je eine Regel im Bestand, gehoert er aus classes_marker heraus.
  assert.deepEqual(dom.classes_marker, ['g-status--error']);
  for (const cls of dom.classes_existing) {
    const regel = new RegExp('\\.' + cls + '(?![\\w-])');
    if (dom.classes_marker.includes(cls)) assert.doesNotMatch(bestand, regel, `.${cls} hat jetzt eine Regel`);
    else assert.match(bestand, regel, `.${cls} fehlt im Bestand`);
  }
  assert.deepEqual(dom.classes_new, ['gb-cards', 'gb-card', 'gb-card-body', 'gb-price', 'gb-night',
    'gb-meta', 'gb-facts', 'gb-note']);
  for (const cls of dom.classes_new) {
    assert.doesNotMatch(bestand, new RegExp('\\.' + cls + '(?![\\w-])'), `.${cls} steht schon im Bestand`);
  }
});

test('K5: css/glattbrugg.css hat hoechstens 60 Zeilen und nur die acht gb-Klassen', () => {
  assert.ok(css.split('\n').length - 1 <= 60, `${css.split('\n').length - 1} Zeilen`);
  const selektoren = [...ohneKommentare(css).matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1]);
  const klassen = new Set(selektoren.flatMap((s) => s.match(/\.[A-Za-z_][\w-]*/g) || []).map((k) => k.slice(1)));
  assert.deepEqual([...klassen].sort(), [...dom.classes_new].sort());
  assert.doesNotMatch(css, /!important|@import|url\(/);
  assert.deepEqual(preisTreffer(css), []);
  assert.equal((css.match(/\u2014/g) || []).length, 0);
});

// ---- K5 und K14: Skelett ----------------------------------------------------

test('K14: das Skelett traegt jede ID genau einmal, ist deutsch und noindex', () => {
  pruefeIds(skeleton, 'Skelett');
  assert.match(skeleton, /^<!DOCTYPE html>\s*<html lang="de">/);
  assert.ok(skeleton.includes('<meta name="robots" content="' + dom.robots_until_wiring + '">'));
});

test('K14: das Skelett hat die Abschnitte in der Reihenfolge des Kontrakts', () => {
  pruefeAbschnitte(skeleton, 'Skelett');
  // Das Skelett verlinkt keine der zwei Seiten: solange eine fehlt, waere das ein toter Link
  // im Linkcheck der Quality-CI (so geschehen am 10.10.2026 nach dem Merge von Segment 0).
  for (const lang of ['de', 'en']) {
    assert.ok(!skeleton.includes('href="../../' + dirname(dom.pages[lang]) + '/'), dom.pages[lang]);
  }
});

test('K14: die Felder im Skelett tragen Tag, Attribute, Optionen, Label und Honigtopf des Kontrakts', () => {
  pruefeFelder(skeleton, 'Skelett');
  for (const id of dom.hidden_initially) {
    assert.match(skeleton, new RegExp('\\bid="' + id + '"[^>]*\\shidden(\\s|>)'), `${id} ohne hidden`);
  }
});

test('K14: das Skelett laedt dieselben Skripte wie die Seiten und plausible.init()', () => {
  pruefeSkripte(skeleton, 'Skelett');
  assert.doesNotMatch(skeleton, /<(script|link)\b[^>]*\b(src|href)="https?:/, 'das Skelett laedt nichts aus dem Netz');
});

test('K14: keine Preiszahl im Skelett, und es erfuellt die deutschen Pflichtmuster', () => {
  pruefeOhnePreis(skeleton, 'Skelett');
  pruefePflicht(skeleton, 'de', 'Skelett');
  assert.ok(skeleton.includes('href="' + config.PHONE_HREF + '"'));
  assert.ok(skeleton.includes('href="mailto:' + config.EMAIL + '"'));
});

// ---- K14: Harness ----------------------------------------------------------

test('K14: der Harness kennt die zwei Seiten, je mit index.html, und das Skelett', () => {
  const pfade = {
    '/longstay-zuerich-flughafen/': ['longstay-zuerich-flughafen', 'index.html'],
    '/longstay-zuerich-flughafen/index.html': ['longstay-zuerich-flughafen', 'index.html'],
    '/long-stay-zurich-airport/': ['long-stay-zurich-airport', 'index.html'],
    '/long-stay-zurich-airport/index.html': ['long-stay-zurich-airport', 'index.html'],
    '/tests/fixtures/glattbrugg-skeleton.html': ['tests', 'fixtures', 'glattbrugg-skeleton.html']
  };
  for (const [url, teile] of Object.entries(pfade)) {
    const ziel = 'os.path.join(' + teile.map((t) => '"' + t + '"').join(', ') + ')';
    assert.ok(harness.includes('"' + url + '": ' + ziel), `STUBBED_PAGES ohne ${url}`);
  }
  assert.ok(harness.includes('"%s fehlt noch"'), 'die 404-Meldung fuer fehlende Seiten fehlt');
  for (const lang of ['de', 'en']) {
    assert.ok(harness.includes('"/' + dirname(dom.pages[lang]) + '/"'), dom.pages[lang]);
  }
});

// ---- K5: Gegenprobe an den Seiten und am Skript, sobald sie existieren ------

const seiten = {};
const uebersprungen = [];
for (const [lang, segment] of [['de', 1], ['en', 2]]) {
  const pfad = join(root, dom.pages[lang]);
  seiten[lang] = existsSync(pfad) ? readFileSync(pfad, 'utf8') : null;
  if (!seiten[lang]) uebersprungen.push(`K5 an ${dom.pages[lang]} (Segment ${segment})`);
}
const scriptFile = join(root, dom.script);
if (!existsSync(scriptFile)) uebersprungen.push(`getElementById-Literale in ${dom.script} (Segment 3)`);
if (!seiten.de || !seiten.en) uebersprungen.push('Vergleich der zwei Seiten (Segmente 1 und 2)');

for (const lang of ['de', 'en']) {
  const wo = dom.pages[lang];
  const skip = seiten[lang] ? false : `${wo} fehlt noch`;
  const html = seiten[lang] || '';

  test(`K5 ${lang}: IDs genau einmal, Abschnitte in Reihenfolge, Felder nach Kontrakt`, { skip }, () => {
    pruefeIds(html, wo);
    pruefeAbschnitte(html, wo);
    pruefeFelder(html, wo);
    assert.match(html, new RegExp('^<!DOCTYPE html>\\s*<html lang="' + lang + '">'));
  });

  test(`K5 ${lang}: CSP zuerst und gleich nyon-louer, Kopf in der Reihenfolge des Kontrakts`, { skip }, () => {
    const cspRe = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;
    const kopf = html.slice(html.indexOf('<head>') + 6).replace(/^(\s|<!--[\s\S]*?-->)*/, '');
    assert.ok(kopf.startsWith('<meta http-equiv="Content-Security-Policy"'), 'CSP ist nicht das erste Element');
    assert.equal(cspRe.exec(html)[1], cspRe.exec(lies(dom.csp_source))[1], 'CSP weicht von nyon-louer ab');
    const pos = dom.head_order.map((s) => html.indexOf(s));
    pos.forEach((p, i) => assert.ok(p >= 0, `${dom.head_order[i]} fehlt im Kopf`));
    for (let i = 1; i < pos.length; i++) {
      assert.ok(pos[i] > pos[i - 1], `${dom.head_order[i]} muss nach ${dom.head_order[i - 1]} kommen`);
    }
    assert.ok(pos.at(-1) < html.indexOf('</head>'));
  });

  test(`K5 ${lang}: robots, canonical und hreflang wechselseitig`, { skip }, () => {
    assert.ok(html.includes('<meta name="robots" content="' + dom.robots_until_wiring + '">'));
    const canonical = /<link\b[^>]*\brel="canonical"[^>]*>/.exec(html);
    assert.equal(canonical && attr(canonical[0], 'href'), PAGE_URL[lang]);
    const alt = {};
    for (const m of html.matchAll(/<link\b[^>]*\brel="alternate"[^>]*>/g)) {
      alt[attr(m[0], 'hreflang')] = attr(m[0], 'href');
    }
    assert.deepEqual(alt, { de: PAGE_URL.de, en: PAGE_URL.en, 'x-default': PAGE_URL.en });
  });

  test(`K5 ${lang}: Skripte am Ende, plausible.init(), nichts Verbotenes`, { skip }, () => {
    pruefeSkripte(html, wo);
  });

  test(`K5 ${lang}: keine Preiszahl im HTML, Pflichtaussagen P1 bis P8 im sichtbaren Text`, { skip }, () => {
    pruefeOhnePreis(html, wo);
    pruefePflicht(html, lang, wo);
  });
}

test('K5: beide Seiten tragen dieselbe ID-Menge, Abschnittsreihenfolge und Skriptliste',
  { skip: seiten.de && seiten.en ? false : 'eine der zwei Seiten fehlt noch' }, () => {
    const ids = (html) => [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]).sort();
    const abschnitte = (html) => [...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(ids(seiten.de), ids(seiten.en));
    assert.deepEqual(abschnitte(seiten.de), abschnitte(seiten.en));
    assert.deepEqual(endSkripte(seiten.de), endSkripte(seiten.en));
    // Gleicher Aufbau in beiden Sprachen: dieselben Klassen in derselben Reihenfolge, derselbe
    // kritische Stilblock, kein Inline-Stil. Texte duerfen abweichen, die Gestalt nicht.
    const klassen = (html) => [...html.slice(html.indexOf('<body')).matchAll(/\bclass="([^"]*)"/g)].map((m) => m[1]);
    const stil = (html) => /<style>\*\{margin:0[\s\S]*?<\/style>/.exec(html)[0];
    assert.deepEqual(klassen(seiten.de), klassen(seiten.en));
    assert.equal(stil(seiten.de), stil(seiten.en));
    for (const html of [seiten.de, seiten.en]) assert.doesNotMatch(html, /\sstyle="/, 'Inline-Stil im HTML');
  });

test('K5: jedes getElementById-Literal in js/glattbrugg-page.js steht im Fixture',
  { skip: existsSync(scriptFile) ? false : `${dom.script} fehlt noch` }, () => {
    const src = readFileSync(scriptFile, 'utf8');
    const gefunden = [...src.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
    assert.ok(gefunden.length > 0, 'keine getElementById-Aufrufe gefunden');
    for (const id of new Set(gefunden)) {
      assert.ok(dom.ids.includes(id), `${dom.script} greift auf unbekannte ID ${id} zu`);
    }
    assert.deepEqual(preisTreffer(src), [], 'Preis aus K1 im Quelltext des Skripts');
  });

test('K5: uebersprungen sind: ' + (uebersprungen.join('; ') || 'nichts'), (t) => {
  for (const teil of uebersprungen) t.diagnostic('uebersprungen: ' + teil);
  assert.ok(uebersprungen.length <= 4);
});
