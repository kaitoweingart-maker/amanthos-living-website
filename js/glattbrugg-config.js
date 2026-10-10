/**
 * Amanthos Living: Konstanten der Seiten longstay-zuerich-flughafen (deutsch)
 * und long-stay-zurich-airport (englisch), Kontrakt K2.
 *
 * Alles, was die zwei Seiten und das Seitenskript an festen Werten brauchen,
 * steht hier und nur hier. Keine Logik, kein DOM, kein Preis. Aufbau wie
 * js/nyon-config.js, damit die Seiten dasselbe Muster teilen.
 *
 * API_BASE prueft auf typeof ... === 'string' statt auf den Wahrheitswert: der
 * Test-Harness setzt window.AMANTHOS_API_BASE auf den leeren String (gleiche
 * Origin), und ein leerer String ist falsy.
 *
 * ADS_SEND_TO traegt seit der Verdrahtung das Label der eigenen Conversion-Aktion
 * dieser zwei Seiten. Das Seitenskript loest den Aufruf nur nach einer Antwort
 * 200 und nur mit Einwilligung aus (K4). Leer hiesse: kein Conversion-Aufruf,
 * die Kampagne liefe ohne Zaehlung. Das Label des Abschnitts auf /zurich/
 * (js/longstay-config.js) gehoert zu einer anderen Aktion und zaehlte hier falsch.
 *
 * FORM_KIND geht als form=glattbrugg an das Backend und steuert dort Empfaenger
 * und Betreff. CONTENT_NAME ist der content_name des Meta-Ereignisses Lead.
 * PHONE ist die Nummer aus dem JSON-LD von zurich/index.html.
 */
(function () {
  'use strict';

  var api = {
    API_BASE: (typeof window !== 'undefined' && typeof window.AMANTHOS_API_BASE === 'string')
      ? window.AMANTHOS_API_BASE : 'https://amanthos-website-api.onrender.com',
    CONTACT_PATH: '/api/contact',
    FORM_KIND: 'glattbrugg',
    PAGE_URL_DE: 'https://www.amanthosliving.com/longstay-zuerich-flughafen/',
    PAGE_URL_EN: 'https://www.amanthosliving.com/long-stay-zurich-airport/',
    GA4_ID: 'G-8LPLG0BPJ6',
    ADS_ID: 'AW-702540316',
    ADS_SEND_TO: 'AW-702540316/rBzHCJbBgJgdEJzU_84C',
    CONTENT_NAME: 'glattbrugg-longstay',
    PHONE: '+41 41 562 97 00',
    PHONE_HREF: 'tel:+41415629700',
    EMAIL: 'sales@amanthosliving.com',
    VERSION: '1'
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && window) window.GLATTBRUGG_CONFIG = api;
})();
