/**
 * Amanthos Living: Seitenskript longstay-zuerich-flughafen (de) und
 * long-stay-zurich-airport (en), Kontrakte K1, K3, K4, K5. Aufbau wie
 * js/nyon-page.js, nur zweisprachig: die Sprache kommt aus <html lang> (en,
 * sonst de), dynamische Texte stehen in TEXTE, statische im HTML.
 *
 * Karten, Preishinweis und Auswahlfeld entstehen zur Laufzeit aus
 * GLATTBRUGG_UNITS (K1); kein Betrag steht im HTML oder in dieser Datei. Nicht
 * gelistete Kategorien werden nie gerendert. Wie bei Nyon: dieselbe event_id in
 * Body und Meta-Ereignis, Ereignisse erst nach 200, gclid und fbclid nur ueber
 * window.amMeta.tracking(). Das Skript schreibt nichts in den Browser. Ohne
 * gb-form tut initPage nichts. Unter Node laedt das Modul seine Daten per
 * require, damit die Helfer ohne Fenster testbar sind.
 */
(function () {
  'use strict';

  function laden(name, datei) {
    try {
      if (typeof window !== 'undefined' && window[name]) { return window[name]; }
      if (typeof require === 'function') { return require(datei); }
    } catch (e) { /* ohne Daten bleibt der Rest leer */ }
    return null;
  }

  var CFG = laden('GLATTBRUGG_CONFIG', './glattbrugg-config.js') || {};
  var DATA = laden('GLATTBRUGG_UNITS', './glattbrugg-units.js') || { UNITS: [] };

  var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign'];
  var UTM_RE = /^[A-Za-z0-9._-]{1,64}$/;
  var MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
  var MAIL_RE = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
  var EVENT_RE = /^[A-Za-z0-9-]{8,64}$/;
  var SET_123 = /^[123]$/;

  // Abrechnungseinheit der Preise (K1) und Beginn der zweiten Staffel.
  var BLOCK = 30;
  var STAFFEL2_AB = 60;

  var TEXTE = {
    de: {
      senden: 'Wird gesendet ...', pflichtName: 'Bitte geben Sie Ihren Namen an.',
      pflichtMail: 'Bitte geben Sie eine gültige E-Mail-Adresse an.',
      ok: 'Vielen Dank. Wir melden uns persönlich bei Ihnen.',
      pruefen: 'Bitte prüfen Sie Name und E-Mail-Adresse.',
      zuViel: 'Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in einer Minute erneut.',
      fehlerVor: 'Die Anfrage konnte nicht gesendet werden. Rufen Sie uns an: ',
      fehlerMitte: ', oder schreiben Sie an ', fehlerEnde: '.',
      bis: ' bis ', naechte: ' Nächte', jeBlock: ' je ' + BLOCK + ' Nächte',
      rund: 'rund ', proNacht: ' pro Nacht',
      personen: 'bis {n} Personen',
      suiten1: '1 Suite für diese Aufenthalte', suitenN: '{n} Suiten für diese Aufenthalte',
      zuschlag: 'Zuschlag je weitere Person: ',
      hinweis: 'Alle Beträge in CHF je ' + BLOCK + ' Nächte, brutto, inkl. {mwst} MWST.'
    },
    en: {
      senden: 'Sending ...', pflichtName: 'Please enter your name.',
      pflichtMail: 'Please enter a valid email address.',
      ok: 'Thank you. We will get back to you personally.',
      pruefen: 'Please check your name and email address.',
      zuViel: 'Too many requests in a short time. Please try again in a minute.',
      fehlerVor: 'Your request could not be sent. Please call us on ',
      fehlerMitte: ' or write to ', fehlerEnde: '.',
      bis: ' to ', naechte: ' nights', jeBlock: ' per ' + BLOCK + ' nights',
      rund: 'about ', proNacht: ' per night',
      personen: 'up to {n} guests',
      suiten1: '1 suite for these stays', suitenN: '{n} suites for these stays',
      zuschlag: 'Surcharge per additional guest: ',
      hinweis: 'All amounts in CHF per ' + BLOCK + ' nights, gross, incl. {mwst} VAT.'
    }
  };

  function str(v) { return (v === undefined || v === null) ? '' : String(v).trim(); }
  function localeOf(lang) { return /^en/i.test(str(lang)) ? 'en' : 'de'; }
  function T(lang) { return TEXTE[localeOf(lang)]; }
  function fill(text, n) { return text.replace('{n}', String(n)); }

  // ---- Preise (K1) ---------------------------------------------------------
  /** Betrag mit Tausender-Apostroph, Waehrung davor. */
  function formatChf(n) {
    return (DATA.CURRENCY || 'CHF') + ' ' + String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  /** Preis je Block auf eine Nacht gerundet. */
  function perNight(preis) { return Math.round(Number(preis) / BLOCK); }

  /** Alles, was eine Karte zeigt, als Daten; null fuer jede nicht gelistete Kategorie. */
  function cardModel(unit, lang) {
    if (!unit || unit.listed !== true) { return null; }
    if (typeof unit.price30 !== 'number' || typeof unit.price60 !== 'number') { return null; }
    var t = T(lang);
    var von = [DATA.MIN_NIGHTS || BLOCK, STAFFEL2_AB];
    var bis = [STAFFEL2_AB - 1, DATA.MAX_NIGHTS];
    var lines = [unit.price30, unit.price60].map(function (p, i) {
      return {
        label: von[i] + t.bis + bis[i] + t.naechte, price: p,
        priceText: formatChf(p) + t.jeBlock,
        nightText: t.rund + formatChf(perNight(p)) + t.proNacht
      };
    });
    return {
      key: unit.key,
      name: unit.name,
      sqm: unit.sqm,
      sqmText: typeof unit.sqm === 'number' ? unit.sqm + ' m²' : '',
      persons: unit.maxPersons,
      personsText: fill(t.personen, unit.maxPersons),
      units: unit.longstayUnits,
      unitsText: fill(unit.longstayUnits === 1 ? t.suiten1 : t.suitenN, unit.longstayUnits),
      lines: lines,
      extraText: t.zuschlag + formatChf(DATA.EXTRA_PERSON) + t.jeBlock
    };
  }

  // ---- Payload (K3) --------------------------------------------------------
  /** Kennung je Absendung (Body und Meta-Ereignis); der Parameter ersetzt crypto fuer den Test. */
  function newEventId(c) {
    try {
      var k = c || (typeof crypto !== 'undefined' ? crypto : (typeof window !== 'undefined' ? window.crypto : null));
      if (k && typeof k.randomUUID === 'function') {
        var id = k.randomUUID();
        if (EVENT_RE.test(id)) { return id; }
      }
    } catch (e) { /* faellt unten durch */ }
    return 'g-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Jeder UTM-Wert wird einzeln geprueft: ein unbrauchbarer kostet nur sich selbst.
  function readCampaign(search) {
    var out = {}, p = null;
    try { p = new URLSearchParams(str(search)); } catch (e) { /* bleibt leer */ }
    UTM_KEYS.forEach(function (key) {
      var v = p ? str(p.get(key)) : '';
      out[key] = UTM_RE.test(v) ? v : '';
    });
    return out;
  }

  function buildPayload(input) {
    var i = input || {};
    var campaign = i.campaign || {};
    function menge(re, v) { return re.test(str(v)) ? str(v) : ''; }
    var out = {
      form: str(CFG.FORM_KIND) || 'glattbrugg',
      name: str(i.name).slice(0, 200),
      email: str(i.email).slice(0, 200),
      phone: str(i.phone).slice(0, 40),
      company: str(i.company).slice(0, 200),
      unit: DATA.UNITS.some(function (u) { return u.key === str(i.unit); }) ? str(i.unit) : '',
      arrival_month: menge(MONTH_RE, i.arrival),
      duration_months: menge(SET_123, i.duration),
      persons: menge(SET_123, i.persons),
      message: str(i.message).slice(0, 5000),
      event_id: str(i.eventId),
      locale: localeOf(i.lang)
    };
    UTM_KEYS.forEach(function (key) { out[key] = menge(UTM_RE, campaign[key]); });
    out.gclid = str(i.gclid).slice(0, 512);
    out.fbclid = str(i.fbclid).slice(0, 512);
    out.company_website = str(i.companyWebsite);
    return out;
  }

  /** Text je Statuscode in der Seitensprache; ein Servertext wird nie ausgegeben. */
  function statusText(status, lang) {
    var t = T(lang);
    if (status === 200) { return t.ok; }
    if (status === 400) { return t.pruefen; }
    if (status === 429) { return t.zuViel; }
    return t.fehlerVor + str(CFG.PHONE) + t.fehlerMitte + str(CFG.EMAIL) + t.fehlerEnde;
  }

  /** Anreisefenster: laufender Monat bis plus zwoelf, je als YYYY-MM. */
  function arrivalBounds(heute) {
    var d = heute || new Date();
    function ym(jahr, monat) { return jahr + '-' + (monat < 9 ? '0' : '') + (monat + 1); }
    return { min: ym(d.getFullYear(), d.getMonth()), max: ym(d.getFullYear() + 1, d.getMonth()) };
  }

  // ---- Messung (K4) --------------------------------------------------------
  function granted() {
    try { return !!(window.amConsent && window.amConsent.get() === 'granted'); } catch (e) { return false; }
  }

  function ga4(name, params) {
    try { if (typeof window.gtag === 'function') { window.gtag('event', name, params || {}); } } catch (e) { /* nie werfen */ }
  }

  /** Lead an alle Kanaele nach 200, ohne Personendaten; Ads und Meta nur mit Einwilligung. */
  function leadEvents(payload, cfg) {
    var c = cfg || CFG;
    ga4('generate_lead', { lead_form: 'glattbrugg', unit: payload.unit,
      duration_months: payload.duration_months, locale: payload.locale });
    if (granted() && str(c.ADS_SEND_TO)) { ga4('conversion', { send_to: c.ADS_SEND_TO }); }
    try {
      if (granted() && typeof window.fbq === 'function') {
        window.fbq('track', 'Lead', { content_name: c.CONTENT_NAME }, { eventID: String(payload.event_id) });
      }
    } catch (e) { /* nie werfen */ }
    try {
      if (typeof window.plausible === 'function') {
        window.plausible('Lead', { props: { form: 'glattbrugg', locale: payload.locale } });
      }
    } catch (e) { /* nie werfen */ }
  }

  function clickIds() {
    var out = { gclid: '', fbclid: '' };
    try {
      var t = window.amMeta && window.amMeta.tracking();
      if (t) { out.gclid = str(t.gclid); out.fbclid = str(t.fbclid); }
    } catch (e) { /* ohne Einwilligung bleibt es leer */ }
    return out;
  }

  // ---- DOM (K5) ------------------------------------------------------------
  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) { e.className = klasse; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function renderCard(m) {
    var card = el('div', 'gb-card'), body = el('div', 'gb-card-body');
    body.appendChild(el('h3', '', m.name));
    body.appendChild(el('p', 'gb-meta', [m.sqmText, m.personsText, m.unitsText].filter(Boolean).join(', ')));
    m.lines.forEach(function (l) {
      [['gb-meta', l.label], ['gb-price', l.priceText], ['gb-night', l.nightText]].forEach(function (z) {
        body.appendChild(el('p', z[0], z[1]));
      });
    });
    body.appendChild(el('p', 'gb-meta', m.extraText));
    card.appendChild(body);
    return card;
  }

  function initPage() {
    var D = {
      cards: document.getElementById('gb-cards'),
      note: document.getElementById('gb-price-note'),
      form: document.getElementById('gb-form'),
      name: document.getElementById('gb-name'),
      email: document.getElementById('gb-email'),
      phone: document.getElementById('gb-phone'),
      company: document.getElementById('gb-company'),
      unit: document.getElementById('gb-unit'),
      arrival: document.getElementById('gb-arrival'),
      duration: document.getElementById('gb-duration'),
      persons: document.getElementById('gb-persons'),
      message: document.getElementById('gb-message'),
      honig: document.getElementById('gb-company-website'),
      submit: document.getElementById('gb-submit'),
      status: document.getElementById('gb-status'),
      success: document.getElementById('gb-success'),
      consent: document.getElementById('gb-consent')
    };
    if (!D.form) { return; }

    var lang = localeOf(document.documentElement.getAttribute('lang'));
    var t = TEXTE[lang], senden = false;

    function on(e, type, fn) { if (e) { e.addEventListener(type, fn); } }
    function mark(e, schlecht) { if (e) { e.setAttribute('aria-invalid', schlecht ? 'true' : 'false'); } }

    // Telefon und Adresse im Fehlertext werden zu tel- und mailto-Links.
    function setStatus(text, alsFehler) {
      if (!D.status) { return; }
      var links = {};
      links[str(CFG.PHONE)] = str(CFG.PHONE_HREF);
      links[str(CFG.EMAIL)] = 'mailto:' + str(CFG.EMAIL);
      D.status.textContent = '';
      D.status.className = alsFehler ? 'g-status g-status--error' : 'g-status';
      var re = new RegExp('(' + Object.keys(links).map(function (k) {
        return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('|') + ')');
      str(text).split(re).forEach(function (teil) {
        if (!links[teil]) { D.status.appendChild(document.createTextNode(teil)); return; }
        var a = el('a', '', teil);
        a.setAttribute('href', links[teil]);
        D.status.appendChild(a);
      });
    }

    function zeigeKarten() {
      var modelle = DATA.UNITS.map(function (u) { return cardModel(u, lang); })
        .filter(function (m) { return m !== null; });
      modelle.forEach(function (m) {
        if (D.cards) { D.cards.appendChild(renderCard(m)); }
        if (D.unit) {
          var o = el('option', '', [m.name, m.sqmText].filter(Boolean).join(', '));
          o.value = m.key;
          D.unit.appendChild(o);
        }
      });
      if (D.note) { D.note.textContent = t.hinweis.replace('{mwst}', str(DATA.VAT_LABEL)); }
    }

    function setzeFenster() {
      if (!D.arrival) { return; }
      var b = arrivalBounds(new Date());
      D.arrival.setAttribute('min', b.min);
      D.arrival.setAttribute('max', b.max);
    }

    // Beide Felder werden geprueft und markiert; gemeldet wird das erste.
    function validate() {
      var nameOk = str(D.name && D.name.value).length >= 2;
      var mailOk = MAIL_RE.test(str(D.email && D.email.value));
      mark(D.name, !nameOk);
      mark(D.email, !mailOk);
      if (!nameOk) { return [D.name, t.pflichtName]; }
      if (!mailOk) { return [D.email, t.pflichtMail]; }
      return null;
    }

    function collect() {
      var ids = clickIds();
      function v(e) { return e ? e.value : ''; }
      return buildPayload({
        name: v(D.name), email: v(D.email), phone: v(D.phone), company: v(D.company),
        unit: v(D.unit), arrival: v(D.arrival), duration: v(D.duration), persons: v(D.persons),
        message: v(D.message), companyWebsite: v(D.honig), eventId: newEventId(), lang: lang,
        campaign: readCampaign(window.location.search), gclid: ids.gclid, fbclid: ids.fbclid
      });
    }

    function succeed(payload) {
      D.form.hidden = true;
      setStatus('', false);
      if (D.success) {
        D.success.textContent = statusText(200, lang);
        D.success.hidden = false;
        D.success.setAttribute('tabindex', '-1');
        try { D.success.focus(); } catch (e) { /* egal */ }
      }
      leadEvents(payload, CFG);
    }

    function scheitern(status) {
      senden = false;
      if (D.submit) { D.submit.disabled = false; }
      setStatus(statusText(status, lang), true);
    }

    zeigeKarten();
    setzeFenster();

    on(D.form, 'submit', function (ev) {
      ev.preventDefault();
      if (senden) { return; }
      var problem = validate();
      if (problem) {
        setStatus(problem[1], true);
        try { problem[0].focus(); } catch (e) { /* egal */ }
        return;
      }
      var payload = collect();
      senden = true;
      if (D.submit) { D.submit.disabled = true; }
      setStatus(t.senden, false);
      fetch(CFG.API_BASE + CFG.CONTACT_PATH, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, mode: 'cors',
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (res.status === 200) { succeed(payload); return; }
        scheitern(res.status);
      }).catch(function () { scheitern(0); });
    });

    [D.name, D.email].forEach(function (e) {
      on(e, 'input', function () { mark(e, false); });
    });

    on(D.consent, 'click', function () {
      try { if (window.amConsent) { window.amConsent.open(); } } catch (e) { /* nie werfen */ }
    });

    on(document, 'click', function (ev) {
      var link = (ev.target && ev.target.closest) ? ev.target.closest('a[href^="tel:"]') : null;
      if (link) { ga4('phone_click', { lead_form: 'glattbrugg' }); }
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initPage); }
    else { initPage(); }
  }

  // fuer die Tests
  var api = {
    formatChf: formatChf, perNight: perNight, cardModel: cardModel, buildPayload: buildPayload,
    readCampaign: readCampaign, newEventId: newEventId, statusText: statusText, localeOf: localeOf,
    arrivalBounds: arrivalBounds, leadEvents: leadEvents, VERSION: '1'
  };
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  if (typeof window !== 'undefined' && window) { window.GLATTBRUGG_PAGE = api; }
})();
