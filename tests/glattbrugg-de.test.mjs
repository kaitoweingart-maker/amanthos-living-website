/**
 * Segment 1: deutsche Seite longstay-zuerich-flughafen/index.html
 * (Bauplan glattbrugg-longstay, Kontrakte K5 und K7).
 *
 * Statische Pruefungen der Datei. Jeder Punkt der Akzeptanzkriterien von Segment 1
 * hat einen eigenen Test, damit ein roter Lauf sagt, welche Zusage gebrochen ist.
 * Die Pruefungen, die einen Browser brauchen (Harness ohne Konsolenfehler, noscript
 * ohne JavaScript, axe, Lighthouse, 360 px), laufen ausserhalb dieser Datei und
 * stehen im Bericht des Segments, nicht hier. Der Kontrakttest
 * (tests/glattbrugg-contract.test.mjs) prueft dieselbe Datei zusaetzlich nach K5.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const lies = (...teile) => readFileSync(join(root, ...teile), 'utf8');

const units = require(join(root, 'js', 'glattbrugg-units.js'));
const config = require(join(root, 'js', 'glattbrugg-config.js'));
const dom = JSON.parse(lies('tests', 'fixtures', 'glattbrugg-dom-contract.json'));
const PAGE = dom.pages.de;
const page = lies(PAGE);
const nyon = lies(dom.csp_source);

const md5 = (s) => createHash('md5').update(s, 'utf8').digest('hex');
const countId = (html, id) => (html.match(new RegExp('\\bid="' + id + '"', 'g')) || []).length;
const cspContent = (html) => {
  const m = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(html);
  assert.ok(m, 'CSP-Meta fehlt');
  return m[1];
};
const attr = (tag, name) => {
  const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
};
const tagOf = (html, id) => {
  const m = new RegExp('<[a-z]+\\b[^>]*\\bid="' + id + '"[^>]*>').exec(html);
  assert.ok(m, `Element ${id} fehlt`);
  return m[0];
};

// Sichtbarer Text wie im Kontrakttest: Skripte, Styles, Kommentare und Tags weg.
const sichtbar = (html) => html
  .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/g, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;| /g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ');

// Lesbarer Text inklusive noscript-Hinweis und der Attribute, die ein Mensch liest.
const lesbar = (html) => {
  const attribute = [...html.matchAll(/\b(?:content|alt|title|aria-label|placeholder)="([^"]*)"/g)].map((m) => m[1]);
  const ohne = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  return ohne.replace(/<[^>]+>/g, ' ') + ' ' + attribute.join(' ');
};

const head = page.slice(page.indexOf('<head>'), page.indexOf('</head>'));
const body = page.slice(page.indexOf('<body'));

// ---- Kriterium 1: Datei, Kontrakttest, Umfang -----------------------------------

test('K1/Segment 1: die Seite liegt am Pfad aus dem Fixture und der Kontrakttest greift sie', () => {
  assert.equal(PAGE, 'longstay-zuerich-flughafen/index.html');
  assert.ok(existsSync(join(root, PAGE)));
  // Der K5-Teil des Kontrakttests ist nur dann aktiv, wenn die Datei existiert: er liest
  // dieselbe Datei und uebersprungen wird er nur bei fehlender Datei.
  const kontrakt = lies('tests', 'glattbrugg-contract.test.mjs');
  assert.ok(kontrakt.includes('existsSync(pfad) ? readFileSync(pfad'));
});

test('Segment 1: die Seite hat hoechstens 400 Zeilen', () => {
  const zeilen = page.split('\n').length - 1;
  assert.ok(zeilen <= 400, `${zeilen} Zeilen`);
});

// ---- Kriterium 2: Kopf ------------------------------------------------------------

test('Kopf: CSP-Meta ist das erste Element im head, content byte-gleich mit nyon-louer', () => {
  const kopf = page.slice(page.indexOf('<head>') + 6).replace(/^(\s|<!--[\s\S]*?-->)*/, '');
  assert.ok(kopf.startsWith('<meta http-equiv="Content-Security-Policy"'), 'CSP ist nicht das erste Element');
  assert.equal(cspContent(page), cspContent(nyon));
  assert.equal(md5(cspContent(page)), md5(cspContent(nyon)));
  assert.equal((page.match(/http-equiv="Content-Security-Policy"/g) || []).length, 1);
});

