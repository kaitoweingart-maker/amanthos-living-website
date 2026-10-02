/**
 * Herkunft der Nyon-Anfragen (Fix 03.10.2026).
 *
 * Anfragen ueber nyon-louer kamen ohne Kampagne beim Vertrieb an, weil die
 * Anzeigen nur Klick-Kennungen tragen und die Seite UTM-Werte nur beim Absenden
 * aus der Adresse las. Geprueft wird: Merken in sessionStorage, Ableitung der
 * Quelle aus gclid/fbclid ohne den Wert der Kennung, Rangfolge der Quellen, und
 * dass die daraus entstehende Mailzeile das Muster des Vertriebsscans trifft.
 *
 * Alle Werte sind erfunden; keine echte Adresse, kein echter Name.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const page = require(join(here, '..', 'js', 'nyon-page.js'));

// Kopie der Kontrakte aus den beiden anderen Repos, damit ein Auseinanderlaufen
// hier rot wird statt im Postfach zu verschwinden:
//  - amanthos-platform website-backend/contact_nyon.py: `_UTM` und `rows()`
//  - jarvis services/vertrieb/herkunft.ts: `WEB_KAMPAGNE`
const BACKEND_UTM = /^[A-Za-z0-9._-]{1,64}$/;
const WEB_KAMPAGNE =
  /kampagne\s+([a-z0-9_.-]+)(?:\s*\/\s*([a-z0-9_.-]+))?(?:\s*\/\s*([a-z0-9_.-]+))?/i;

function backendKampagne(payload) {
  return ['utm_source', 'utm_medium', 'utm_campaign']
    .map((k) => (BACKEND_UTM.test(payload[k] || '') ? payload[k] : ''))
    .filter(Boolean)
    .join(' / ');
}

function fakeStorage() {
  const daten = new Map();
  return {
    getItem: (k) => (daten.has(k) ? daten.get(k) : null),
    setItem: (k, v) => { daten.set(k, String(v)); },
    daten
  };
}

beforeEach(() => {
  globalThis.window = { sessionStorage: fakeStorage() };
});

test('UTM-Werte aus der Adresse gehen vor, alle fuenf Schluessel', () => {
  const c = page.campaignFromUrl('?utm_source=google&utm_medium=cpc&utm_campaign=nyon-louer'
    + '&utm_content=bild-a&utm_term=chambre-nyon&gclid=MUSTER123');
  assert.deepEqual(c, {
    utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'nyon-louer',
    utm_content: 'bild-a', utm_term: 'chambre-nyon'
  });
});

test('nur gclid: Quelle google / gclid, der Wert der Kennung steht nirgends', () => {
  const c = page.campaignFromUrl('?gclid=MUSTERKENNUNG');
  assert.equal(c.utm_source, 'google');
  assert.equal(c.utm_medium, 'gclid');
  assert.ok(!JSON.stringify(c).includes('MUSTERKENNUNG'));
});

test('nur fbclid: Quelle meta / fbclid', () => {
  const c = page.campaignFromUrl('?fbclid=MUSTERKENNUNG');
  assert.equal(c.utm_source, 'meta');
  assert.equal(c.utm_medium, 'fbclid');
  assert.ok(!JSON.stringify(c).includes('MUSTERKENNUNG'));
});

test('ohne Parameter bleibt die Kampagne leer', () => {
  const c = page.campaignFromUrl('');
  assert.ok(Object.values(c).every((v) => v === ''));
});

test('Werte, die das Backend verwirft, werden gar nicht erst geschickt', () => {
  const c = page.campaignFromUrl('?utm_source=facebook&utm_campaign=Nyon%20Louer%20Leads');
  assert.equal(c.utm_source, 'facebook');
  assert.equal(c.utm_campaign, '', 'Leerzeichen besteht _UTM im Backend nicht');
});

test('rememberCampaign merkt die Kampagne in sessionStorage', () => {
  page.rememberCampaign('?utm_source=meta&utm_medium=paid_social&utm_campaign=muster-nyon');
  const gemerkt = page.storedCampaign();
  assert.equal(gemerkt.utm_source, 'meta');
  assert.equal(gemerkt.utm_campaign, 'muster-nyon');
});

test('ein spaeterer Aufruf ohne Parameter loescht die gemerkte Kampagne nicht', () => {
  page.rememberCampaign('?gclid=MUSTER');
  page.rememberCampaign('');
  assert.equal(page.storedCampaign().utm_source, 'google');
  assert.ok(!window.sessionStorage.daten.get(page.STORE_KEY).includes('MUSTER"'),
    'nur die abgeleitete Quelle wird gespeichert, nie die Kennung');
});

test('ohne sessionStorage (Privatmodus) wirft nichts', () => {
  globalThis.window = {
    sessionStorage: { getItem() { throw new Error('blockiert'); }, setItem() { throw new Error('blockiert'); } }
  };
  assert.doesNotThrow(() => page.rememberCampaign('?utm_source=google'));
  assert.equal(page.storedCampaign(), null);
});

test('Rangfolge: Adresse vor Sitzung vor meta.js', () => {
  const url = page.campaignFromUrl('?utm_source=google&utm_medium=cpc');
  const sitzung = { utm_source: 'meta', utm_medium: 'fbclid' };
  const meta = { utm_source: 'newsletter' };
  assert.equal(page.pickCampaign(url, sitzung, meta).utm_source, 'google');
  assert.equal(page.pickCampaign(page.campaignFromUrl(''), sitzung, meta).utm_source, 'meta');
  assert.equal(page.pickCampaign(page.campaignFromUrl(''), null, meta).utm_source, 'newsletter');
  assert.equal(page.pickCampaign(null, null, null).utm_source, '');
});

test('ein manipulierter Sitzungswert wird geprueft wie die Adresse', () => {
  const c = page.pickCampaign(null, { utm_source: '<img src=x>', utm_medium: 'cpc' }, null);
  assert.equal(c.utm_source, '');
  assert.equal(c.utm_medium, 'cpc');
});

test('Vertrag mit dem Scan: aus jedem Fall entsteht eine lesbare Kampagnenzeile', () => {
  const faelle = [
    ['?gclid=MUSTER', 'google', ''],
    ['?fbclid=MUSTER', 'meta', ''],
    ['?utm_source=google&utm_medium=cpc&utm_campaign=muster-nyon', 'google', 'muster-nyon'],
    ['?utm_source=meta&utm_medium=paid_social&utm_campaign=muster-nyon', 'meta', 'muster-nyon']
  ];
  for (const [adresse, quelle, kampagne] of faelle) {
    const payload = page.buildPayload({
      name: 'Muster Person', email: 'muster@example.com',
      campaign: page.campaignFromUrl(adresse)
    });
    const zeile = 'Kampagne ' + backendKampagne(payload);
    const treffer = zeile.match(WEB_KAMPAGNE);
    assert.ok(treffer, `keine Kampagnenzeile fuer ${adresse}`);
    assert.equal(treffer[1].toLowerCase(), quelle, adresse);
    assert.equal(treffer[3] || '', kampagne, adresse);
  }
});

test('der Payload traegt alle fuenf UTM-Schluessel', () => {
  const p = page.buildPayload({ campaign: { utm_content: 'bild-a', utm_term: 'nyon' } });
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    assert.ok(k in p, `${k} fehlt`);
  }
  assert.equal(p.utm_content, 'bild-a');
});
