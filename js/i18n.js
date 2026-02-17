/**
 * Amanthos Living — i18n (Internationalization) Engine
 * Lightweight translation system for static sites
 * Supports: EN, DE, FR, IT, ZH, JA, KO
 */
(function () {
  'use strict';

  var SUPPORTED_LANGS = {
    en: { name: 'English', native: 'EN', flag: '' },
    de: { name: 'German', native: 'DE', flag: '' },
    fr: { name: 'French', native: 'FR', flag: '' },
    it: { name: 'Italian', native: 'IT', flag: '' },
    zh: { name: 'Chinese', native: '\u4E2D\u6587', flag: '' },
    ja: { name: 'Japanese', native: '\u65E5\u672C\u8A9E', flag: '' },
    ko: { name: 'Korean', native: '\uD55C\uAD6D\uC5B4', flag: '' },
  };

  var DEFAULT_LANG = 'en';
  var STORAGE_KEY = 'amanthos_lang';
  var currentLang = DEFAULT_LANG;
  var translations = {};
  var basePath = '';

  // Detect base path (handles subpages like /zurich/)
  function detectBasePath() {
    var scripts = document.querySelectorAll('script[src*="i18n.js"]');
    if (scripts.length > 0) {
      var src = scripts[0].getAttribute('src');
      basePath = src.replace(/js\/i18n\.js.*$/, '');
    }
  }

  // Detect user language: (0) URL param, (1) localStorage, (2) navigator.language, (3) default EN
  function detectLanguage() {
    // 0. URL parameter ?lang=xx (highest priority, also saves to localStorage)
    try {
      var urlParams = new URLSearchParams(window.location.search);
      var urlLang = urlParams.get('lang');
      if (urlLang && SUPPORTED_LANGS[urlLang.toLowerCase()]) {
        var lang = urlLang.toLowerCase();
        localStorage.setItem(STORAGE_KEY, lang);
        return lang;
      }
    } catch (e) { /* URLSearchParams not supported */ }

    // 1. User preference from localStorage
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGS[stored]) return stored;

    // 2. Browser language
    var browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
    var shortLang = browserLang.split('-')[0];
    if (SUPPORTED_LANGS[shortLang]) return shortLang;

    // 3. Default
    return DEFAULT_LANG;
  }

  // Load translation JSON file
  function loadTranslation(lang, callback) {
    if (translations[lang]) {
      callback(translations[lang]);
      return;
    }

    var url = basePath + 'locales/' + lang + '.json';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            translations[lang] = JSON.parse(xhr.responseText);
          } catch (e) {
            translations[lang] = {};
          }
        } else {
          translations[lang] = {};
        }
        callback(translations[lang]);
      }
    };
    xhr.send();
  }

  // Apply translations to DOM
  function applyTranslations(dict) {
    var elements = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < elements.length; i++) {
      var el = elements[i];
      var key = el.getAttribute('data-i18n');
      var value = getNestedValue(dict, key);
      if (value) {
        // Check for attribute translations (e.g., data-i18n-placeholder)
        if (el.hasAttribute('data-i18n-attr')) {
          var attr = el.getAttribute('data-i18n-attr');
          el.setAttribute(attr, value);
        } else {
          el.textContent = value;
        }
      }
    }

    // Update placeholder attributes
    var placeholders = document.querySelectorAll('[data-i18n-placeholder]');
    for (var p = 0; p < placeholders.length; p++) {
      var pel = placeholders[p];
      var pkey = pel.getAttribute('data-i18n-placeholder');
      var pval = getNestedValue(dict, pkey);
      if (pval) pel.setAttribute('placeholder', pval);
    }

    // Update aria-label attributes
    var ariaLabels = document.querySelectorAll('[data-i18n-aria]');
    for (var a = 0; a < ariaLabels.length; a++) {
      var ael = ariaLabels[a];
      var akey = ael.getAttribute('data-i18n-aria');
      var aval = getNestedValue(dict, akey);
      if (aval) ael.setAttribute('aria-label', aval);
    }

    // Update html lang attribute
    document.documentElement.setAttribute('lang', currentLang);

    // Update meta description
    var metaDesc = document.querySelector('meta[name="description"]');
    var descValue = getNestedValue(dict, 'meta.description');
    if (metaDesc && descValue) {
      metaDesc.setAttribute('content', descValue);
    }

    // Update page title
    var titleValue = getNestedValue(dict, 'meta.title');
    if (titleValue) {
      document.title = titleValue;
    }

    // Load CJK fonts if needed
    if (currentLang === 'zh' || currentLang === 'ja' || currentLang === 'ko') {
      loadCJKFont(currentLang);
    }
  }

  // Get nested value from object (supports "nav.book_now" notation)
  function getNestedValue(obj, key) {
    var parts = key.split('.');
    var current = obj;
    for (var i = 0; i < parts.length; i++) {
      if (current === undefined || current === null) return null;
      current = current[parts[i]];
    }
    return current;
  }

  // Load CJK font only when needed
  var cjkFontLoaded = false;
  function loadCJKFont(lang) {
    if (cjkFontLoaded) return;
    cjkFontLoaded = true;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    if (lang === 'zh') {
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap';
    } else if (lang === 'ja') {
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap';
    } else if (lang === 'ko') {
      link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap';
    }
    document.head.appendChild(link);
    document.body.classList.add('lang-cjk');
  }

  // Switch language
  function switchLanguage(lang) {
    if (!SUPPORTED_LANGS[lang]) return;
    currentLang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
    loadTranslation(lang, function (dict) {
      applyTranslations(dict);
      updateSelector();
      // Dispatch event so other JS can react
      var event;
      try {
        event = new CustomEvent('languageChanged', { detail: { lang: lang } });
      } catch (e) {
        event = document.createEvent('CustomEvent');
        event.initCustomEvent('languageChanged', true, true, { lang: lang });
      }
      document.dispatchEvent(event);
    });
  }

  // Build language selector UI
  function buildSelector() {
    var container = document.getElementById('langSelector');
    if (!container) return;

    var html = '<button class="lang-toggle" aria-label="Select language" aria-expanded="false">';
    html += '<span class="lang-current">' + SUPPORTED_LANGS[currentLang].native + '</span>';
    html += '<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M1 1l4 4 4-4"/></svg>';
    html += '</button>';
    html += '<div class="lang-dropdown" role="listbox" aria-label="Language selection">';

    var langs = Object.keys(SUPPORTED_LANGS);
    for (var i = 0; i < langs.length; i++) {
      var code = langs[i];
      var info = SUPPORTED_LANGS[code];
      var isActive = code === currentLang ? ' active' : '';
      html += '<button class="lang-option' + isActive + '" data-lang="' + code + '" role="option"';
      html += code === currentLang ? ' aria-selected="true"' : ' aria-selected="false"';
      html += '>' + info.native + '</button>';
    }
    html += '</div>';
    container.innerHTML = html;

    // Event handlers
    var toggle = container.querySelector('.lang-toggle');
    var dropdown = container.querySelector('.lang-dropdown');

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
    });

    var options = container.querySelectorAll('.lang-option');
    for (var j = 0; j < options.length; j++) {
      options[j].addEventListener('click', function () {
        var lang = this.getAttribute('data-lang');
        switchLanguage(lang);
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    }

    // Close on outside click
    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  }

  // Update selector highlight
  function updateSelector() {
    var container = document.getElementById('langSelector');
    if (!container) return;
    var currentEl = container.querySelector('.lang-current');
    if (currentEl) {
      currentEl.textContent = SUPPORTED_LANGS[currentLang].native;
    }
    var options = container.querySelectorAll('.lang-option');
    for (var i = 0; i < options.length; i++) {
      var isActive = options[i].getAttribute('data-lang') === currentLang;
      options[i].classList.toggle('active', isActive);
      options[i].setAttribute('aria-selected', isActive);
    }
  }

  // Global translate function for JS files
  window.t = function (key, replacements) {
    var dict = translations[currentLang] || translations[DEFAULT_LANG] || {};
    var value = getNestedValue(dict, key);
    if (!value) {
      // Fallback to English
      var enDict = translations[DEFAULT_LANG] || {};
      value = getNestedValue(enDict, key);
    }
    if (!value) return key;
    // Apply replacements
    if (replacements) {
      var keys = Object.keys(replacements);
      for (var i = 0; i < keys.length; i++) {
        value = value.replace(new RegExp('\\{' + keys[i] + '\\}', 'g'), replacements[keys[i]]);
      }
    }
    return value;
  };

  // Get current language
  window.getLang = function () {
    return currentLang;
  };

  // Initialize
  function init() {
    detectBasePath();
    currentLang = detectLanguage();

    // Always load English as fallback
    loadTranslation(DEFAULT_LANG, function () {
      if (currentLang !== DEFAULT_LANG) {
        loadTranslation(currentLang, function (dict) {
          applyTranslations(dict);
          buildSelector();
        });
      } else {
        applyTranslations(translations[DEFAULT_LANG]);
        buildSelector();
      }
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
