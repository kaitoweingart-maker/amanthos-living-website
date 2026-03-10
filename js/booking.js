(function () {
'use strict';

var API_BASE = window.AMANTHOS_API_BASE || 'https://amanthos-website-api.onrender.com';
var PROPERTIES = {
  'GBAL': { name: 'Zurich Airport', short: 'Zurich' },
  'GNBE': { name: 'Solothurn / Grenchen', short: 'Solothurn' },
  'NYAL': { name: 'Nyon / Duillier', short: 'Nyon' },
};

var selectedOffer = null;
var currentOffers = [];
var searchParams = {};
var selectedExtras = { parking: false, towels: false, pillows: false };

// dataLayer helper for GTM
window.dataLayer = window.dataLayer || [];
function gtmPush(event, data) {
  var obj = { event: event };
  if (data) { var k = Object.keys(data); for (var i = 0; i < k.length; i++) { obj[k[i]] = data[k[i]]; } }
  window.dataLayer.push(obj);
}

// Promo code configuration
var PROMO_CODES = {
  'DM23102901TEST100BBPR': { discount: 1.0, label: '100%' },
};
var appliedPromo = null;

var searchBtn = document.getElementById('bookingSearchBtn');
var bookingSection = document.getElementById('booking');
var offersGrid = document.getElementById('offersGrid');
var offersLoading = document.getElementById('offersLoading');
var guestForm = document.getElementById('guestForm');
var confirmBtn = document.getElementById('confirmBookingBtn');
var cancelBtn = document.getElementById('cancelBookingBtn');
var bookingStatus = document.getElementById('bookingStatus');

// ========== CUSTOM CALENDAR ==========
var checkinEl = document.getElementById('bb-checkin');
var checkoutEl = document.getElementById('bb-checkout');
var nightsBadge = document.getElementById('nightsBadge');
var daterangeWrap = document.getElementById('daterangeWrap');
var daterangeLabel = document.getElementById('daterangeLabel');

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function epoch(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

var MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
var MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
var DAYS_HEAD = ['Mo','Tu','We','Th','Fr','Sa','Su'];
var DAYS_NAME = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtDate(d) {
  return DAYS_NAME[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
}

var cal = {
  checkin: null, checkout: null,
  selecting: null,
  month: new Date().getMonth(),
  year: new Date().getFullYear(),
  hoverDate: null,
  el: null
};

function buildCalendar() {
  var div = document.createElement('div');
  div.id = 'calDropdown';
  div.className = 'cal-dropdown';
  div.innerHTML =
    '<div class="cal-picks">' +
      '<button class="cal-pick" data-pick="tonight">Tonight</button>' +
      '<button class="cal-pick" data-pick="weekend">This Weekend</button>' +
      '<button class="cal-pick" data-pick="next-weekend">Next Weekend</button>' +
      '<button class="cal-pick" data-pick="week">1 Week</button>' +
    '</div>' +
    '<div class="cal-nav">' +
      '<button class="cal-nav-btn cal-prev" aria-label="Previous month">\u2039</button>' +
      '<span class="cal-title"></span>' +
      '<button class="cal-nav-btn cal-next" aria-label="Next month">\u203A</button>' +
    '</div>' +
    '<div class="cal-head">' + DAYS_HEAD.map(function (d) { return '<span>' + d + '</span>'; }).join('') + '</div>' +
    '<div class="cal-body"></div>' +
    '<div class="cal-foot"><span class="cal-info"></span></div>';
  document.body.appendChild(div);
  cal.el = div;

  div.querySelector('.cal-prev').addEventListener('click', function (e) {
    e.stopPropagation();
    cal.month--;
    if (cal.month < 0) { cal.month = 11; cal.year--; }
    renderCal();
  });
  div.querySelector('.cal-next').addEventListener('click', function (e) {
    e.stopPropagation();
    cal.month++;
    if (cal.month > 11) { cal.month = 0; cal.year++; }
    renderCal();
  });

  div.querySelectorAll('.cal-pick').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      quickPick(this.dataset.pick);
    });
  });

  div.querySelector('.cal-body').addEventListener('click', function (e) {
    var btn = e.target.closest('button.cal-day');
    if (!btn || btn.classList.contains('disabled') || btn.classList.contains('empty')) return;
    e.preventDefault();
    e.stopPropagation();
    var d = parseInt(btn.dataset.day);
    pickDate(new Date(cal.year, cal.month, d, 12, 0, 0));
  });

  div.querySelector('.cal-body').addEventListener('mouseover', function (e) {
    var btn = e.target.closest('button.cal-day');
    if (!btn || btn.classList.contains('disabled') || btn.classList.contains('empty')) return;
    if (cal.selecting !== 'checkout') return;
    var d = parseInt(btn.dataset.day);
    var hDate = new Date(cal.year, cal.month, d, 12, 0, 0);
    if (cal.checkin && epoch(hDate) <= epoch(cal.checkin)) return;
    if (cal.hoverDate && epoch(cal.hoverDate) === epoch(hDate)) return;
    cal.hoverDate = hDate;
    updateRangeHighlight();
  });
  div.querySelector('.cal-body').addEventListener('mouseleave', function () {
    if (cal.hoverDate) {
      cal.hoverDate = null;
      updateRangeHighlight();
    }
  });

  document.addEventListener('click', function (e) {
    if (!cal.el || !cal.el.classList.contains('open')) return;
    if (cal.el.contains(e.target)) return;
    if (daterangeWrap && (e.target === daterangeWrap || daterangeWrap.contains(e.target))) return;
    closeCal();
  });

  window.addEventListener('scroll', function () {
    if (cal.el && cal.el.classList.contains('open') && cal.selecting) positionCal(cal.selecting);
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (cal.el && cal.el.classList.contains('open') && cal.selecting) positionCal(cal.selecting);
  });
}

function positionCal(mode) {
  if (!cal.el) return;
  var wrap = daterangeWrap;
  if (!wrap) return;
  var rect = wrap.getBoundingClientRect();
  var calW = 320;
  var calH = cal.el.offsetHeight || 400;
  var left = rect.left + (rect.width / 2) - (calW / 2);
  var top = rect.bottom + 10;
  if (left + calW > window.innerWidth - 16) left = window.innerWidth - calW - 16;
  if (left < 16) left = 16;
  if (top + calH > window.innerHeight - 16) top = rect.top - calH - 10;
  cal.el.style.left = left + 'px';
  cal.el.style.top = top + 'px';
}

function openCal(mode) {
  if (!cal.el) buildCalendar();
  // Close other dropdowns
  if (guestsDropdown && guestsDropdown.classList.contains('open')) guestsDropdown.classList.remove('open');
  if (locationDropdown && locationDropdown.classList.contains('open')) locationDropdown.classList.remove('open');
  cal.selecting = mode;
  var ref = mode === 'checkin' ? cal.checkin : (cal.checkout || cal.checkin);
  if (ref) { cal.month = ref.getMonth(); cal.year = ref.getFullYear(); }
  renderCal();
  positionCal(mode);
  cal.el.classList.add('open');
}

function closeCal() {
  if (cal.el) cal.el.classList.remove('open');
  cal.hoverDate = null;
}

function pickDate(date) {
  var today = new Date(); today.setHours(0, 0, 0, 0);
  if (date < today) return;

  if (cal.selecting === 'checkin') {
    cal.checkin = date;
    if (cal.checkout && epoch(cal.checkout) <= epoch(date)) cal.checkout = null;
    cal.selecting = 'checkout';
    syncInputs();
    renderCal();
  } else {
    if (!cal.checkin || epoch(date) <= epoch(cal.checkin)) {
      cal.checkin = date;
      cal.checkout = null;
      cal.selecting = 'checkout';
      syncInputs();
      renderCal();
    } else {
      cal.checkout = date;
      syncInputs();
      closeCal();
    }
  }
}

function quickPick(type) {
  var today = new Date(); today.setHours(12, 0, 0, 0);
  var dow = today.getDay();
  if (type === 'tonight') {
    cal.checkin = new Date(today);
    cal.checkout = new Date(today.getTime() + 86400000);
  } else if (type === 'weekend') {
    var d2f = (5 - dow + 7) % 7;
    if (d2f === 0 && dow === 5) d2f = 0; else if (d2f === 0) d2f = 7;
    var fri = new Date(today); fri.setDate(today.getDate() + d2f);
    cal.checkin = fri;
    cal.checkout = new Date(fri.getTime() + 2 * 86400000);
  } else if (type === 'next-weekend') {
    var d2f2 = (5 - dow + 7) % 7; if (d2f2 <= 0) d2f2 += 7; d2f2 += 7;
    var fri2 = new Date(today); fri2.setDate(today.getDate() + d2f2);
    cal.checkin = fri2;
    cal.checkout = new Date(fri2.getTime() + 2 * 86400000);
  } else if (type === 'week') {
    var d2f3 = (5 - dow + 7) % 7; if (d2f3 < 2) d2f3 += 7;
    var fri3 = new Date(today); fri3.setDate(today.getDate() + d2f3);
    cal.checkin = fri3;
    cal.checkout = new Date(fri3.getTime() + 7 * 86400000);
  }
  syncInputs();
  closeCal();
}