// Geaenderte Erwartung: bis zur Verdrahtung pinnte dieser Test noindex, nofollow (Segment 1).
// Der Bauplan laesst die Verdrahtung robots nach der Freigabe auf index, follow stellen
// (Abschnitt 4); seither ist die Seite indexierbar, und die Sperre darf nicht zurueckkehren.
test('Kopf: lang="de" und robots index, follow', () => {
  assert.match(page, /^<!DOCTYPE html>\s*<html lang="de">/);
  assert.equal((page.match(/<meta name="robots"[^>]*>/g) || []).length, 1);
  assert.ok(page.includes('<meta name="robots" content="index, follow">'));
  assert.doesNotMatch(page, /noindex|nofollow/);
});

test('Kopf: canonical auf sich, hreflang de, en und x-default nach K5', () => {
  const canonical = /<link\b[^>]*\brel="canonical"[^>]*>/.exec(page);
  assert.equal(canonical && attr(canonical[0], 'href'), config.PAGE_URL_DE);
  const alt = {};
  for (const m of page.matchAll(/<link\b[^>]*\brel="alternate"[^>]*>/g)) alt[attr(m[0], 'hreflang')] = attr(m[0], 'href');
  assert.deepEqual(alt, { de: config.PAGE_URL_DE, en: config.PAGE_URL_EN, 'x-default': config.PAGE_URL_EN });
});

test('Kopf: Reihenfolge der Elemente nach head_order, Titel und Beschreibung nicht leer', () => {
  const pos = dom.head_order.map((s) => page.indexOf(s));
  pos.forEach((p, i) => assert.ok(p >= 0, `${dom.head_order[i]} fehlt`));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1], `${dom.head_order[i]} steht zu frueh`);
  assert.match(head, /<title>Suite auf Zeit am Flughafen Zürich: Longstay bis 89 Nächte \| Amanthos Living<\/title>/);
  assert.match(head, /<meta name="description" content="[^"]{60,}">/);
  assert.match(head, /<meta property="og:image" content="https:\/\/www\.amanthosliving\.com\/images\/zurich\/hero\.webp">/);
});

test('Kopf: JSON-LD LodgingBusiness mit Name, Adresse und url, ohne Preis und ohne Bewertung', () => {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(page);
  assert.ok(m, 'JSON-LD fehlt');
  const ld = JSON.parse(m[1]);
  assert.equal(ld['@type'], 'LodgingBusiness');
  assert.equal(ld.url, config.PAGE_URL_DE);
  assert.equal(ld.address.streetAddress, 'Oberhauserstrasse 30');
  assert.equal(ld.address.postalCode, '8152');
  assert.equal(ld.address.addressLocality, 'Glattbrugg');
  assert.ok(ld.name);
  for (const verboten of ['priceRange', 'offers', 'aggregateRating', 'review']) {
    assert.ok(!(verboten in ld), `JSON-LD traegt ${verboten}`);
  }
});

// ---- Kriterium 3: Skripte ---------------------------------------------------------

