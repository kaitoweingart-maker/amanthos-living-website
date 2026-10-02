/**
 * Amanthos Living: Seitenskript nyon-louer (Kontrakte K3 bis K5).
 *
 * Bewusst schlanker als js/grenchen-page.js: Nyon hat zwei Kategorien, keine
 * 23 Einzelwohnungen. Der Wohnungsfinder samt Filtern entfaellt deshalb
 * vollstaendig, ein Auswahlfeld genuegt.
 *
 * Uebernommen wird dagegen unveraendert, was das Backend und die Messung
 * erwarten: dieselben Payload-Schluessel, dieselbe event_id in Body und
 * Meta-Ereignis, dieselbe Reihenfolge der vier Messkanaele. Wer hier Felder
 * umbenennt, bricht _handle_contact.
 *
 * Die Seite ist einsprachig franzoesisch (lang="fr"), deshalb keine
 * Sprachumschaltung. Was an den Server geht, bleibt trotzdem strukturiert
 * gleich; locale: 'fr' sorgt dafuer, dass die Eingangsbestaetigung franzoesisch
 * ist. Ohne dieses Feld waere sie deutsch, weil der Referer cross-origin auf
 * die Origin gekuerzt wird und das Backend die Seite nicht unterscheiden kann.
 *
 * Herkunft (Fix 03.10.2026): Die Kampagne wird beim Seitenaufruf gelesen und in
 * sessionStorage gemerkt, nicht erst beim Absenden aus der Adresse. Fehlen die
 * UTM-Parameter, aber traegt die Adresse eine Klick-Kennung, steht als Quelle
 * `google / gclid` bzw. `meta / fbclid`: das Backend schreibt daraus die Zeile
 * `Kampagne <quelle> / <medium> / <kampagne>`, und genau diese Zeile liest der
 * Vertriebsscan (jarvis, services/vertrieb/herkunft.ts). Gemerkt wird nur, dass
 * eine Kennung da war, nie ihr Wert; die Kennungen selbst laufen weiter allein
 * ueber window.amMeta.tracking() und damit nur mit Einwilligung.
 */