function renderCal() {
  if (!cal.el) return;
  cal.el.querySelector('.cal-title').textContent = MONTHS_FULL[cal.month] + ' ' + cal.year;
  cal.el.querySelector('.cal-info').textContent = cal.selecting === 'checkin'
    ? (window.t ? window.t('calendar.select_checkin') : 'Select check-in date')
    : (window.t ? window.t('calendar.select_checkout') : 'Select check-out date');

  var first = new Date(cal.year, cal.month, 1);
  var daysInMonth = new Date(cal.year, cal.month + 1, 0).getDate();
  var startDow = (first.getDay() + 6) % 7;
  var today = new Date(); today.setHours(0, 0, 0, 0);

  var html = '';
  for (var i = 0; i < startDow; i++) html += '<span class="cal-day empty"></span>';

  for (var d = 1; d <= daysInMonth; d++) {
    var date = new Date(cal.year, cal.month, d, 12, 0, 0);
    var t = epoch(date);
    var cls = 'cal-day';
    if (date < today) cls += ' disabled';
    if (d === today.getDate() && cal.month === today.getMonth() && cal.year === today.getFullYear()) cls += ' today';
    if (cal.checkin && t === epoch(cal.checkin)) cls += ' selected';
    if (cal.checkout && t === epoch(cal.checkout)) cls += ' selected';
    var rangeEnd = cal.checkout || cal.hoverDate;
    if (cal.checkin && rangeEnd && t > epoch(cal.checkin) && t < epoch(rangeEnd)) cls += ' in-range';
    html += '<button type="button" class="' + cls + '" data-day="' + d + '">' + d + '</button>';
  }
  cal.el.querySelector('.cal-body').innerHTML = html;

  var prevBtn = cal.el.querySelector('.cal-prev');
  var now = new Date();
  prevBtn.style.opacity = (cal.year === now.getFullYear() && cal.month === now.getMonth()) ? '.2' : '';
  prevBtn.style.pointerEvents = (cal.year === now.getFullYear() && cal.month === now.getMonth()) ? 'none' : '';
}

function updateRangeHighlight() {
  if (!cal.el) return;
  var days = cal.el.querySelectorAll('.cal-day[data-day]');
  var rangeEnd = cal.checkout || cal.hoverDate;
  for (var i = 0; i < days.length; i++) {
    var d = parseInt(days[i].dataset.day);
    var t = epoch(new Date(cal.year, cal.month, d, 12, 0, 0));
    if (cal.checkin && rangeEnd && t > epoch(cal.checkin) && t < epoch(rangeEnd)) {
      days[i].classList.add('in-range');
    } else {
      days[i].classList.remove('in-range');
    }
  }
}

function syncInputs() {
  if (checkinEl) {
    checkinEl.dataset.date = cal.checkin ? toISO(cal.checkin) : '';
  }
  if (checkoutEl) {
    checkoutEl.dataset.date = cal.checkout ? toISO(cal.checkout) : '';
  }
  if (daterangeLabel) {
    if (cal.checkin && cal.checkout) {
      daterangeLabel.textContent = fmtDate(cal.checkin) + '  \u2192  ' + fmtDate(cal.checkout);
      daterangeLabel.classList.add('has-value');
    } else if (cal.checkin) {
      daterangeLabel.textContent = fmtDate(cal.checkin) + '  \u2192  ...';
      daterangeLabel.classList.add('has-value');
    } else {
      daterangeLabel.textContent = window.t ? window.t('booking_bar.set_dates') : 'Set Dates';
      daterangeLabel.classList.remove('has-value');
    }
  }
  updateNightsBadge();
}

function updateNightsBadge() {
  if (!nightsBadge) return;
  if (cal.checkin && cal.checkout) {
    var nights = Math.round((epoch(cal.checkout) - epoch(cal.checkin)) / 86400000);
    if (nights > 0) {
      nightsBadge.textContent = nights + (nights === 1 ? ' night' : ' nights');
      nightsBadge.classList.add('visible');
      return;
    }
  }
  nightsBadge.classList.remove('visible');
}

// Attach date range click handler
if (daterangeWrap) {
  daterangeWrap.addEventListener('click', function (e) {
    e.stopPropagation();
    if (guestsDropdown && guestsDropdown.classList.contains('open')) guestsDropdown.classList.remove('open');
    if (locationDropdown && locationDropdown.classList.contains('open')) locationDropdown.classList.remove('open');
    if (cal.el && cal.el.classList.contains('open')) {
      closeCal();
      return;
    }
    var mode = (cal.checkin && !cal.checkout) ? 'checkout' : 'checkin';
    if (cal.checkin && cal.checkout) {
      cal.checkin = null;
      cal.checkout = null;
      syncInputs();
      mode = 'checkin';
    }
    openCal(mode);
  });
}

buildCalendar();

// ========== LOCATION DROPDOWN ==========
var locationWrap = document.getElementById('locationWrap');
var locationLabel = document.getElementById('locationLabel');
var locationInput = document.getElementById('bb-location');
var locationDropdown = null;

function buildLocationDropdown() {
  var div = document.createElement('div');
  div.id = 'locationDropdown';
  div.className = 'location-dropdown';
  var keys = Object.keys(PROPERTIES);
  var html = '';
  for (var i = 0; i < keys.length; i++) {
    html += '<button type="button" class="location-option" data-value="' + keys[i] + '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
      '<span>' + PROPERTIES[keys[i]].name + '</span>' +
    '</button>';
  }
  div.innerHTML = html;
  document.body.appendChild(div);
  locationDropdown = div;

  div.querySelectorAll('.location-option').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var val = this.dataset.value;
      selectLocation(val);
      closeLocationDropdown();
    });
  });

  document.addEventListener('click', function (e) {
    if (!locationDropdown || !locationDropdown.classList.contains('open')) return;
    if (locationDropdown.contains(e.target)) return;
    if (locationWrap && (e.target === locationWrap || locationWrap.contains(e.target))) return;
    closeLocationDropdown();
  });

  window.addEventListener('scroll', function () {
    if (locationDropdown && locationDropdown.classList.contains('open')) positionLocationDropdown();
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (locationDropdown && locationDropdown.classList.contains('open')) positionLocationDropdown();
  });
}

function selectLocation(val) {
  if (locationInput) locationInput.value = val;
  if (locationLabel) {
    locationLabel.textContent = PROPERTIES[val] ? PROPERTIES[val].name : val;
    locationLabel.classList.add('has-value');
  }
  // Highlight selected option
  if (locationDropdown) {
    locationDropdown.querySelectorAll('.location-option').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.value === val);
    });
  }
}

function positionLocationDropdown() {
  if (!locationDropdown || !locationWrap) return;
  var rect = locationWrap.getBoundingClientRect();
  var ddW = 280;
  var left = rect.left + (rect.width / 2) - (ddW / 2);
  var top = rect.bottom + 10;
  if (left + ddW > window.innerWidth - 16) left = window.innerWidth - ddW - 16;
  if (left < 16) left = 16;
  if (top + locationDropdown.offsetHeight > window.innerHeight - 16) top = rect.top - locationDropdown.offsetHeight - 10;
  locationDropdown.style.left = left + 'px';
  locationDropdown.style.top = top + 'px';
}

function openLocationDropdown() {
  if (!locationDropdown) buildLocationDropdown();
  // Close other dropdowns
  if (cal.el && cal.el.classList.contains('open')) closeCal();
  if (guestsDropdown && guestsDropdown.classList.contains('open')) guestsDropdown.classList.remove('open');
  positionLocationDropdown();
  locationDropdown.classList.add('open');
}

function closeLocationDropdown() {
  if (locationDropdown) locationDropdown.classList.remove('open');
}

if (locationWrap) {
  locationWrap.addEventListener('click', function (e) {
    e.stopPropagation();
    if (locationDropdown && locationDropdown.classList.contains('open')) {
      closeLocationDropdown();
    } else {
      openLocationDropdown();
    }
  });
}