test('Skripte: genau nach K5 in dieser Reihenfolge, alle defer', () => {
  const liste = [...body.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map((m) => ({
    src: m[1].replace(/^(\.\.\/)+/, ''), defer: /\sdefer(\s|>)/.test(m[0])
  }));
  assert.deepEqual(liste.map((s) => s.src), dom.scripts_end);
  for (const s of liste) assert.ok(s.defer, `${s.src} ohne defer`);
  assert.deepEqual(dom.scripts_end, ['js/glattbrugg-config.js', 'js/glattbrugg-units.js',
    'js/glattbrugg-page.js', 'js/anruf.js']);
});

test('Skripte: kein Sprachskript, keine Buchungsmaschine, keine Animation, kein Umschalter', () => {
  assert.deepEqual(dom.forbidden, ['i18n.js', 'booking.js', 'data-animate', 'langSelector']);
  for (const wort of dom.forbidden) assert.ok(!page.includes(wort), `${wort} darf nicht vorkommen`);
});

test('Skripte: consent.js synchron, meta.js defer, plausible.init() vorhanden', () => {
  assert.match(page, /<script src="\.\.\/js\/consent\.js"><\/script>/);
  assert.match(page, /<script defer src="\.\.\/js\/meta\.js"><\/script>/);
  assert.match(page, /plausible\.init\(\)/);
  assert.match(page, /<script async src="https:\/\/plausible\.io\/js\/pa-[A-Za-z0-9_-]+\.js"><\/script>/);
});

test('Skripte: kein eigenes JavaScript ausser dem Lader im Kopf', () => {
  // Inline-Skripte: der gtag-Lader (mit Einwilligungspruefung) und das Plausible-Snippet.
  const inline = [...page.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]);
  assert.equal(inline.length, 2, 'erwartet: gtag-Lader und Plausible-Snippet');
  assert.match(inline[0], /function gtag\(\)\{dataLayer\.push\(arguments\);\}/);
  assert.match(inline[0], /am_consent_analytics/);
  assert.match(inline[1], /^\s*window\.plausible=window\.plausible\|\|function/);
  // Keine Ereignis-Attribute ausser dem Ladetrick des Stylesheets, keine javascript:-Links.
  const handler = [...page.matchAll(/\son[a-z]+="[^"]*"/g)].map((m) => m[0].trim());
  assert.deepEqual(handler, ['onload="this.media=\'all\'"']);
  assert.doesNotMatch(page, /href="javascript:/i);
});

// ---- Kriterium 4: IDs, leere Karten, leeres Auswahlfeld, keine Preise -------------

test('IDs: jede ID und jeder Abschnitt aus dem Fixture genau einmal', () => {
  assert.equal(dom.ids.length, 17);
  for (const id of [...dom.ids, ...dom.sections]) assert.equal(countId(page, id), 1, `ID ${id}`);
  const alle = [...page.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(alle).size, alle.length, 'doppelte ID auf der Seite');
});

test('IDs: Abschnitte in der Reihenfolge Hero, suiten, anfrage, lage, faq, kontakt, Footer', () => {
  const pos = [page.search(/<section\b[^>]*class="g-hero"/),
    ...dom.sections.map((id) => page.search(new RegExp('<section\\b[^>]*\\bid="' + id + '"'))),
    page.search(/<footer\b[^>]*class="footer"/)];
  pos.forEach((p) => assert.ok(p >= 0));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1], `Abschnitt ${i} steht zu frueh`);
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
});

test('Felder: Tag und Attribute wie im Fixture, Honigtopf in div.hp, gb-success verborgen', () => {
  for (const [id, spec] of Object.entries(dom.fields)) {
    const tag = tagOf(page, id);
    assert.ok(tag.startsWith('<' + spec.tag), `${id} ist kein <${spec.tag}>`);
    for (const [name, value] of Object.entries(spec.attrs)) {
      if (value === '') assert.match(tag, new RegExp('\\s' + name + '(\\s|>|=)'), `${id} ohne ${name}`);
      else assert.equal(attr(tag, name), value, `${id} ${name}`);
    }
  }
  assert.match(page, /<div class="hp" aria-hidden="true">(?:(?!<\/div>)[\s\S])*\bid="gb-company-website"/);
  assert.match(tagOf(page, 'gb-success'), /\shidden(\s|>)/);
  assert.match(tagOf(page, 'gb-form'), /\snovalidate(\s|>)/);
  assert.match(tagOf(page, 'gb-name'), /\srequired(\s|>)/);
  assert.match(tagOf(page, 'gb-email'), /\srequired(\s|>)/);
  assert.match(tagOf(page, 'gb-arrival'), /\stype="month"/);
});

