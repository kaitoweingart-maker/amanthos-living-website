/**
 * Amanthos Living: Kategorien Oberhauserstrasse 30, 8152 Glattbrugg fuer
 * Aufenthalte von 30 bis 89 Naechten (Kontrakt K1).
 *
 * Die eine Datenquelle fuer Seiten, Seitenskript und Tests. Reine Daten, kein
 * DOM, keine Logik. Betraege sind CHF brutto je 30 Naechte, inklusive der
 * Mehrwertsteuer aus VAT_LABEL.
 *
 * Jeder Eintrag ist eine Kategorie, keine einzelne Suite: units ist der Bestand
 * im Haus, longstayUnits die Zahl, die fuer diese Aufenthalte frei ist.
 * price30 gilt fuer 30 bis 59 Naechte, price60 fuer 60 bis 89 Naechte.
 *
 * listed steuert, was Seite und Auswahlfeld zeigen. Eine nicht gelistete
 * Kategorie traegt bewusst keinen Preis (null): die Zahl kommt erst mit dem
 * Entscheid, die Kategorie anzubieten. sqm ist null, solange die Flaeche nicht
 * gesichert ist.
 *
 * Quellen: Apaleo Unit Groups GBAL (Codes, Bestand, Personen), Booking.com fuer
 * die Flaechen.
 */
(function () {
  'use strict';

  var UNITS = [
    {
      key: 'classic', code: 'CLS', name: 'Classic Suite',
      sqm: 34, maxPersons: 2, units: 8, longstayUnits: 0,
      price30: null, price60: null, listed: false
    },
    {
      key: 'business', code: 'BUS', name: 'Business Suite',
      sqm: 39, maxPersons: 2, units: 4, longstayUnits: 4,
      price30: 2300, price60: 2100, listed: true
    },
    {
      key: 'superior', code: 'SUPS', name: 'Superior Suite',
      sqm: null, maxPersons: 3, units: 4, longstayUnits: 0,
      price30: null, price60: null, listed: false
    },
    {
      key: 'business-plus', code: 'BUPS', name: 'Business Plus Suite',
      sqm: 41, maxPersons: 3, units: 4, longstayUnits: 4,
      price30: 2440, price60: 2240, listed: true
    },
    {
      key: 'sky', code: 'SKS', name: 'Sky Suite',
      sqm: 38, maxPersons: 3, units: 2, longstayUnits: 0,
      price30: null, price60: null, listed: false
    }
  ];

  var api = {
    UNITS: UNITS,
    EXTRA_PERSON: 250,
    MIN_NIGHTS: 30,
    MAX_NIGHTS: 89,
    VAT_LABEL: '3.8 %',
    CURRENCY: 'CHF',
    VERSION: '1'
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined' && window) window.GLATTBRUGG_UNITS = api;
})();