// ========== GUESTS DROPDOWN (Adults + Children) ==========
var guestsWrap = document.getElementById('guestsWrap');
var guestsLabel = document.getElementById('guestsLabel');
var guestInput = document.getElementById('bb-guests');
var childInput = document.getElementById('bb-children');
var guestsDropdown = null;

function buildGuestsDropdown() {
  var div = document.createElement('div');
  div.id = 'guestsDropdown';
  div.className = 'guests-dropdown';
  div.innerHTML =
    '<div class="guests-row">' +
      '<span class="guests-row-label" data-i18n="booking_bar.adults">Adults</span>' +
      '<div class="guests-stepper">' +
        '<button type="button" class="guests-step" id="adultMinus" aria-label="Less">\u2212</button>' +
        '<span class="guests-count" id="adultCount">2</span>' +
        '<button type="button" class="guests-step" id="adultPlus" aria-label="More">+</button>' +
      '</div>' +
    '</div>' +
    '<div class="guests-row">' +
      '<span class="guests-row-label" data-i18n="booking_bar.children">Children</span>' +
      '<div class="guests-stepper">' +
        '<button type="button" class="guests-step" id="childMinus" aria-label="Less">\u2212</button>' +
        '<span class="guests-count" id="childCount">0</span>' +
        '<button type="button" class="guests-step" id="childPlus" aria-label="More">+</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(div);
  guestsDropdown = div;

  div.querySelectorAll('[data-i18n]').forEach(function (el) {
    var key = el.getAttribute('data-i18n');
    var val = window.t ? window.t(key) : null;
    if (val && val !== key) el.textContent = val;
  });

  document.addEventListener('languageChanged', function () {
    if (!guestsDropdown) return;
    guestsDropdown.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = window.t ? window.t(key) : null;
      if (val && val !== key) el.textContent = val;
    });
    updateGuestsLabel();
  });

  div.querySelector('#adultMinus').addEventListener('click', function (e) { e.stopPropagation(); updateGuestCount('adults', -1); });
  div.querySelector('#adultPlus').addEventListener('click', function (e) { e.stopPropagation(); updateGuestCount('adults', 1); });
  div.querySelector('#childMinus').addEventListener('click', function (e) { e.stopPropagation(); updateGuestCount('children', -1); });
  div.querySelector('#childPlus').addEventListener('click', function (e) { e.stopPropagation(); updateGuestCount('children', 1); });

  document.addEventListener('click', function (e) {
    if (!guestsDropdown || !guestsDropdown.classList.contains('open')) return;
    if (guestsDropdown.contains(e.target)) return;
    if (guestsWrap && (e.target === guestsWrap || guestsWrap.contains(e.target))) return;
    closeGuestsDropdown();
  });

  window.addEventListener('scroll', function () {
    if (guestsDropdown && guestsDropdown.classList.contains('open')) positionGuestsDropdown();
  }, { passive: true });
  window.addEventListener('resize', function () {
    if (guestsDropdown && guestsDropdown.classList.contains('open')) positionGuestsDropdown();
  });
}

function updateGuestCount(type, dir) {
  if (type === 'adults') {
    var val = parseInt(guestInput.value) || 1;
    var newVal = Math.max(1, Math.min(6, val + dir));
    guestInput.value = newVal;
    var el = document.getElementById('adultCount');
    if (el) el.textContent = newVal;
  } else {
    var val2 = parseInt(childInput.value) || 0;
    var newVal2 = Math.max(0, Math.min(4, val2 + dir));
    childInput.value = newVal2;
    var el2 = document.getElementById('childCount');
    if (el2) el2.textContent = newVal2;
  }
  updateGuestsLabel();
}

function updateGuestsLabel() {
  if (!guestsLabel) return;
  var adults = parseInt(guestInput.value) || 1;
  var children = parseInt(childInput.value) || 0;
  var label = adults + ' ' + (adults === 1 ? (window.t ? window.t('booking.adult_singular') : 'Adult') : (window.t ? window.t('booking.adults_plural') : 'Adults'));
  if (children > 0) {
    label += ', ' + children + ' ' + (children === 1 ? (window.t ? window.t('booking.child_singular') : 'Child') : (window.t ? window.t('booking.children_plural') : 'Children'));
  }
  guestsLabel.textContent = label;
  guestsLabel.classList.add('has-value');
}

function positionGuestsDropdown() {
  if (!guestsDropdown || !guestsWrap) return;
  var rect = guestsWrap.getBoundingClientRect();
  var ddW = 260;
  var left = rect.left + (rect.width / 2) - (ddW / 2);
  var top = rect.bottom + 10;
  if (left + ddW > window.innerWidth - 16) left = window.innerWidth - ddW - 16;
  if (left < 16) left = 16;
  if (top + guestsDropdown.offsetHeight > window.innerHeight - 16) top = rect.top - guestsDropdown.offsetHeight - 10;
  guestsDropdown.style.left = left + 'px';
  guestsDropdown.style.top = top + 'px';
}

function openGuestsDropdown() {
  if (!guestsDropdown) buildGuestsDropdown();
  // Close other dropdowns
  if (cal.el && cal.el.classList.contains('open')) closeCal();
  if (locationDropdown && locationDropdown.classList.contains('open')) locationDropdown.classList.remove('open');
  positionGuestsDropdown();
  guestsDropdown.classList.add('open');
}

function closeGuestsDropdown() {
  if (guestsDropdown) guestsDropdown.classList.remove('open');
}

if (guestsWrap) {
  guestsWrap.addEventListener('click', function (e) {
    e.stopPropagation();
    if (guestsDropdown && guestsDropdown.classList.contains('open')) {
      closeGuestsDropdown();
    } else {
      openGuestsDropdown();
    }
  });
}


function showValidation(el, msg) {
  if (!el) return;
  var existing = el.parentElement.querySelector('.validation-msg');
  if (existing) existing.remove();
  var span = document.createElement('span');
  span.className = 'validation-msg';
  span.textContent = msg;
  span.style.cssText = 'color:var(--color-error);font-size:.78rem;font-weight:500;margin-top:.25rem;display:block;';
  span.setAttribute('role', 'alert');
  el.parentElement.appendChild(span);
  el.style.borderColor = 'var(--color-error)';
  el.focus();
  el.addEventListener('input', function handler() {
    el.style.borderColor = '';
    var m = el.parentElement.querySelector('.validation-msg');
    if (m) m.remove();
    el.removeEventListener('input', handler);
  });
}

// Wake backend on idle — keep retrying until warm
var backendWarm = false;
function wakeBackend() {
  fetch(API_BASE + '/health', { mode: 'cors' })
    .then(function (res) { if (res.ok) backendWarm = true; else throw new Error(); })
    .catch(function () { setTimeout(wakeBackend, 2000); });
}
// Fire immediately, then also on idle
wakeBackend();
if ('requestIdleCallback' in window) {
  requestIdleCallback(wakeBackend);
}

// Inline validation on blur
['guest-first', 'guest-last', 'guest-email'].forEach(function (id) {
  var field = document.getElementById(id);
  if (!field) return;
  field.addEventListener('blur', function () {
    var val = this.value.trim();
    var existing = this.parentElement.querySelector('.validation-msg');
    if (existing) existing.remove();
    this.style.borderColor = '';
    if (!val) {
      showValidation(this, window.t ? window.t('booking.validation_required') : 'This field is required.');
    } else if (id === 'guest-email' && !isValidEmail(val)) {
      showValidation(this, window.t ? window.t('booking.validation_valid_email') : 'Please enter a valid email address.');
    } else {
      this.style.borderColor = 'var(--color-success)';
    }
  });
});

// Promo code
var applyPromoBtn = document.getElementById('applyPromoBtn');
if (applyPromoBtn) {
  applyPromoBtn.addEventListener('click', applyPromoCode);
}
var promoInput = document.getElementById('promoCodeInput');
if (promoInput) {
  promoInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); applyPromoCode(); }
  });
}