(function () {
  'use strict';

  var CFG = (typeof window !== 'undefined' && window.NYON_CONFIG) ? window.NYON_CONFIG : {};
  var DATA = (typeof window !== 'undefined' && window.NYON_UNITS) ? window.NYON_UNITS : { UNITS: [] };

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  // Gleiches Muster wie js/grenchen-page.js und `_UTM` in contact_nyon.py: was
  // das Backend verwirft, wird hier gar nicht erst geschickt.
  var UTM_RE = /^[A-Za-z0-9._-]{1,64}$/;
  var STORE_KEY = 'am_nyon_campaign';
  var MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  var UNIT_RE = /^(classic|lakeview)$/;

  var TEXTE = {
    senden: 'Envoi en cours…',
    pflichtName: 'Veuillez indiquer votre nom.',
    pflichtMail: 'Veuillez indiquer une adresse e-mail valable.',
    ok: 'Merci. Nous vous recontactons sous 24 heures.',
    fehler: 'L\'envoi a échoué. Merci de nous appeler au ',
    zuViel: 'Trop de demandes en peu de temps. Merci de réessayer dans quelques minutes.'
  };

  function str(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }

  /**
   * Zufaellige Kennung je Absendung. Sie steht im Body und im Meta-Ereignis,
   * damit der Server-Lead und der Browser-Lead als ein Ereignis zaehlen und
   * nicht doppelt.
   */
  function newEventId() {
    try {
      if (window.crypto && window.crypto.randomUUID) { return window.crypto.randomUUID(); }
    } catch (e) { /* faellt unten durch */ }
    return 'n-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Jeder UTM-Wert wird einzeln geprueft: ein unbrauchbarer kostet nur sich selbst.
  function readCampaign(search) {
    var out = {};
    try {
      var p = new URLSearchParams(str(search));
      UTM_KEYS.forEach(function (key) {
        var v = str(p.get(key));
        out[key] = UTM_RE.test(v) ? v : '';
      });
    } catch (e) {
      UTM_KEYS.forEach(function (key) { out[key] = ''; });
    }
    return out;
  }

  function hatWert(c) {
    return !!c && UTM_KEYS.some(function (key) { return !!c[key]; });
  }

  function leer() {
    var out = {};
    UTM_KEYS.forEach(function (key) { out[key] = ''; });
    return out;
  }

  // Jedes Objekt (gespeichert, aus meta.js) laeuft durch dieselbe Pruefung wie
  // die Adresse: sessionStorage ist von aussen beschreibbar.
  function clean(c) {
    var out = leer();
    if (!c || typeof c !== 'object') { return out; }
    UTM_KEYS.forEach(function (key) {
      var v = str(c[key]);
      out[key] = UTM_RE.test(v) ? v : '';
    });
    return out;
  }

  /**
   * Kampagne aus einer Adresse. UTM-Werte gehen vor; fehlen sie, aber steht eine
   * Klick-Kennung in der Adresse, wird die Quelle daraus abgeleitet. Google-Ads
   * mit Auto-Tagging und Meta-Anzeigen ohne url_tags tragen nur die Kennung.
   */
  function campaignFromUrl(search) {
    var c = readCampaign(search);
    if (hatWert(c)) { return c; }
    try {
      var p = new URLSearchParams(str(search));
      if (str(p.get('gclid'))) { c.utm_source = 'google'; c.utm_medium = 'gclid'; }
      else if (str(p.get('fbclid'))) { c.utm_source = 'meta'; c.utm_medium = 'fbclid'; }
    } catch (e) { /* alte Browser: dann eben keine Kampagne */ }
    return c;
  }

  /**
   * Die erste nicht leere Quelle gewinnt: Adresse beim Absenden, dann der
   * gemerkte Wert dieser Sitzung, dann der Speicher von meta.js (nur mit
   * Einwilligung, 90 Tage).
   */
  function pickCampaign(fromUrl, stored, tracked) {
    var kandidaten = [clean(fromUrl), clean(stored), clean(tracked)];
    for (var n = 0; n < kandidaten.length; n++) {
      if (hatWert(kandidaten[n])) { return kandidaten[n]; }
    }
    return leer();
  }

  function storedCampaign() {
    try {
      var roh = window.sessionStorage.getItem(STORE_KEY);
      return roh ? JSON.parse(roh) : null;
    } catch (e) { return null; }
  }

  // Beim Seitenaufruf: nur schreiben, wenn die Adresse etwas traegt, sonst
  // wuerde ein spaeterer Aufruf ohne Parameter die Kampagne der Sitzung loeschen.
  function rememberCampaign(search) {
    var c = campaignFromUrl(search);
    if (!hatWert(c)) { return; }
    try { window.sessionStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch (e) { /* Privatmodus */ }
  }

  function trackedCampaign() {
    try {
      var t = window.amMeta && window.amMeta.tracking();
      if (!t) { return null; }
      var c = clean(t);
      if (!hatWert(c)) {
        if (str(t.gclid)) { c.utm_source = 'google'; c.utm_medium = 'gclid'; }
        else if (str(t.fbclid)) { c.utm_source = 'meta'; c.utm_medium = 'fbclid'; }
      }
      return c;
    } catch (e) { return null; }
  }

  function buildPayload(input) {
    var i = input || {};
    var campaign = i.campaign || {};
    var unit = str(i.unit);
    var moveIn = str(i.moveIn);
    var out = {
      form: 'nyon',
      name: str(i.name).slice(0, 200),
      email: str(i.email).slice(0, 200),
      phone: str(i.phone).slice(0, 40),
      unit: UNIT_RE.test(unit) ? unit : '',
      rooms: '',
      budget: '',
      move_in: MONTH_RE.test(moveIn) ? moveIn : '',
      wish_slot: '',
      message: str(i.message).slice(0, 5000),
      event_id: str(i.eventId),
      locale: 'fr',
      gclid: str(i.gclid).slice(0, 512),
      fbclid: str(i.fbclid).slice(0, 512),
      company_website: str(i.companyWebsite)
    };
    UTM_KEYS.forEach(function (key) {
      var value = str(campaign[key]);
      out[key] = UTM_RE.test(value) ? value : '';
    });
    return out;
  }

  // ---- Messung (K4) --------------------------------------------------------

  function granted() {
    try { return !!(window.amConsent && window.amConsent.get() === 'granted'); } catch (e) { return false; }
  }

  function ga4(name, params) {
    try { if (typeof window.gtag === 'function') { window.gtag('event', name, params || {}); } } catch (e) { /* nie werfen */ }
  }

  /**
   * Der Lead an alle vier Kanaele. Ads und Meta nur mit Einwilligung.
   * ADS_SEND_TO ist absichtlich leer, solange keine Nyon-Conversion-Aktion
   * existiert; ein leerer Wert meldet nichts, statt ins Leere zu messen.
   */
  function leadEvents(payload) {
    ga4('generate_lead', { lead_form: 'nyon', unit: payload.unit });
    if (granted() && str(CFG.ADS_SEND_TO) && typeof window.gtag === 'function') {
      try { window.gtag('event', 'conversion', { send_to: CFG.ADS_SEND_TO }); } catch (e) { /* nie werfen */ }
    }
    if (granted() && typeof window.fbq === 'function') {
      try {
        window.fbq('track', 'Lead', { content_name: 'nyon-louer' },
          { eventID: String(payload.event_id) });
      } catch (e) { /* nie werfen */ }
    }
    try { if (typeof window.plausible === 'function') { window.plausible('Lead'); } } catch (e) { /* nie werfen */ }
  }

  function clickIds() {
    var out = { gclid: '', fbclid: '' };
    try {
      var t = window.amMeta && window.amMeta.tracking();
      if (t) { out.gclid = str(t.gclid); out.fbclid = str(t.fbclid); }
    } catch (e) { /* ohne Einwilligung bleibt es leer */ }
    return out;
  }

  function statusText(status) {
    if (status === 200) { return TEXTE.ok; }
    if (status === 429) { return TEXTE.zuViel; }
    return TEXTE.fehler + str(CFG.PHONE);
  }

  // ---- DOM (K5) ------------------------------------------------------------

  function initPage() {
    var D = {
      form: document.getElementById('a-form'),
      name: document.getElementById('a-name'),
      email: document.getElementById('a-email'),
      phone: document.getElementById('a-phone'),
      unit: document.getElementById('a-unit'),
      moveIn: document.getElementById('a-movein'),
      message: document.getElementById('a-message'),
      honig: document.getElementById('a-company-website'),
      submit: document.getElementById('a-submit'),
      status: document.getElementById('a-status'),
      success: document.getElementById('a-success')
    };
    if (!D.form) { return; }

    function on(el, type, fn) { if (el) { el.addEventListener(type, fn); } }
    function mark(el, schlecht) { if (el) { el.setAttribute('aria-invalid', schlecht ? 'true' : 'false'); } }

    function setStatus(text, alsFehler) {
      if (!D.status) { return; }
      D.status.textContent = str(text);
      D.status.className = alsFehler ? 'g-status g-status--error' : 'g-status';
    }

    // Auswahlfeld aus den Daten fuellen, damit Preis und Flaeche nur an einer
    // Stelle stehen (K1) und die Seite nicht mit der Datei auseinanderlaeuft.
    function fuelleAuswahl() {
      if (!D.unit) { return; }
      DATA.UNITS.filter(function (u) { return u.listed === true; }).forEach(function (u) {
        var o = document.createElement('option');
        o.value = u.key;
        o.textContent = (u.key === 'lakeview' ? 'Vue sur le lac' : 'Vue jardin')
          + ', ' + u.sqm + ' m2, CHF ' + u.gross + ' par mois';
        D.unit.appendChild(o);
      });
    }

    function validate() {
      if (!str(D.name && D.name.value)) { mark(D.name, true); return [D.name, TEXTE.pflichtName]; }
      var mail = str(D.email && D.email.value);
      if (!mail || mail.indexOf('@') < 1 || mail.indexOf('.') < 0) {
        mark(D.email, true); return [D.email, TEXTE.pflichtMail];
      }
      return null;
    }

    function collect() {
      var ids = clickIds();
      return buildPayload({
        name: D.name && D.name.value,
        email: D.email && D.email.value,
        phone: D.phone && D.phone.value,
        unit: D.unit && D.unit.value,
        moveIn: D.moveIn && D.moveIn.value,
        message: D.message && D.message.value,
        companyWebsite: D.honig && D.honig.value,
        eventId: newEventId(),
        campaign: pickCampaign(campaignFromUrl(window.location.search),
          storedCampaign(), trackedCampaign()),
        gclid: ids.gclid,
        fbclid: ids.fbclid
      });
    }

    function succeed(payload) {
      if (D.form) { D.form.hidden = true; }
      if (D.success) { D.success.hidden = false; }
      setStatus(statusText(200), false);
      leadEvents(payload);
    }

    rememberCampaign(window.location.search);
    fuelleAuswahl();

    on(D.form, 'submit', function (ev) {
      ev.preventDefault();
      var problem = validate();
      if (problem) {
        setStatus(problem[1], true);
        try { problem[0].focus(); } catch (e) { /* egal */ }
        return;
      }
      var payload = collect();
      if (D.submit) { D.submit.disabled = true; }
      setStatus(TEXTE.senden, false);
      fetch(CFG.API_BASE + CFG.CONTACT_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        mode: 'cors',
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.status === 200) { succeed(payload); return; }
        if (D.submit) { D.submit.disabled = false; }
        setStatus(statusText(res.status), true);
      }).catch(function () {
        if (D.submit) { D.submit.disabled = false; }
        setStatus(statusText(0), true);
      });
    });

    [D.name, D.email].forEach(function (el) {
      on(el, 'input', function () { mark(el, false); });
    });

    on(document, 'click', function (ev) {
      var link = (ev.target && ev.target.closest) ? ev.target.closest('a[href^="tel:"]') : null;
      if (link) { ga4('phone_click', { lead_form: 'nyon' }); }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPage);
    } else {
      initPage();
    }
  }

  // fuer die Tests
  var api = {
    buildPayload: buildPayload, readCampaign: readCampaign, campaignFromUrl: campaignFromUrl,
    pickCampaign: pickCampaign, rememberCampaign: rememberCampaign, storedCampaign: storedCampaign,
    statusText: statusText, STORE_KEY: STORE_KEY, VERSION: '2'
  };
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (typeof window !== 'undefined' && window) { window.NYON_PAGE = api; }
})();