test('Karten: gb-cards ist leer, gb-unit hat nur die leere Option', () => {
  assert.match(page, /<div\b[^>]*\bid="gb-cards"[^>]*>\s*<\/div>/);
  const unit = /<select\b[^>]*\bid="gb-unit"[^>]*>([\s\S]*?)<\/select>/.exec(page);
  assert.ok(unit);
  const optionen = [...unit[1].matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(optionen, ['']);
  assert.match(page, /<p\b[^>]*\bid="gb-price-note"[^>]*>\s*<\/p>/);
});

test('Formular: Dauer kennt 1, 2, 3, Personen 1, 2, 3, nie ein Wert ueber 3', () => {
  const werte = (id) => {
    const m = new RegExp('<select\\b[^>]*\\bid="' + id + '"[^>]*>([\\s\\S]*?)</select>').exec(page);
    return [...m[1].matchAll(/<option\b[^>]*\bvalue="([^"]*)"/g)].map((o) => o[1]);
  };
  assert.deepEqual(werte('gb-duration'), ['', '1', '2', '3']);
  assert.deepEqual(werte('gb-persons'), ['1', '2', '3']);
});

test('Preise: kein Preis aus K1, kein CHF-Betrag ab 100, keine Zahl mit Tausender-Apostroph', () => {
  const k1 = units.UNITS.flatMap((u) => [u.price30, u.price60]).filter((p) => p !== null);
  assert.ok(k1.length >= 4);
  for (const p of k1) assert.doesNotMatch(page, new RegExp('(?<![\\w.])' + p + '(?![\\w])'), `Preis ${p} im HTML`);
  assert.doesNotMatch(page, /CHF\s*\d{3,}/);
  assert.doesNotMatch(page, /\b\d{1,3}['’]\d{3}\b/);
  assert.doesNotMatch(page, /\b\d{1,3}['’]?\d{3}\s*(CHF|Franken|\.-)/);
  // Erlaubt ist allein der Parkplatz aus K7 Nr. 12.
  const chf = [...sichtbar(page).matchAll(/CHF\s*(\d+)[^.]{0,20}/g)].map((m) => m[0].trim());
  assert.deepEqual(chf, ['CHF 10 pro Tag', 'CHF 10 pro Tag', 'CHF 10 pro Tag']);
});

test('Einheit: der Aufenthalt zaehlt in Naechten, nie in Monaten', () => {
  assert.doesNotMatch(lesbar(page), /\bMonat(e|en|s)?\b/i);
  assert.doesNotMatch(page, /pro Monat|je Monat|monatlich/i);
  assert.match(sichtbar(page), /30 bis 59 Nächte/);
  assert.match(sichtbar(page), /60 bis 75 Nächte/);
  assert.match(sichtbar(page), /bis höchstens 89 Nächte/);
});

// ---- Kriterium 5: Pflichtaussagen und K7 -------------------------------------------

test('Pflichtaussagen: P1 bis P8 stehen im sichtbaren Text', () => {
  const text = sichtbar(page);
  const keys = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
  assert.deepEqual(Object.keys(dom.pflichtmuster.de), keys);
  for (const p of keys) assert.match(text, new RegExp(dom.pflichtmuster.de[p], 'i'), `Pflichtaussage ${p} fehlt`);
});

test('K7: Zahlen im sichtbaren Text kommen aus K7, K2 oder dem Formular, keine andere', () => {
  const text = sichtbar(page);
  const erlaubt = new Set([
    '30', '89', '59', '60', '75', '3.8', '9.4', '0.8', '11', '1', '2', '3', '10', '8152',
    '41', '562', '97', '00'
  ]);
  const gefunden = [...new Set(text.match(/\d+(?:\.\d+)?/g) || [])];
  const fremd = gefunden.filter((z) => !erlaubt.has(z));
  assert.deepEqual(fremd, [], 'Zahl ausserhalb von K7, K2 und Formular');
  // Entfernungen genau wie in K7 Nr. 11.
  assert.match(text, /Flughafen Zürich: 1 km/);
  assert.match(text, /Zürich HB: 9\.4 km/);
  assert.match(text, /Glatt: 0\.8 km/);
  assert.match(text, /ETH: 11 km/);
  assert.match(text, /Lift im Haus/);
});

test('K7: nichts aus der Liste "Nicht behaupten"', () => {
  const text = lesbar(page);
  const verboten = [/Bewertung/i, /\bSterne?\b/i, /Kaffee/i, /\bTee\b/i, /Verfügbarkeit/i, /Antwortfrist/i,
    /\bStorno/i, /garantier/i, /Waschsalon/i, /Gemeinde/i, /Anmeldung/i, /innerhalb von \d+ Stunden/i,
    /24 Stunden/i];
  for (const re of verboten) assert.doesNotMatch(text, re, `${re} steht auf der Seite`);
});

test('K7: Telefon und Adresse stammen aus K2, keine weitere Nummer, keine fremde Mailadresse', () => {
  assert.equal(config.PHONE, '+41 41 562 97 00');
  assert.ok(page.includes('href="' + config.PHONE_HREF + '"'));
  assert.ok(page.includes('href="mailto:' + config.EMAIL + '"'));
  assert.ok(page.includes('Oberhauserstrasse 30, 8152 Glattbrugg'));
  const tel = new Set([...page.matchAll(/href="tel:([^"]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...tel], ['+41415629700']);
  const mails = new Set([...page.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)].map((m) => m[0]));
  assert.deepEqual([...mails].sort(), ['sales@amanthosliving.com']);
});

test('K7: Sie-Form, Schweizer Orthografie und kein Gedankenstrich', () => {
  const text = sichtbar(page);
  assert.doesNotMatch(page, /\u2014/, 'Gedankenstrich');
  assert.doesNotMatch(page, /ß/, 'Eszett');
  assert.doesNotMatch(text, /\b(dein|deine|deinen|deiner|euch|euer)\b/i, 'Du-Form');
  assert.match(text, /\bSie\b/);
});

// ---- Kriterium 6: noscript und Seite ohne Skript ------------------------------------

test('noscript: #suiten zeigt ohne JavaScript den Hinweis mit Telefon und Adresse', () => {
  const abschnitt = /<section\b[^>]*\bid="suiten"[\s\S]*?<\/section>/.exec(page);
  assert.ok(abschnitt);
  const ns = /<noscript>([\s\S]*?)<\/noscript>/.exec(abschnitt[0]);
  assert.ok(ns, 'noscript in #suiten fehlt');
  assert.match(ns[1], /Preise auf Anfrage/);
  assert.ok(ns[1].includes('href="' + config.PHONE_HREF + '"'));
  assert.ok(ns[1].includes('href="mailto:' + config.EMAIL + '"'));
  assert.equal((page.match(/<noscript>(?!<link)/g) || []).length, 1, 'ein einziger Hinweis-noscript');
});

// ---- Kriterium 7: Zugaenglichkeit, soweit statisch pruefbar --------------------------

test('Zugaenglichkeit: jedes Feld hat genau ein label, der Honigtopf ist aus dem Tabulator genommen', () => {
  const felder = ['gb-name', 'gb-email', 'gb-phone', 'gb-company', 'gb-unit', 'gb-arrival', 'gb-duration',
    'gb-persons', 'gb-message', 'gb-company-website'];
  for (const id of felder) {
    assert.equal((page.match(new RegExp('<label\\b[^>]*\\bfor="' + id + '"[^>]*>[^<]+</label>', 'g')) || []).length, 1,
      `label fuer ${id}`);
  }
  const tabindex = [...page.matchAll(/\btabindex="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(tabindex, ['-1'], 'nur der Honigtopf traegt tabindex');
  assert.equal(attr(tagOf(page, 'gb-company-website'), 'autocomplete'), 'off');
});

test('Zugaenglichkeit: Tastaturreihenfolge Nav, Karten, Formular, Absenden', () => {
  const pos = ['<nav class="nav">', 'id="gb-cards"', 'id="gb-form"', 'id="gb-name"', 'id="gb-submit"', 'id="gb-consent"']
    .map((s) => page.indexOf(s));
  pos.forEach((p) => assert.ok(p >= 0));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1], `Reihenfolge bricht bei Position ${i}`);
});

test('Zugaenglichkeit: Statuszeile mit role="status", Sprunglink, Bilder mit alt, Sprachwechsel markiert', () => {
  assert.equal(attr(tagOf(page, 'gb-status'), 'role'), 'status');
  assert.match(page, /<a href="#main" class="sr-only sr-only-focusable">/);
  assert.match(page, /<main id="main">/);
  for (const img of page.matchAll(/<img\b[^>]*>/g)) assert.notEqual(attr(img[0], 'alt'), null, `${img[0]} ohne alt`);
  assert.match(page, /<a href="\.\.\/long-stay-zurich-airport\/" lang="en" hreflang="en">/);
  assert.match(page, /<button type="button" id="gb-consent">Cookie-Einstellungen<\/button>/);
});

test('Zugaenglichkeit: nichts ist nur mit Animation sichtbar', () => {
  assert.doesNotMatch(page, /opacity\s*:\s*0\b/);
  assert.doesNotMatch(page, /data-animate/);
});

// ---- Kriterium 8: Bilder und Datenschutz-Link -----------------------------------------

test('Bilder: nur vorhandene Dateien unter images/zurich/, keine neue', () => {
  const quellen = [...page.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
  const preload = [...page.matchAll(/<link\b[^>]*\brel="preload"[^>]*\bhref="(\.\.\/images\/[^"]+)"/g)].map((m) => m[1]);
  // Erwartung geaendert beim Abgleich mit der englischen Seite: die zwei Fotos im
  // Abschnitt Suiten sind entfallen (Kategorie nicht belegt), es bleibt das Hero-Bild.
  assert.deepEqual(quellen, ['../images/zurich/hero.webp']);
  for (const q of [...quellen, ...preload]) {
    assert.match(q, /^\.\.\/images\/zurich\/[a-z0-9-]+\.webp$/, `${q} liegt nicht unter images/zurich/`);
    assert.ok(existsSync(join(root, q.replace(/^\.\.\//, ''))), `${q} existiert nicht`);
  }
  assert.doesNotMatch(page, /url\(['"]?(?!\/assets\/fonts)[^)'"]*\.(jpg|png|webp|svg)/);
});

test('Datenschutz: der Link traegt den hreflang der Sprache von privacy/index.html', () => {
  const sprache = /<html\b[^>]*\blang="([^"]+)"/.exec(lies('privacy', 'index.html'))[1];
  const links = [...page.matchAll(/<a\b[^>]*\bhref="\.\.\/privacy\/"[^>]*>/g)].map((m) => m[0]);
  assert.equal(links.length, 2, 'Datenschutz-Link im Formular und im Footer');
  for (const l of links) assert.equal(attr(l, 'hreflang'), sprache, l);
  // Die Seite ist deutsch, die Datenschutzerklaerung nicht: der Besucher erfaehrt es vor dem Klick.
  if (sprache === 'en') assert.match(sichtbar(page), /Datenschutz\S* \(auf Englisch\)/);
});