// Search button
if (searchBtn) {
  searchBtn.addEventListener('click', function () {
    var locationVal = locationInput ? locationInput.value : '';
    var checkin = document.getElementById('bb-checkin');
    var checkout = document.getElementById('bb-checkout');
    var guests = document.getElementById('bb-guests');
    var childrenEl = document.getElementById('bb-children');
    var checkinVal = checkin ? (checkin.dataset.date || '') : '';
    var checkoutVal = checkout ? (checkout.dataset.date || '') : '';
    var guestsVal = guests ? guests.value : '2';
    var childrenVal = childrenEl ? childrenEl.value : '0';

    // Validate location
    if (!locationVal) {
      if (locationWrap) locationWrap.click();
      return;
    }

    // Validate dates
    if (!checkinVal || !checkoutVal) {
      if (daterangeWrap) daterangeWrap.click();
      return;
    }
    if (checkoutVal <= checkinVal) {
      cal.checkin = null; cal.checkout = null; syncInputs();
      if (daterangeWrap) daterangeWrap.click();
      return;
    }

    searchParams = {
      propertyId: locationVal,
      arrival: checkinVal,
      departure: checkoutVal,
      adults: guestsVal,
      children: childrenVal,
    };

    gtmPush('search_availability', {
      location: PROPERTIES[locationVal] ? PROPERTIES[locationVal].name : locationVal,
      check_in: checkinVal,
      check_out: checkoutVal,
      guests: guestsVal,
      children: childrenVal
    });

    fetchOffers();
  });
}

function showSkeletonCards() {
  if (!offersGrid) return;
  var html = '';
  for (var s = 0; s < 3; s++) {
    html += '<div class="skeleton-card" aria-hidden="true">';
    html += '<div class="skeleton skeleton-line w-40"></div>';
    html += '<div class="skeleton skeleton-line h-md w-60"></div>';
    html += '<div class="skeleton skeleton-line w-80"></div>';
    html += '<div class="skeleton skeleton-line h-lg w-40"></div>';
    html += '<div class="skeleton skeleton-line w-60"></div>';
    html += '<div class="skeleton skeleton-line h-btn w-100"></div>';
    html += '</div>';
  }
  offersGrid.innerHTML = html;
}

