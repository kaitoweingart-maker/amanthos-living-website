/**
 * Tests der reinen Helfer aus js/anruf.js und des Einbaus auf den Seiten.
 *
 * Ohne DOM: die Datei exportiert genau die Funktionen, die aus einem tel:-Verweis
 * die Nummer lesen, die Nummer im sichtbaren Text finden und ersetzen und die von
 * Google gelieferte Weiterleitungsnummer in ein href verwandeln. Die DOM-Strecke
 * (Nummerntausch, Klickzaehlung) wird im Browser gegen eine echte Klick-ID geprueft,
 * nicht hier.
 *
 * Alle Nummern sind entweder die veroeffentlichten Hausnummern oder erfundene
 * Weiterleitungsnummern. Keine Personendaten, kein Produktionsendpunkt.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const scriptFile = join(here, '..', 'js', 'anruf.js');
const anruf = require(scriptFile);
const src = readFileSync(scriptFile, 'utf8');

// Die vier Seiten mit sichtbarer Nummer, und der Pfad, unter dem sie das Skript laedt.
const SEITEN = [
  ['index.html', './js/anruf.js'],
  ['zurich/index.html', '../js/anruf.js'],
  ['grenchen-mieten/index.html', '../js/anruf.js'],
  ['grenchen-louer/index.html', '../js/anruf.js']
];

test('nummerAusHref liest die Nummer aus dem Verweis', () => {
  assert.equal(anruf.nummerAusHref('tel:+41415629700'), '+41415629700');
  assert.equal(anruf.nummerAusHref('tel:+41 41 563 99 00'), '+41415639900');
  assert.equal(anruf.nummerAusHref('TEL:0041415629700'), '0041415629700');
  assert.equal(anruf.nummerAusHref('mailto:info@example.com'), '');
  assert.equal(anruf.nummerAusHref('tel:123'), '');
  assert.equal(anruf.nummerAusHref(null), '');
});

test('anzeigeAusText findet die Nummer im Beschriftungstext', () => {
  assert.equal(anruf.anzeigeAusText('+41 41 563 99 00 anrufen'), '+41 41 563 99 00');
  assert.equal(anruf.anzeigeAusText('Appeler le +41 41 563 99 00'), '+41 41 563 99 00');
  assert.equal(anruf.anzeigeAusText('Jetzt anrufen'), '');
  // Eine Jahreszahl ist keine Nummer, dafuer steht die Mindestlaenge im Muster.
  assert.equal(anruf.anzeigeAusText('seit 2026'), '');
});

test('textErsetzen tauscht nur die Nummer und laesst den Rest stehen', () => {
  assert.equal(
    anruf.textErsetzen('+41 41 563 99 00 anrufen', '+41 44 111 22 33'),
    '+41 44 111 22 33 anrufen'
  );
  assert.equal(
    anruf.textErsetzen('Appeler le +41 41 563 99 00', '+41 44 111 22 33'),
    'Appeler le +41 44 111 22 33'
  );
  // Ohne Nummer im Text bleibt der Text, wie er ist.
  assert.equal(anruf.textErsetzen('Jetzt anrufen', '+41 44 111 22 33'), 'Jetzt anrufen');
  // Ohne neue Anzeige wird nichts angefasst.
  assert.equal(anruf.textErsetzen('+41 41 563 99 00', ''), '+41 41 563 99 00');
});

test('zielNummer nimmt den ersten brauchbaren Verweis', () => {
  assert.equal(anruf.zielNummer(['mailto:x@example.com', 'tel:+41415629700']), '+41415629700');
  assert.equal(anruf.zielNummer([]), '');
  assert.equal(anruf.zielNummer(undefined), '');
});

test('hrefAusMobil baut das href aus der Antwort von Google', () => {
  assert.equal(anruf.hrefAusMobil('+41 44 111 22 33'), 'tel:+41441112233');
  assert.equal(anruf.hrefAusMobil('tel:+41441112233'), 'tel:+41441112233');
  assert.equal(anruf.hrefAusMobil(''), '');
  assert.equal(anruf.hrefAusMobil('12'), '');
});

test('die beiden Labels zeigen auf das Konto der Anzeigen', () => {
  // Geprueft wird die Form, nicht der Wert: ein fester Vergleich waere beim
  // naechsten Anlegen einer Aktion falsch, ohne dass jemand es merkt.
  const muster = /^AW-\d+\/[A-Za-z0-9_-]{10,}$/;
  assert.match(anruf.CALL_SEND_TO, muster);
  assert.match(anruf.CLICK_SEND_TO, muster);
  assert.notEqual(anruf.CALL_SEND_TO, anruf.CLICK_SEND_TO);
});

test('getauscht wird nur in tel:-Verweisen, nie im uebrigen Dokument', () => {
  // Die Nummer steht auf jeder Seite auch im JSON-LD als telephone des Betriebs.
  // Ein Textlauf ueber das Dokument wuerde sie mittauschen, deshalb darf es ihn
  // in dieser Datei nicht geben.
  assert.ok(src.includes('a[href^="tel:"]'), 'der Verweis-Selektor fehlt');
  assert.ok(!src.includes('createTreeWalker'), 'kein Textlauf ueber das Dokument');
  assert.ok(!src.includes('document.body'), 'kein Zugriff auf den ganzen Body');
});

test('Ads und Meta feuern nur mit Einwilligung', () => {
  const konversion = src.indexOf("send_to: CLICK_SEND_TO");
  const meta = src.indexOf("fbq('track', 'Contact'");
  assert.ok(konversion > 0 && meta > 0);
  // Beide stehen hinter granted(); GA4 und Plausible bewusst nicht.
  assert.ok(src.slice(0, konversion).lastIndexOf('granted()') > src.slice(0, konversion).lastIndexOf('function klickMelden'));
  assert.ok(src.slice(0, meta).lastIndexOf('granted()') > src.slice(0, meta).lastIndexOf("send_to: CLICK_SEND_TO"));
});

test('die vier Seiten mit sichtbarer Nummer laden das Skript', () => {
  for (const [seite, pfad] of SEITEN) {
    const html = readFileSync(join(here, '..', seite), 'utf8');
    assert.ok(html.includes(`src="${pfad}"`), `${seite} laedt ${pfad} nicht`);
    assert.ok(/<a href="tel:/.test(html), `${seite} zeigt keine Nummer`);
    // Das JSON-LD traegt weiterhin die echte Nummer des Betriebs.
    assert.match(html, /"telephone": "\+41 41 5(62 97|63 99) 00"/);
  }
});

test('Seiten ohne sichtbare Nummer laden das Skript nicht', () => {
  for (const seite of ['nyon/index.html', 'solothurn/index.html', 'appartements-nyon/index.html']) {
    const html = readFileSync(join(here, '..', seite), 'utf8');
    if (/<a href="tel:/.test(html)) continue;
    assert.ok(!html.includes('js/anruf.js'), `${seite} laedt das Skript ohne Nummer`);
  }
});

test('GA4 meldet den Klick nur dort, wo kein Seitenskript es schon tut', () => {
  const vorher = globalThis.window;
  try {
    globalThis.window = {};
    assert.equal(anruf.ga4Zustaendig(), true, 'ohne Seitenskript muss GA4 hier feuern');
    globalThis.window = { amLongstayPage: {} };
    assert.equal(anruf.ga4Zustaendig(), false, 'longstay-page.js meldet phone_click selbst');
    globalThis.window = { amGrenchenPage: {} };
    assert.equal(anruf.ga4Zustaendig(), false, 'grenchen-page.js meldet phone_click selbst');
  } finally {
    if (vorher === undefined) { delete globalThis.window; } else { globalThis.window = vorher; }
  }
});

test('das Seitenskript laedt vor der Anrufmessung, sonst greift die Weiche nicht', () => {
  // ga4Zustaendig() liest window.amLongstayPage und window.amGrenchenPage. Beide
  // entstehen beim Ausfuehren des Seitenskripts. defer haelt die Reihenfolge des
  // Dokuments ein, also muss anruf.js hinter dem Seitenskript stehen.
  // Geaenderte Erwartung: /zurich/ stand hier mit js/longstay-page.js. Seit dem Entscheid vom
  // 10.10.2026 (alter Abschnitt Wohnen auf Zeit verborgen) laedt die Seite das Skript nicht
  // mehr; der Test darunter prueft, dass anruf.js dort den Klick selbst an GA4 meldet.
  const paare = [
    ['grenchen-mieten/index.html', 'js/grenchen-page.js'],
    ['grenchen-louer/index.html', 'js/grenchen-page.js']
  ];
  for (const [seite, seitenskript] of paare) {
    const html = readFileSync(join(here, '..', seite), 'utf8');
    assert.ok(html.indexOf(seitenskript) > 0, `${seite} laedt ${seitenskript} nicht`);
    assert.ok(html.indexOf('js/anruf.js') > html.indexOf(seitenskript),
      `${seite} laedt anruf.js vor ${seitenskript}`);
  }
});

test('/zurich/ laedt kein Seitenskript mit eigener Anrufmessung, anruf.js meldet dort selbst', () => {
  // Ohne js/longstay-page.js entsteht window.amLongstayPage auf /zurich/ nicht mehr, also ist
  // ga4Zustaendig() dort wahr, und jeder tel:-Klick der Seite geht als phone_click an GA4.
  const html = readFileSync(join(here, '..', 'zurich/index.html'), 'utf8');
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc="[^"]*js\/(longstay|grenchen)-page\.js"/);
  assert.match(html, /<script\b[^>]*\bsrc="\.\.\/js\/anruf\.js"/);
});

test('die Richtlinie der vier Seiten erlaubt den Anruf-Loader von gstatic', () => {
  // Belegt am 09.09.2026 an der laufenden Messung auf wohnidyll-w5.de: gtag holt
  // fuer die Website-Anrufconversion zuerst https://www.gstatic.com/wcm/loader.js
  // und fragt erst danach die Weiterleitungsnummer ab. Fehlt die Quelle in
  // script-src, blockt der Browser den Loader und es kommt nie zu einer Anfrage.
  // Genau so blieb der Nummerntausch auf amanthosliving.com zunaechst wirkungslos.
  for (const [seite] of SEITEN) {
    const html = readFileSync(join(here, '..', seite), 'utf8');
    const csp = /script-src [^;"]*/.exec(html);
    assert.ok(csp, `${seite} hat keine script-src`);
    assert.ok(csp[0].includes('https://www.gstatic.com'),
      `${seite} erlaubt den Anruf-Loader nicht: ${csp[0]}`);
  }
});