function fetchOffers(retryCount) {
  retryCount = retryCount || 0;
  var MAX_RETRIES = 5;
  var RETRY_DELAYS = [3000, 5000, 7000, 10000, 12000];

  if (!bookingSection || !offersGrid || !offersLoading) return;
  bookingSection.style.display = 'block';
  if (retryCount === 0) {
    offersGrid.innerHTML = '';
    if (guestForm) guestForm.style.display = 'none';
    if (bookingStatus) bookingStatus.style.display = 'none';
    selectedOffer = null;
    showSkeletonCards();
    setTimeout(function () {
      bookingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  var query = '';
  var keys = Object.keys(searchParams);
  for (var i = 0; i < keys.length; i++) {
    if (i > 0) query += '&';
    query += encodeURIComponent(keys[i]) + '=' + encodeURIComponent(searchParams[keys[i]]);
  }

  fetch(API_BASE + '/api/offers?' + query, { mode: 'cors' })
  .then(function (res) {
    if (!res.ok) {
      return res.json().then(function (errData) {
        throw new Error(errData.error || 'Failed to fetch offers (HTTP ' + res.status + ')');
      }).catch(function () {
        throw new Error('Failed to fetch offers (HTTP ' + res.status + ')');
      });
    }
    return res.json();
  })
  .then(function (data) {
    offersLoading.style.display = 'none';
    currentOffers = data.offers || [];
    backendWarm = true;
    gtmPush('view_offers', {
      location: PROPERTIES[searchParams.propertyId] ? PROPERTIES[searchParams.propertyId].name : searchParams.propertyId,
      offer_count: currentOffers.length
    });
    if (currentOffers.length === 0) {
      offersGrid.innerHTML = '<div class="no-offers"><p>' + (window.t ? window.t('booking.no_offers') : 'No availability found for the selected dates. Please try different dates or another location.') + '</p></div>';
      return;
    }
    renderOffers(data);
  })
  .catch(function (err) {
    var isColdStart = err.message && err.message.indexOf('Failed to fetch') !== -1;

    // Auto-retry on cold start — user never sees the error
    if (isColdStart && retryCount < MAX_RETRIES) {
      // Show friendly waking-up skeleton with progress message
      var wakingMsg = window.t ? window.t('booking.warming_up') : 'Connecting to booking server...';
      if (retryCount >= 1) wakingMsg = window.t ? window.t('booking.almost_ready') : 'Almost ready, loading your rates...';
      var skeletonWrap = offersGrid.querySelector('.skeleton-wrap');
      if (!skeletonWrap) {
        showSkeletonCards();
        skeletonWrap = offersGrid.querySelector('.skeleton-wrap') || offersGrid;
      }
      var existingMsg = offersGrid.querySelector('.waking-msg');
      if (existingMsg) existingMsg.remove();
      var wakingEl = document.createElement('p');
      wakingEl.className = 'waking-msg';
      wakingEl.style.cssText = 'text-align:center;font-size:.85rem;color:var(--color-text-muted);padding:.75rem 0;animation:pulse 1.5s ease-in-out infinite;';
      wakingEl.textContent = wakingMsg;
      offersGrid.insertBefore(wakingEl, offersGrid.firstChild);

      setTimeout(function () { fetchOffers(retryCount + 1); }, RETRY_DELAYS[retryCount]);
      return;
    }

    // Only show error after all retries exhausted
    offersLoading.style.display = 'none';
    var msg = window.t ? window.t('booking.unable_to_check') : 'Unable to check availability right now.';

    var noOffersDiv = document.createElement('div');
    noOffersDiv.className = 'no-offers';
    noOffersDiv.setAttribute('role', 'alert');

    var msgP = document.createElement('p');
    msgP.textContent = msg;
    msgP.style.cssText = 'font-size:.95rem;color:var(--color-text);margin-bottom:.5rem;font-weight:500;';
    noOffersDiv.appendChild(msgP);

    var helpP = document.createElement('p');
    helpP.style.cssText = 'font-size:.82rem;color:var(--color-text-muted);margin-bottom:1rem;';
    helpP.textContent = window.t ? window.t('booking.error_help') : 'Please try again or contact us at info@amanthosliving.com';
    noOffersDiv.appendChild(helpP);

    var retryBtn = document.createElement('button');
    retryBtn.className = 'btn btn-accent';
    retryBtn.style.marginTop = '.5rem';
    retryBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:.35rem;"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> ' + (window.t ? window.t('booking.try_again') : 'Try Again');
    retryBtn.addEventListener('click', function () { fetchOffers(0); });
    noOffersDiv.appendChild(retryBtn);

    offersGrid.innerHTML = '';
    offersGrid.appendChild(noOffersDiv);
    gtmPush('booking_error', { error_message: err.message || 'Unknown error', step: 'fetch_offers' });
    console.error('Offers error:', err);
  });
}

function renderOffers(data) {
  var html = '';
  var nights = data.nights || 1;
  var propName = PROPERTIES[data.property] ? PROPERTIES[data.property].name : data.propertyName;

  var nightLabel = nights === 1 ? (window.t ? window.t('booking.night') : 'night') : (window.t ? window.t('booking.nights') : 'nights');
  var adultLabel = data.adults == 1 ? (window.t ? window.t('booking.adult_singular') : 'adult') : (window.t ? window.t('booking.adults_plural') : 'adults');
  var childrenCount = parseInt(searchParams.children) || 0;
  var guestSummary = data.adults + ' ' + adultLabel;
  if (childrenCount > 0) {
    var childLabel = childrenCount === 1 ? (window.t ? window.t('booking.child_singular') : 'child') : (window.t ? window.t('booking.children_plural') : 'children');
    guestSummary += ', ' + childrenCount + ' ' + childLabel;
  }

  html += '<div class="offers-summary">';
  html += '<h3>' + escapeHtml(propName) + '</h3>';
  html += '<div class="offers-summary-dates">' + escapeHtml(data.arrival) + ' &mdash; ' + escapeHtml(data.departure) + '</div>';
  html += '<div class="offers-summary-detail">' + nights + ' ' + nightLabel + ' &middot; ' + guestSummary + '</div>';
  var viewerCount = Math.floor(Math.random() * 8) + 3;
  var lookingMsg = window.t ? window.t('booking.people_looking', { n: viewerCount, loc: escapeHtml(PROPERTIES[data.property] ? PROPERTIES[data.property].short : '') }) : viewerCount + ' people are looking at ' + escapeHtml(PROPERTIES[data.property] ? PROPERTIES[data.property].short : '') + ' right now';
  html += '<p class="offers-urgency"><span class="urgency-dot"></span> ' + lookingMsg + '</p>';
  html += '</div>';

  var refundable = currentOffers.filter(function (o) { return o.category === 'Refundable'; });
  var nonRefundable = currentOffers.filter(function (o) { return o.category === 'Non-Refundable'; });

  if (nonRefundable.length > 0) {
    html += '<h4 class="offers-category-title">' + (window.t ? window.t('booking.best_price_label') : 'Best Price — Non-Refundable') + '</h4>';
    html += '<div class="offers-grid-wrap">';
    nonRefundable.forEach(function (offer, i) {
      html += renderOfferCard(offer, 'non-refundable', i, true);
    });
    html += '</div>';
  }
  if (refundable.length > 0) {
    html += '<h4 class="offers-category-title">' + (window.t ? window.t('booking.flexible_label') : 'Flexible — Refundable') + '</h4>';
    html += '<div class="offers-grid-wrap">';
    refundable.forEach(function (offer, i) {
      html += renderOfferCard(offer, 'refundable', nonRefundable.length + i, false);
    });
    html += '</div>';
  }

  offersGrid.innerHTML = html;
  offersGrid.querySelectorAll('.offer-card').forEach(function (card) {
    card.addEventListener('click', function () {
      var idx = parseInt(this.getAttribute('data-index'));
      selectOffer(idx);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        var idx = parseInt(this.getAttribute('data-index'));
        selectOffer(idx);
      }
    });
  });
}

function renderOfferCard(offer, categoryClass, index, isBestPrice) {
  var total = offer.totalGrossAmount || {};
  var perNight = offer.averagePerNight || {};
  var currency = total.currency || 'CHF';
  var totalAmount = total.amount ? total.amount.toFixed(0) : '\u2014';
  var perNightAmount = perNight.amount ? perNight.amount.toFixed(0) : '\u2014';

  var html = '<div class="offer-card' + (isBestPrice ? ' best-price' : '') + '" data-index="' + index + '" tabindex="0" role="button" aria-label="Select ' + escapeHtml(offer.unitGroupName || '') + ' ' + escapeHtml(offer.category) + '">';
  html += '<div class="offer-card-top">';
  html += '<div class="offer-unit">' + escapeHtml(offer.unitGroupName || (window.t ? window.t('booking.apartment') : 'Apartment')) + '</div>';
  html += '<span class="offer-category ' + categoryClass + '">' + (categoryClass === 'refundable' ? (window.t ? window.t('booking.flexible') : 'Flexible') : (window.t ? window.t('booking.best_price_tag') : 'Best Price')) + '</span>';
  html += '</div>';
  html += '<div class="offer-rate-name">' + escapeHtml(offer.ratePlanName || '') + '</div>';
  html += '<div class="offer-bottom">';
  html += '<div>';
  html += '<div class="offer-pricing">';
  html += '<div class="offer-price">CHF ' + perNightAmount + ' <small>' + (window.t ? window.t('booking.per_night') : '/ night') + '</small></div>';
  html += '<div class="offer-total">CHF ' + totalAmount + ' ' + (window.t ? window.t('booking.total') : 'total') + '</div>';
  html += '</div>';
  if (offer.availableUnits > 0 && offer.availableUnits <= 3) {
    html += '<div class="offer-scarcity">' + (window.t ? window.t('booking.only_left', { n: offer.availableUnits }) : 'Only ' + offer.availableUnits + ' left!') + '</div>';
  }
  html += '<div class="offer-trust">';
  html += '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ';
  html += categoryClass === 'refundable' ? (window.t ? window.t('booking.free_cancellation') : 'Free cancellation') : (window.t ? window.t('booking.best_rate_guaranteed') : 'Best rate guaranteed');
  html += '</div>';
  html += '</div>';
  html += '<div class="offer-select-btn">' + (window.t ? window.t('booking.select') : 'Select') + ' &rarr;</div>';
  html += '</div>';
  html += '</div>';
  return html;
}

function selectOffer(index) {
  selectedOffer = currentOffers[index];
  if (!selectedOffer) return;

  offersGrid.querySelectorAll('.offer-card').forEach(function (card, i) {
    card.classList.toggle('selected', i === index);
  });

  if (guestForm) guestForm.style.display = 'none';
  if (bookingStatus) bookingStatus.style.display = 'none';

  // Reset extras
  selectedExtras = { parking: false, towels: false, pillows: false };
  var parkingCb = document.getElementById('extra-parking');
  var towelsCb = document.getElementById('extra-towels');
  var pillowsCb = document.getElementById('extra-pillows');
  if (parkingCb) parkingCb.checked = false;
  if (towelsCb) towelsCb.checked = false;
  if (pillowsCb) pillowsCb.checked = false;

  appliedPromo = null;
  var promoMsg = document.getElementById('promoMessage');
  if (promoMsg) promoMsg.textContent = '';
  var promoInp = document.getElementById('promoCodeInput');
  if (promoInp) promoInp.value = '';
  updatePriceDisplay();

  gtmPush('select_offer', {
    rate_name: selectedOffer.ratePlanName || '',
    category: selectedOffer.category || '',
    total_price: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0,
    currency: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
    unit_type: selectedOffer.unitGroupName || ''
  });

  // Show upselling section
  showUpsellSection(index);
}

function showUpsellSection(selectedIndex) {
  var upsellSection = document.getElementById('upsellSection');
  if (!upsellSection) {
    // Fallback: go straight to guest form if upsell section doesn't exist
    showGuestForm();
    return;
  }

  // Calculate nights
  var nights = 1;
  if (searchParams.arrival && searchParams.departure) {
    var arrDate = new Date(searchParams.arrival);
    var depDate = new Date(searchParams.departure);
    nights = Math.round((depDate - arrDate) / 86400000);
    if (nights < 1) nights = 1;
  }

  // Show room upgrade suggestions (more expensive offers of different unit type)
  var upgradeSection = document.getElementById('upsellUpgrade');
  var upgradeCards = document.getElementById('upsellUpgradeCards');
  if (upgradeSection && upgradeCards) {
    var upgrades = currentOffers.filter(function (o, i) {
      if (i === selectedIndex) return false;
      if (!o.totalGrossAmount || !selectedOffer.totalGrossAmount) return false;
      return o.totalGrossAmount.amount > selectedOffer.totalGrossAmount.amount && o.category === selectedOffer.category;
    });

    if (upgrades.length > 0) {
      var upgradeHtml = '';
      upgrades.slice(0, 2).forEach(function (upgrade, i) {
        var priceDiff = upgrade.averagePerNight.amount - selectedOffer.averagePerNight.amount;
        upgradeHtml += '<div class="upsell-upgrade-card" data-upgrade-index="' + currentOffers.indexOf(upgrade) + '">';
        upgradeHtml += '<div class="upsell-upgrade-info">';
        upgradeHtml += '<strong>' + escapeHtml(upgrade.unitGroupName || 'Premium Room') + '</strong>';
        upgradeHtml += '<span class="upsell-upgrade-rate">' + escapeHtml(upgrade.ratePlanName || '') + '</span>';
        upgradeHtml += '<span class="upsell-upgrade-price">CHF ' + upgrade.averagePerNight.amount.toFixed(0) + ' / night</span>';
        upgradeHtml += '</div>';
        upgradeHtml += '<div class="upsell-upgrade-action">';
        upgradeHtml += '<span class="upsell-upgrade-diff">+CHF ' + priceDiff.toFixed(0) + '/night</span>';
        upgradeHtml += '<button class="btn btn-outline upsell-upgrade-btn">Upgrade</button>';
        upgradeHtml += '</div>';
        upgradeHtml += '</div>';
      });
      upgradeCards.innerHTML = upgradeHtml;
      upgradeSection.style.display = 'block';

      // Add upgrade click handlers
      upgradeCards.querySelectorAll('.upsell-upgrade-card').forEach(function (card) {
        card.querySelector('.upsell-upgrade-btn').addEventListener('click', function (e) {
          e.preventDefault();
          var upgradeIdx = parseInt(card.dataset.upgradeIndex);
          selectOffer(upgradeIdx);
        });
      });
    } else {
      upgradeSection.style.display = 'none';
    }
  }

  // Update extras total display
  updateUpsellTotal(nights);

  upsellSection.style.display = 'block';
  upsellSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function updateUpsellTotal(nights) {
  if (!nights) {
    nights = 1;
    if (searchParams.arrival && searchParams.departure) {
      var arrDate = new Date(searchParams.arrival);
      var depDate = new Date(searchParams.departure);
      nights = Math.round((depDate - arrDate) / 86400000);
      if (nights < 1) nights = 1;
    }
  }
  var total = 0;
  if (selectedExtras.parking) total += 7.5 * nights;
  if (selectedExtras.towels) total += 5 * nights;
  if (selectedExtras.pillows) total += 10 * nights;

  var upsellTotal = document.getElementById('upsellTotal');
  var upsellTotalAmount = document.getElementById('upsellTotalAmount');
  var upsellPerNight = document.getElementById('upsellPerNight');

  if (upsellTotal && upsellTotalAmount) {
    if (total > 0) {
      upsellTotalAmount.textContent = 'CHF ' + total.toFixed(2);
      if (upsellPerNight) {
        var perDay = 0;
        if (selectedExtras.parking) perDay += 7.5;
        if (selectedExtras.towels) perDay += 5;
        if (selectedExtras.pillows) perDay += 10;
        upsellPerNight.textContent = '(CHF ' + perDay.toFixed(2) + ' / day \u00D7 ' + nights + ' nights)';
      }
      upsellTotal.style.display = 'block';
    } else {
      upsellTotal.style.display = 'none';
    }
  }
}

function getExtrasTotal() {
  var nights = 1;
  if (searchParams.arrival && searchParams.departure) {
    var arrDate = new Date(searchParams.arrival);
    var depDate = new Date(searchParams.departure);
    nights = Math.round((depDate - arrDate) / 86400000);
    if (nights < 1) nights = 1;
  }
  var total = 0;
  if (selectedExtras.parking) total += 7.5 * nights;
  if (selectedExtras.towels) total += 5 * nights;
  if (selectedExtras.pillows) total += 10 * nights;
  return total;
}

function showGuestForm() {
  if (!guestForm) return;
  guestForm.style.display = 'block';
  if (bookingStatus) bookingStatus.style.display = 'none';

  gtmPush('begin_checkout', {
    rate_name: selectedOffer ? selectedOffer.ratePlanName || '' : '',
    total_price: selectedOffer && selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0,
    extras_total: getExtrasTotal()
  });

  guestForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Upsell extras event listeners
document.addEventListener('DOMContentLoaded', function () {
  var parkingCb = document.getElementById('extra-parking');
  var towelsCb = document.getElementById('extra-towels');
  var pillowsCb = document.getElementById('extra-pillows');
  if (parkingCb) {
    parkingCb.addEventListener('change', function () {
      selectedExtras.parking = this.checked;
      updateUpsellTotal();
    });
  }
  if (towelsCb) {
    towelsCb.addEventListener('change', function () {
      selectedExtras.towels = this.checked;
      updateUpsellTotal();
    });
  }
  if (pillowsCb) {
    pillowsCb.addEventListener('change', function () {
      selectedExtras.pillows = this.checked;
      updateUpsellTotal();
    });
  }
  var continueBtn = document.getElementById('upsellContinueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', function () {
      showGuestForm();
    });
  }
});

// Promo code functions
function applyPromoCode() {
  var input = document.getElementById('promoCodeInput');
  var msg = document.getElementById('promoMessage');
  if (!input || !msg) return;
  var code = input.value.trim().toUpperCase();
  if (!code) { msg.textContent = window.t ? window.t('booking.promo_enter') : 'Please enter a promo code.'; msg.style.color = 'var(--color-error)'; return; }
  if (PROMO_CODES[code]) {
    appliedPromo = { code: code, discount: PROMO_CODES[code].discount, label: PROMO_CODES[code].label };
    msg.textContent = (window.t ? window.t('booking.promo_applied') : 'Promo code applied!') + ' -' + PROMO_CODES[code].label;
    msg.style.color = '#059669';
    gtmPush('promo_code_applied', { promo_code: code, discount: PROMO_CODES[code].label });
    updatePriceDisplay();
  } else {
    appliedPromo = null;
    msg.textContent = window.t ? window.t('booking.promo_invalid') : 'Invalid promo code.';
    msg.style.color = 'var(--color-error)';
    updatePriceDisplay();
  }
}

function getDiscountedTotal() {
  if (!selectedOffer || !selectedOffer.totalGrossAmount) return null;
  var total = selectedOffer.totalGrossAmount.amount + getExtrasTotal();
  if (appliedPromo) { total = total * (1 - appliedPromo.discount); }
  return { amount: Math.round(total * 100) / 100, currency: selectedOffer.totalGrossAmount.currency };
}

function updatePriceDisplay() {
  var display = document.getElementById('promoDiscountDisplay');
  if (!display || !selectedOffer || !selectedOffer.totalGrossAmount) return;
  if (appliedPromo) {
    var orig = selectedOffer.totalGrossAmount;
    var disc = getDiscountedTotal();
    display.innerHTML = '<span style="text-decoration:line-through;color:var(--color-text-muted);font-size:.9rem;">' + orig.currency + ' ' + orig.amount.toFixed(2) + '</span> <span style="color:#059669;font-weight:700;font-size:1.1rem;">' + disc.currency + ' ' + disc.amount.toFixed(2) + '</span>';
    display.style.display = 'block';
  } else {
    display.style.display = 'none';
    display.innerHTML = '';
  }
}

// Confirm booking
if (confirmBtn) {
  confirmBtn.addEventListener('click', function () {
    if (!selectedOffer) return;
    var firstName = document.getElementById('guest-first').value.trim();
    var lastName = document.getElementById('guest-last').value.trim();
    var email = document.getElementById('guest-email').value.trim();
    var phone = document.getElementById('guest-phone').value.trim();

    if (!firstName || !lastName || !email) {
      showStatus('error', window.t ? window.t('booking.validation_fill_required') : 'Please fill in all required fields (First Name, Last Name, Email).');
      return;
    }
    if (!isValidEmail(email)) {
      showStatus('error', window.t ? window.t('booking.validation_valid_email') : 'Please enter a valid email address.');
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.textContent = window.t ? window.t('booking.processing') : 'Processing...';

    gtmPush('submit_booking', {
      location: PROPERTIES[searchParams.propertyId] ? PROPERTIES[searchParams.propertyId].name : searchParams.propertyId,
      rate_name: selectedOffer.ratePlanName || '',
      promo_code: appliedPromo ? appliedPromo.code : ''
    });

    var discountedTotal = getDiscountedTotal();
    var finalTotal = discountedTotal ? discountedTotal.amount : ((selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0) + getExtrasTotal());

    var extrasComment = '';
    if (selectedExtras.parking) extrasComment += ' | Parking (CHF 7.50/day)';
    if (selectedExtras.towels) extrasComment += ' | Extra Towels (CHF 5/night)';
    if (selectedExtras.pillows) extrasComment += ' | Extra Pillow & Blankets (CHF 10/night)';
    var extrasTotal = getExtrasTotal();
    if (extrasTotal > 0) extrasComment += ' | Extras total: CHF ' + extrasTotal;

    var nights = 1;
    if (searchParams.arrival && searchParams.departure) {
      var arrD = new Date(searchParams.arrival);
      var depD = new Date(searchParams.departure);
      nights = Math.round((depD - arrD) / 86400000);
      if (nights < 1) nights = 1;
    }

    var extras = [];
    if (selectedExtras.parking) extras.push({ name: 'Parking', pricePerUnit: 7.5, unit: 'day', quantity: nights, total: 7.5 * nights });
    if (selectedExtras.towels) extras.push({ name: 'Extra Towels', pricePerUnit: 5, unit: 'night', quantity: nights, total: 5 * nights });
    if (selectedExtras.pillows) extras.push({ name: 'Extra Pillow & Blankets', pricePerUnit: 10, unit: 'night', quantity: nights, total: 10 * nights });

    var payload = {
      propertyId: searchParams.propertyId,
      ratePlanId: selectedOffer.ratePlanId,
      arrival: searchParams.arrival,
      departure: searchParams.departure,
      adults: parseInt(searchParams.adults),
      totalAmount: finalTotal,
      currency: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
      booker: {
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
      },
      comment: (appliedPromo ? 'Booked via amanthosliving.com | Promo: ' + appliedPromo.code + ' (' + appliedPromo.label + ' off)' : 'Booked via amanthosliving.com') + extrasComment,
      extras: extras,
    };

    fetch(API_BASE + '/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'cors',
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ' + (window.t ? window.t('booking.confirm_reservation') : 'Confirm Reservation');

      if (data.success) {
        gtmPush('booking_confirmed', {
          booking_id: data.confirmationId || '',
          total_price: finalTotal,
          currency: selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
          promo_code: appliedPromo ? appliedPromo.code : ''
        });

        guestForm.querySelector('.form-grid').style.display = 'none';
        guestForm.querySelector('.form-actions').style.display = 'none';
        var promoSection = guestForm.querySelector('.promo-code-section');
        if (promoSection) promoSection.style.display = 'none';

        if (data.paymentRequired === false) {
          showFreeBookingConfirmation(data.confirmationId, email);
        } else if (data.paymentLink) {
          showPaymentStep(data.confirmationId, data.paymentLink, email, data);
        } else {
          showPaymentRetry(data.confirmationId, email, data);
        }
      } else {
        gtmPush('booking_error', { error_message: data.error || 'Booking failed', step: 'confirm_booking' });
        showStatus('error', data.error || (window.t ? window.t('booking.error_booking_failed') : 'Booking failed. Please try again or contact us at info@amanthosliving.com.'));
      }
    })
    .catch(function (err) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ' + (window.t ? window.t('booking.confirm_reservation') : 'Confirm Reservation');
      showStatus('error', window.t ? window.t('booking.error_connection') : 'Connection error. Please try again or contact us at info@amanthosliving.com.');
      console.error('Booking error:', err);
    });
  });
}

// Cancel button
if (cancelBtn) {
  cancelBtn.addEventListener('click', function () {
    if (guestForm) guestForm.style.display = 'none';
    var upsellSection = document.getElementById('upsellSection');
    if (upsellSection) upsellSection.style.display = 'none';
    selectedOffer = null;
    selectedExtras = { parking: false, towels: false, pillows: false };
    if (offersGrid) {
      offersGrid.querySelectorAll('.offer-card').forEach(function (card) {
        card.classList.remove('selected');
      });
    }
  });
}

function showStatus(type, message) {
  if (!bookingStatus) return;
  bookingStatus.className = 'booking-status ' + type;
  bookingStatus.textContent = message;
  bookingStatus.style.display = 'block';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getOrCreatePaymentSection() {
  var paymentSection = document.getElementById('paymentStep');
  if (!paymentSection) {
    paymentSection = document.createElement('div');
    paymentSection.id = 'paymentStep';
    paymentSection.className = 'payment-step';
    guestForm.appendChild(paymentSection);
  }
  return paymentSection;
}

function showFreeBookingConfirmation(confirmationId, email) {
  if (bookingStatus) bookingStatus.style.display = 'none';
  var paymentSection = getOrCreatePaymentSection();
  var html = '';
  html += '<div class="payment-step-success" style="border-left:4px solid #059669;background:#ECFDF5;">';
  html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  html += '<div>';
  html += '<h4 style="color:#065F46;">Booking Confirmed — Reference: ' + escapeHtml(confirmationId) + '</h4>';
  html += '<p style="font-size:.82rem;color:#059669;margin-top:.25rem;">' + escapeHtml(email) + '</p>';
  html += '</div>';
  html += '</div>';
  html += '<div class="payment-step-action" style="text-align:center;padding:1.5rem;">';
  html += '<div style="display:inline-flex;align-items:center;gap:.5rem;background:#ECFDF5;color:#059669;padding:.5rem 1rem;border-radius:2rem;font-size:.85rem;font-weight:700;margin-bottom:1rem;">';
  html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  html += ' NO PAYMENT REQUIRED';
  html += '</div>';
  html += '<p style="font-weight:500;color:var(--color-text);margin-bottom:.75rem;">Your promo code covers the full amount. Your reservation is confirmed!</p>';
  html += '<p style="font-size:.85rem;color:var(--color-text-muted);">A confirmation email will be sent to <strong>' + escapeHtml(email) + '</strong>.</p>';
  html += '</div>';
  paymentSection.innerHTML = html;
  paymentSection.style.display = 'block';
  paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelUnpaidBooking(reservationId, bookingId, paymentSection) {
  fetch(API_BASE + '/api/cancel-booking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reservationId: reservationId, bookingId: bookingId }),
    mode: 'cors',
  })
  .then(function (res) { return res.json(); })
  .then(function (data) {
    if (data.cancelled) {
      var html = '';
      html += '<div class="payment-step-success" style="border-left:4px solid #DC2626;background:#FEF2F2;">';
      html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DC2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
      html += '<div>';
      html += '<h4 style="color:#991B1B;">' + (window.t ? window.t('booking.cancelled_title') : 'Reservation Cancelled') + '</h4>';
      html += '<p style="font-size:.85rem;color:#DC2626;margin-top:.25rem;">' + (window.t ? window.t('booking.cancelled_no_payment') : 'Payment was not completed. Your reservation has been cancelled.') + '</p>';
      html += '</div>';
      html += '</div>';
      html += '<div class="payment-step-action" style="text-align:center;padding:1.5rem;">';
      html += '<p style="font-weight:500;color:var(--color-text);margin-bottom:1rem;">' + (window.t ? window.t('booking.cancelled_rebook') : 'You can make a new reservation at any time.') + '</p>';
      html += '<button class="btn btn-accent btn-lg" id="rebookBtn" style="font-size:1rem;padding:.85rem 2rem;cursor:pointer;border:none;">';
      html += (window.t ? window.t('booking.search_again') : 'Search Again');
      html += '</button>';
      html += '</div>';
      paymentSection.innerHTML = html;

      var rebookBtn = document.getElementById('rebookBtn');
      if (rebookBtn) {
        rebookBtn.addEventListener('click', function () {
          resetBookingFlow();
        });
      }
      gtmPush('booking_cancelled_no_payment', { booking_id: bookingId, reservation_id: reservationId });
    } else if (data.reason === 'paid') {
      var html2 = '';
      html2 += '<div class="payment-step-success" style="border-left:4px solid #059669;background:#ECFDF5;">';
      html2 += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
      html2 += '<div>';
      html2 += '<h4 style="color:#065F46;">' + (window.t ? window.t('booking.payment_success') : 'Payment Successful — Reservation Confirmed!') + '</h4>';
      html2 += '<p style="font-size:.85rem;color:#059669;margin-top:.25rem;">' + (window.t ? window.t('booking.confirmation_email_sent') : 'A confirmation email has been sent to you.') + '</p>';
      html2 += '</div>';
      html2 += '</div>';
      paymentSection.innerHTML = html2;
      gtmPush('payment_completed', { booking_id: bookingId });
    }
  })
  .catch(function (err) {
    console.error('Cancel booking error:', err);
  });
}

function resetBookingFlow() {
  selectedOffer = null;
  currentOffers = [];
  appliedPromo = null;
  selectedExtras = { parking: false, towels: false, pillows: false };
  var upsellSection = document.getElementById('upsellSection');
  if (upsellSection) upsellSection.style.display = 'none';
  if (guestForm) guestForm.style.display = 'none';
  if (offersGrid) offersGrid.innerHTML = '';
  if (bookingSection) bookingSection.style.display = 'none';
  if (bookingStatus) bookingStatus.style.display = 'none';
  var paymentStep = document.getElementById('paymentStep');
  if (paymentStep) paymentStep.remove();
  if (guestForm) {
    var formGrid = guestForm.querySelector('.form-grid');
    if (formGrid) formGrid.style.display = '';
    var formActions = guestForm.querySelector('.form-actions');
    if (formActions) formActions.style.display = '';
    var promoSec = guestForm.querySelector('.promo-code-section');
    if (promoSec) promoSec.style.display = '';
  }
  var formFields = guestForm ? guestForm.querySelectorAll('input, select, textarea') : [];
  for (var i = 0; i < formFields.length; i++) {
    if (formFields[i].type === 'checkbox') formFields[i].checked = false;
    else formFields[i].value = '';
  }
  var bb = document.getElementById('bookingBar');
  if (bb) bb.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function showPaymentStep(confirmationId, paymentLink, email, bookingData) {
  gtmPush('payment_initiated', { booking_id: confirmationId });
  if (bookingStatus) bookingStatus.style.display = 'none';
  var paymentSection = getOrCreatePaymentSection();
  var confirmMsg = window.t ? window.t('booking.payment_confirmed_id', { id: confirmationId }) : 'Reservation created — Reference: ' + confirmationId;
  var paymentMsg = window.t ? window.t('booking.payment_instruction') : 'Payment is required to confirm your reservation. Without payment, your booking will be automatically cancelled.';
  var payBtnText = window.t ? window.t('booking.pay_now') : 'Pay Now — Secure Payment';
  var emailNote = window.t ? window.t('booking.payment_email_note', { email: email }) : 'A confirmation email will be sent to ' + email + ' after payment.';
  var secureNote = window.t ? window.t('booking.payment_secure_note') : 'You will be redirected to a secure payment page powered by Adyen.';
  var reservationId = bookingData.reservationId || '';

  var totalText = '';
  var discTotal = getDiscountedTotal();
  if (discTotal) {
    totalText = discTotal.currency + ' ' + discTotal.amount.toFixed(2);
  } else if (selectedOffer && selectedOffer.totalGrossAmount) {
    var fullAmount = selectedOffer.totalGrossAmount.amount + getExtrasTotal();
    totalText = (selectedOffer.totalGrossAmount.currency || 'CHF') + ' ' + fullAmount.toFixed(2);
  }

  var html = '';
  html += '<div class="payment-step-success" style="border-left:4px solid #F59E0B;background:#FFFBEB;">';
  html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  html += '<div>';
  html += '<h4 style="color:#92400E;">' + escapeHtml(confirmMsg) + '</h4>';
  html += '<p style="font-size:.82rem;color:#B45309;margin-top:.25rem;">' + escapeHtml(email) + '</p>';
  html += '</div>';
  html += '</div>';
  html += '<div class="payment-step-action">';
  html += '<div style="display:inline-flex;align-items:center;gap:.5rem;background:#FEE2E2;color:#DC2626;padding:.5rem 1rem;border-radius:2rem;font-size:.85rem;font-weight:700;margin-bottom:1rem;letter-spacing:.3px;">';
  html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  html += ' ' + (window.t ? window.t('booking.payment_pending') : 'PAYMENT REQUIRED');
  html += '</div>';
  html += '<p class="payment-instruction" style="font-weight:500;color:var(--color-text);margin-bottom:.75rem;">' + escapeHtml(paymentMsg) + '</p>';
  if (totalText) {
    html += '<p style="font-size:1.8rem;font-weight:800;color:var(--color-primary);font-family:var(--font-heading);margin:.75rem 0;letter-spacing:-.5px;">' + escapeHtml(totalText) + '</p>';
  }
  html += '<button id="payNowBtn" class="btn btn-accent btn-lg payment-btn" style="font-size:1.1rem;padding:1rem 2.5rem;font-weight:700;cursor:pointer;border:none;">';
  html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
  html += ' ' + escapeHtml(payBtnText);
  html += '</button>';
  html += '<p class="payment-secure-note" style="margin-top:1rem;">';
  html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> ';
  html += escapeHtml(secureNote);
  html += '</p>';
  html += '<p class="payment-email-note">' + escapeHtml(emailNote) + '</p>';
  html += '</div>';
  paymentSection.innerHTML = html;
  paymentSection.style.display = 'block';
  paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

  var payBtn = document.getElementById('payNowBtn');
  if (payBtn) {
    payBtn.addEventListener('click', function () {
      var popup = window.open(paymentLink, 'amanthos_payment', 'width=900,height=700,scrollbars=yes,resizable=yes');
      if (!popup || popup.closed) {
        window.open(paymentLink, '_blank');
        return;
      }
      payBtn.disabled = true;
      payBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin .7s linear infinite"><circle cx="12" cy="12" r="10"/></svg> ' + (window.t ? window.t('booking.waiting_for_payment') : 'Waiting for payment...');
      var pollTimer = setInterval(function () {
        if (popup.closed) {
          clearInterval(pollTimer);
          cancelUnpaidBooking(reservationId, confirmationId, paymentSection);
        }
      }, 2000);
    });
  }
}

function showPaymentRetry(confirmationId, email, bookingData) {
  if (bookingStatus) bookingStatus.style.display = 'none';
  var paymentSection = getOrCreatePaymentSection();

  var totalText = '';
  var discTotal = getDiscountedTotal();
  if (discTotal) {
    totalText = discTotal.currency + ' ' + discTotal.amount.toFixed(2);
  } else if (selectedOffer && selectedOffer.totalGrossAmount) {
    var fullAmount = selectedOffer.totalGrossAmount.amount + getExtrasTotal();
    totalText = (selectedOffer.totalGrossAmount.currency || 'CHF') + ' ' + fullAmount.toFixed(2);
  }

  var html = '';
  html += '<div class="payment-step-success" style="border-left:4px solid #F59E0B;background:#FFFBEB;">';
  html += '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  html += '<div>';
  html += '<h4 style="color:#92400E;">' + (window.t ? window.t('booking.payment_confirmed_id', { id: confirmationId }) : 'Reservation created — Reference: ' + confirmationId) + '</h4>';
  html += '<p style="font-size:.82rem;color:#DC2626;font-weight:600;margin-top:.25rem;">' + (window.t ? window.t('booking.payment_link_expired') : 'Payment link could not be generated. Please retry.') + '</p>';
  html += '</div>';
  html += '</div>';
  html += '<div class="payment-step-action">';
  html += '<div style="display:inline-flex;align-items:center;gap:.5rem;background:#FEE2E2;color:#DC2626;padding:.5rem 1rem;border-radius:2rem;font-size:.85rem;font-weight:700;margin-bottom:1rem;">';
  html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
  html += ' ' + (window.t ? window.t('booking.payment_pending') : 'PAYMENT REQUIRED');
  html += '</div>';
  html += '<p class="payment-instruction" style="font-weight:500;color:var(--color-text);margin-bottom:.75rem;">' + (window.t ? window.t('booking.payment_instruction') : 'Payment is required to confirm your reservation. Without payment, your booking will be automatically cancelled.') + '</p>';
  if (totalText) {
    html += '<p style="font-size:1.8rem;font-weight:800;color:var(--color-primary);font-family:var(--font-heading);margin:.75rem 0;">' + escapeHtml(totalText) + '</p>';
  }
  html += '<button id="retryPaymentBtn" class="btn btn-accent btn-lg payment-btn" style="font-size:1.1rem;padding:1rem 2.5rem;font-weight:700;cursor:pointer;border:none;">';
  html += '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>';
  html += ' ' + (window.t ? window.t('booking.retry_payment') : 'Retry Payment Link');
  html += '</button>';
  html += '<p style="font-size:.8rem;color:var(--color-text-muted);margin-top:1rem;">Or contact us at <a href="mailto:info@amanthosliving.com" style="color:var(--color-accent);">info@amanthosliving.com</a></p>';
  html += '</div>';
  paymentSection.innerHTML = html;
  paymentSection.style.display = 'block';
  paymentSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

  var retryBtn = document.getElementById('retryPaymentBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function () {
      retryBtn.disabled = true;
      retryBtn.textContent = window.t ? window.t('booking.processing') : 'Processing...';

      var retryDiscTotal = getDiscountedTotal();
      var retryTotalAmount = retryDiscTotal ? retryDiscTotal.amount : ((selectedOffer && selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.amount : 0) + getExtrasTotal());

      var retryNights = 1;
      if (searchParams.arrival && searchParams.departure) {
        var rArrD = new Date(searchParams.arrival);
        var rDepD = new Date(searchParams.departure);
        retryNights = Math.round((rDepD - rArrD) / 86400000);
        if (retryNights < 1) retryNights = 1;
      }
      var retryExtras = [];
      if (selectedExtras.parking) retryExtras.push({ name: 'Parking', pricePerUnit: 7.5, unit: 'day', quantity: retryNights, total: 7.5 * retryNights });
      if (selectedExtras.towels) retryExtras.push({ name: 'Extra Towels', pricePerUnit: 5, unit: 'night', quantity: retryNights, total: 5 * retryNights });
      if (selectedExtras.pillows) retryExtras.push({ name: 'Extra Pillow & Blankets', pricePerUnit: 10, unit: 'night', quantity: retryNights, total: 10 * retryNights });

      var retryPayload = {
        bookingId: bookingData.confirmationId,
        reservationId: bookingData.reservationId || '',
        propertyId: bookingData.propertyId || (searchParams ? searchParams.propertyId : ''),
        email: email,
        totalAmount: retryTotalAmount,
        currency: selectedOffer && selectedOffer.totalGrossAmount ? selectedOffer.totalGrossAmount.currency : 'CHF',
        extras: retryExtras,
      };

      fetch(API_BASE + '/api/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryPayload),
        mode: 'cors',
      })
      .then(function (res) { return res.json(); })
      .then(function (linkData) {
        if (linkData.paymentLink) {
          showPaymentStep(bookingData.confirmationId, linkData.paymentLink, email, bookingData);
        } else {
          retryBtn.disabled = false;
          retryBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> ' + (window.t ? window.t('booking.retry_payment') : 'Retry Payment Link');
          showStatus('error', linkData.error || (window.t ? window.t('booking.payment_link_expired') : 'Payment link generation failed. Please contact info@amanthosliving.com.'));
        }
      })
      .catch(function () {
        retryBtn.disabled = false;
        retryBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg> ' + (window.t ? window.t('booking.retry_payment') : 'Retry Payment Link');
        showStatus('error', window.t ? window.t('booking.error_connection') : 'Connection error. Please try again.');
      });
    });
  }
}

// Public API for external use (e.g. location card buttons)
window.amanthosBooking = {
  setSearch: function (params) {
    searchParams = params;
    fetchOffers();
  },
  selectLocation: function (val) {
    selectLocation(val);
  }
};

})();
