(function () {
'use strict';
document.querySelectorAll('svg:not([aria-label]):not([role])').forEach(function (svg) {
svg.setAttribute('aria-hidden', 'true');
});
var nav = document.getElementById('nav');
var hamburger = document.getElementById('hamburger');
var navLinks = document.getElementById('navLinks');
function updateNav() {
if (window.scrollY > 60) {
nav.classList.add('scrolled');
} else {
nav.classList.remove('scrolled');
}
}
window.addEventListener('scroll', updateNav, { passive: true });
updateNav();
if (hamburger && navLinks) {
hamburger.addEventListener('click', function () {
var isOpen = navLinks.classList.toggle('open');
hamburger.classList.toggle('active');
hamburger.setAttribute('aria-expanded', isOpen);
document.body.style.overflow = isOpen ? 'hidden' : '';
});
navLinks.querySelectorAll('a').forEach(function (link) {
link.addEventListener('click', function () {
navLinks.classList.remove('open');
hamburger.classList.remove('active');
hamburger.setAttribute('aria-expanded', 'false');
document.body.style.overflow = '';
});
});
}
document.querySelectorAll('a[href^="#"]').forEach(function (link) {
link.addEventListener('click', function (e) {
var target = document.querySelector(this.getAttribute('href'));
if (target) {
e.preventDefault();
target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
});
});
var animateEls = document.querySelectorAll('[data-animate]');
if (animateEls.length > 0 && 'IntersectionObserver' in window) {
var observer = new IntersectionObserver(function (entries) {
entries.forEach(function (entry) {
if (entry.isIntersecting) {
entry.target.classList.add('animate-in');
observer.unobserve(entry.target);
}
});
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
animateEls.forEach(function (el) { observer.observe(el); });
} else {
animateEls.forEach(function (el) { el.classList.add('animate-in'); });
}
var counterEls = document.querySelectorAll('[data-count]');
if (counterEls.length > 0 && 'IntersectionObserver' in window) {
var counterObserver = new IntersectionObserver(function (entries) {
entries.forEach(function (entry) {
if (entry.isIntersecting) {
animateCounter(entry.target);
counterObserver.unobserve(entry.target);
}
});
}, { threshold: 0.5 });
counterEls.forEach(function (el) { counterObserver.observe(el); });
}
function animateCounter(el) {
var target = parseInt(el.getAttribute('data-count'));
var duration = 1500;
var start = 0;
var startTime = null;
function step(timestamp) {
if (!startTime) startTime = timestamp;
var progress = Math.min((timestamp - startTime) / duration, 1);
var eased = 1 - Math.pow(1 - progress, 3);
el.textContent = Math.floor(eased * target);
if (progress < 1) {
requestAnimationFrame(step);
} else {
el.textContent = target;
}
}
requestAnimationFrame(step);
}
var today = new Date().toISOString().split('T')[0];
var checkinInput = document.getElementById('bb-checkin');
var checkoutInput = document.getElementById('bb-checkout');
if (checkinInput) {
checkinInput.min = today;
checkinInput.addEventListener('change', function () {
if (checkoutInput) {
var checkin = new Date(this.value);
checkin.setDate(checkin.getDate() + 1);
checkoutInput.min = checkin.toISOString().split('T')[0];
if (checkoutInput.value && checkoutInput.value <= this.value) {
checkoutInput.value = checkoutInput.min;
}
}
});
}
document.querySelectorAll('[data-location]').forEach(function (btn) {
btn.addEventListener('click', function (e) {
e.preventDefault();
var locationId = this.getAttribute('data-location');
var locationSelect = document.getElementById('bb-location');
if (locationSelect) {
locationSelect.value = locationId;
locationSelect.dispatchEvent(new Event('change'));
}
var bookingBar = document.getElementById('bookingBar');
if (bookingBar) {
bookingBar.scrollIntoView({ behavior: 'smooth', block: 'center' });
setTimeout(function () {
if (checkinInput) checkinInput.focus();
}, 500);
}
});
});
var preselect = localStorage.getItem('preselect_location');
if (preselect) {
var locationSelect = document.getElementById('bb-location');
if (locationSelect) {
locationSelect.value = preselect;
locationSelect.dispatchEvent(new Event('change'));
}
localStorage.removeItem('preselect_location');
}
// Defer non-critical FOMO/ticker features to reduce TBT
var initFomo = function() {
var tickerText = document.getElementById('tickerText');
if (tickerText) {
var tickerKeys = [
'ticker.viewing',
'ticker.just_booked',
'ticker.bookings_today',
'ticker.apartments_left',
'ticker.last_booking',
'ticker.fully_booked',
'ticker.guests_saved',
];
var tickerLocations = ['Zurich Airport', 'Solothurn', 'Nyon'];
function updateTicker() {
var key = tickerKeys[Math.floor(Math.random() * tickerKeys.length)];
var loc = tickerLocations[Math.floor(Math.random() * tickerLocations.length)];
var replacements = {
n: Math.floor(Math.random() * 22) + 12,
loc: loc,
d: Math.floor(Math.random() * 12) + 3,
r: Math.floor(Math.random() * 3) + 1,
t: Math.floor(Math.random() * 12) + 2,
};
tickerText.textContent = window.t ? window.t(key, replacements) : key;
}
window.addEventListener('load', function() { setInterval(updateTicker, 8000); });
}
var bookingToast = document.getElementById('bookingToast');
var toastName = document.getElementById('toastName');
var toastLocation = document.getElementById('toastLocation');
if (bookingToast) {
var toastNames = [
'Michael K.', 'Sarah L.', 'Thomas M.', 'Anna B.',
'Peter R.', 'Julia S.', 'Marco P.', 'Elena W.',
'David C.', 'Lisa F.', 'Andreas H.', 'Sophie N.',
'Marc B.', 'Sandra W.', 'Lukas M.', 'Christine P.',
'Oliver R.', 'Natalie S.', 'Stefan G.', 'Monika H.',
];
var toastLocations = ['Zurich Airport', 'Solothurn', 'Nyon'];
var toastTimeKeys = ['toast.just_now', 'toast.one_minute_ago', 'toast.two_minutes_ago', 'toast.three_minutes_ago', 'toast.five_minutes_ago'];
function showToast() {
toastName.textContent = toastNames[Math.floor(Math.random() * toastNames.length)];
toastLocation.textContent = toastLocations[Math.floor(Math.random() * toastLocations.length)];
var timeEl = bookingToast.querySelector('.toast-time');
if (timeEl) {
var timeKey = toastTimeKeys[Math.floor(Math.random() * toastTimeKeys.length)];
timeEl.textContent = window.t ? window.t(timeKey) : timeKey;
}
bookingToast.style.display = 'flex';
setTimeout(function () {
bookingToast.style.display = 'none';
}, 5000);
}
window.addEventListener('load', function() {
setTimeout(function () {
showToast();
setInterval(function () {
showToast();
}, 18000 + Math.random() * 17000);
}, 8000);
});
}
var stickyCta = document.getElementById('stickyCta');
if (stickyCta) {
var heroSection = document.getElementById('hero');
function checkStickyCta() {
if (heroSection) {
var heroBottom = heroSection.getBoundingClientRect().bottom;
if (heroBottom < 0) {
stickyCta.classList.add('visible');
} else {
stickyCta.classList.remove('visible');
}
}
}
window.addEventListener('scroll', checkStickyCta, { passive: true });
checkStickyCta();
}
var gameSection = document.getElementById('game');
if (gameSection && 'IntersectionObserver' in window) {
var gameObserver = new IntersectionObserver(function (entries) {
if (entries[0].isIntersecting) {
var script = document.createElement('script');
var basePath = document.querySelector('script[src*="app.js"]');
var prefix = basePath ? basePath.src.replace(/js\/app\.js.*$/, '') : './';
script.src = prefix + 'js/game.js';
document.body.appendChild(script);
gameObserver.disconnect();
}
}, { rootMargin: '200px' });
gameObserver.observe(gameSection);
}
var chatToggle = document.getElementById('chatToggle');
if (chatToggle) {
chatToggle.addEventListener('click', function () {
toggleChat();
});
}
function trapFocus(container) {
var focusable = container.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
if (focusable.length === 0) return;
var first = focusable[0];
var last = focusable[focusable.length - 1];
container.addEventListener('keydown', function (e) {
if (e.key === 'Tab') {
if (e.shiftKey) {
if (document.activeElement === first) { e.preventDefault(); last.focus(); }
} else {
if (document.activeElement === last) { e.preventDefault(); first.focus(); }
}
}
if (e.key === 'Escape') {
container.style.display = 'none';
if (container.id === 'chatPanel') {
var toggle = document.getElementById('chatToggle');
if (toggle) toggle.focus();
}
}
});
}
window.toggleChat = function () {
var panel = document.getElementById('chatPanel');
if (!panel) return;
var isVisible = panel.style.display !== 'none';
panel.style.display = isVisible ? 'none' : 'flex';
if (!isVisible) {
var input = document.getElementById('chatInput');
if (input) setTimeout(function () { input.focus(); }, 200);
trapFocus(panel);
}
};
var chatClose = document.getElementById('chatClose');
if (chatClose) {
chatClose.addEventListener('click', function () {
window.toggleChat();
});
}
var exitPopup = document.getElementById('exitPopup');
if (exitPopup) {
var exitShown = false;
document.addEventListener('mouseout', function (e) {
if (exitShown) return;
if (e.clientY < 5 && e.relatedTarget == null) {
exitShown = true;
var viewerEl = document.getElementById('exitViewers');
var bookedEl = document.getElementById('exitBooked');
var leftEl = document.getElementById('exitLeft');
if (viewerEl) viewerEl.textContent = Math.floor(Math.random() * 18) + 12;
if (bookedEl) bookedEl.textContent = Math.floor(Math.random() * 6) + 5;
if (leftEl) leftEl.textContent = Math.floor(Math.random() * 4) + 2;
exitPopup.style.display = 'block';
var exitContent = exitPopup.querySelector('.exit-popup-content');
if (exitContent) {
trapFocus(exitPopup);
var closeBtn = exitPopup.querySelector('.exit-popup-close');
if (closeBtn) setTimeout(function () { closeBtn.focus(); }, 100);
}
sessionStorage.setItem('exitShown', '1');
}
});
if (sessionStorage.getItem('exitShown')) {
exitShown = true;
}
}
var fomoViewers = document.getElementById('fomoViewers');
var fomoTime = document.getElementById('fomoTime');
var fomoLoc = document.getElementById('fomoLoc');
var fomoLocations = ['Zurich', 'Solothurn', 'Nyon'];
if (fomoViewers) {
fomoViewers.textContent = Math.floor(Math.random() * 20) + 15;
}
if (fomoTime) {
fomoTime.textContent = (Math.floor(Math.random() * 8) + 2) + ' min ago';
}
if (fomoLoc) {
fomoLoc.textContent = fomoLocations[Math.floor(Math.random() * fomoLocations.length)];
}
if (fomoViewers && fomoTime && fomoLoc) {
window.addEventListener('load', function() {
setInterval(function () {
fomoViewers.textContent = Math.floor(Math.random() * 20) + 15;
fomoTime.textContent = (Math.floor(Math.random() * 8) + 1) + ' min ago';
fomoLoc.textContent = fomoLocations[Math.floor(Math.random() * fomoLocations.length)];
}, 20000);
});
}
var urgencyCount = document.getElementById('urgencyCount');
if (urgencyCount) {
urgencyCount.textContent = Math.floor(Math.random() * 8) + 7;
}
var urgencyLeft = document.getElementById('urgencyLeft');
if (urgencyLeft) {
urgencyLeft.textContent = Math.floor(Math.random() * 5) + 2;
}
}; // end initFomo
// Defer FOMO features to reduce main thread blocking
if ('requestIdleCallback' in window) {
requestIdleCallback(initFomo);
} else {
setTimeout(initFomo, 2000);
}
document.querySelectorAll('[data-scroll-to]').forEach(function (el) {
el.addEventListener('click', function (e) {
var targetId = this.getAttribute('data-scroll-to');
var target = document.getElementById(targetId);
if (target) {
e.preventDefault();
target.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
});
});
document.querySelectorAll('[data-close-popup]').forEach(function (el) {
el.addEventListener('click', function () {
var popupId = this.getAttribute('data-close-popup');
var popup = document.getElementById(popupId);
if (popup) {
popup.style.display = 'none';
popup.setAttribute('aria-hidden', 'true');
}
});
});
if (!hamburger && document.querySelector('.hamburger')) {
var locHamburger = document.querySelector('.hamburger');
var locNavLinks = document.querySelector('.nav-links');
if (locHamburger && locNavLinks) {
locHamburger.addEventListener('click', function () {
var isOpen = locNavLinks.classList.toggle('open');
locHamburger.classList.toggle('active');
locHamburger.setAttribute('aria-expanded', isOpen);
document.body.style.overflow = isOpen ? 'hidden' : '';
});
locNavLinks.querySelectorAll('a').forEach(function (link) {
link.addEventListener('click', function () {
locNavLinks.classList.remove('open');
locHamburger.classList.remove('active');
locHamburger.setAttribute('aria-expanded', 'false');
document.body.style.overflow = '';
});
});
}
}
// ===== ROOMS TAB SECTION =====
var roomDisplay = document.getElementById('roomDisplay');
if (roomDisplay) {
var roomData = [
  {
    id: 'einzelzimmer',
    nameKey: 'rooms.name_single',
    name: 'Einzelzimmer',
    count: 3,
    price: 'CHF 99',
    priceNoteKey: 'pricing.per_night',
    priceNote: '/Nacht',
    descKey: 'rooms.desc_single',
    desc: 'Comfortable single room with all essentials for a pleasant stay. Ideal for solo travelers and business guests.',
    amenities: [
      { key: 'rooms.amenity_single_bed', label: 'Einzelbett', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
      { key: 'rooms.amenity_tv', label: 'TV', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>' },
      { key: 'rooms.amenity_breakfast', label: 'Frühstück', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>' },
      { key: 'rooms.amenity_bath', label: 'Bad/Dusche', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16a1 1 0 011 1v3a4 4 0 01-4 4H7a4 4 0 01-4-4v-3a1 1 0 011-1z"/><path d="M6 12V5a2 2 0 012-2h3v2.25"/></svg>' },
      { key: 'rooms.amenity_wifi', label: 'WLAN', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>' }
    ],
    images: ['./images/nyon/bedroom.webp', './images/zurich/bedroom.webp', './images/nyon/bathroom.webp']
  },
  {
    id: 'standard-doppel',
    nameKey: 'rooms.name_standard_double',
    name: 'Standard Doppelzimmer',
    count: 8,
    price: 'CHF 139',
    priceNoteKey: 'pricing.per_night',
    priceNote: '/Nacht',
    descKey: 'rooms.desc_standard_double',
    desc: 'Spacious double room with high-quality furnishings and a comfortable double bed. Perfect for couples.',
    amenities: [
      { key: 'rooms.amenity_double_bed', label: 'Doppelbett', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
      { key: 'rooms.amenity_tv', label: 'TV', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>' },
      { key: 'rooms.amenity_breakfast', label: 'Frühstück', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>' },
      { key: 'rooms.amenity_bath', label: 'Bad/Dusche', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16a1 1 0 011 1v3a4 4 0 01-4 4H7a4 4 0 01-4-4v-3a1 1 0 011-1z"/><path d="M6 12V5a2 2 0 012-2h3v2.25"/></svg>' },
      { key: 'rooms.amenity_safe', label: 'Safe', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' },
      { key: 'rooms.amenity_wifi', label: 'WLAN', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>' }
    ],
    images: ['./images/zurich/bedroom.webp', './images/zurich/living-room.webp', './images/zurich/bathroom.webp']
  },
  {
    id: 'superior-doppel',
    nameKey: 'rooms.name_superior_double',
    name: 'Superior Doppelzimmer',
    count: 10,
    price: 'CHF 169',
    priceNoteKey: 'pricing.per_night',
    priceNote: '/Nacht',
    descKey: 'rooms.desc_superior_double',
    desc: 'Premium double room with upscale amenities including minibar and safe. Our most popular room category.',
    amenities: [
      { key: 'rooms.amenity_double_bed', label: 'Doppelbett', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
      { key: 'rooms.amenity_tv', label: 'TV', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>' },
      { key: 'rooms.amenity_breakfast', label: 'Frühstück', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>' },
      { key: 'rooms.amenity_safe', label: 'Safe', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>' },
      { key: 'rooms.amenity_minibar', label: 'Minibar', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="10" x2="20" y2="10"/><circle cx="15" cy="6" r="1"/></svg>' },
      { key: 'rooms.amenity_wifi', label: 'WLAN', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>' }
    ],
    images: ['./images/nyon/luxury-room.webp', './images/nyon/living-room.webp', './images/nyon/bathroom.webp']
  },
  {
    id: 'superior-twin-balkon',
    nameKey: 'rooms.name_superior_twin',
    name: 'Superior Twin Balkon',
    count: 5,
    price: 'CHF 189',
    priceNoteKey: 'pricing.per_night',
    priceNote: '/Nacht',
    descKey: 'rooms.desc_superior_twin',
    desc: 'Elegant twin room with private balcony and stunning mountain views. Two comfortable single beds for flexible sleeping arrangements.',
    amenities: [
      { key: 'rooms.amenity_2_beds', label: '2 Betten', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
      { key: 'rooms.amenity_balcony', label: 'Balkon', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="12" x2="12" y2="21"/></svg>' },
      { key: 'rooms.amenity_mountain_view', label: 'Bergblick', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 21l4-10 4 10"/><path d="M14.5 15l3.5-7 4 10H2l6-12 3.5 7"/></svg>' },
      { key: 'rooms.amenity_tv', label: 'TV', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>' },
      { key: 'rooms.amenity_breakfast', label: 'Frühstück', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>' },
      { key: 'rooms.amenity_wifi', label: 'WLAN', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>' }
    ],
    images: ['./images/nyon/classic-room.webp', './images/nyon/exterior.webp', './images/nyon/bathroom-2.webp']
  },
  {
    id: 'familienzimmer-3',
    nameKey: 'rooms.name_family_3',
    name: 'Familienzimmer (3)',
    count: 3,
    price: 'CHF 219',
    priceNoteKey: 'pricing.per_night',
    priceNote: '/Nacht',
    descKey: 'rooms.desc_family_3',
    desc: 'Family-friendly room with three beds, ideal for small families or groups. All the comforts you need for a relaxed stay.',
    amenities: [
      { key: 'rooms.amenity_3_beds', label: '3 Betten', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
      { key: 'rooms.amenity_tv', label: 'TV', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>' },
      { key: 'rooms.amenity_breakfast', label: 'Frühstück', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>' },
      { key: 'rooms.amenity_bath', label: 'Bad/Dusche', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 12h16a1 1 0 011 1v3a4 4 0 01-4 4H7a4 4 0 01-4-4v-3a1 1 0 011-1z"/><path d="M6 12V5a2 2 0 012-2h3v2.25"/></svg>' },
      { key: 'rooms.amenity_family', label: 'Familienfreundlich', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>' },
      { key: 'rooms.amenity_wifi', label: 'WLAN', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>' }
    ],
    images: ['./images/zurich/suite-living.webp', './images/zurich/living-room.webp', './images/zurich/kitchen.webp']
  },
  {
    id: 'familienzimmer-4',
    nameKey: 'rooms.name_family_4',
    name: 'Familienzimmer (4)',
    count: 8,
    price: 'CHF 259',
    priceNoteKey: 'pricing.per_night',
    priceNote: '/Nacht',
    descKey: 'rooms.desc_family_4',
    desc: 'Our largest family room with 3-4 beds and a private balcony. Crib available on request. Ideal for families with young children.',
    amenities: [
      { key: 'rooms.amenity_3_4_beds', label: '3-4 Betten', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>' },
      { key: 'rooms.amenity_balcony', label: 'Balkon', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="18" rx="2"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="12" x2="12" y2="21"/></svg>' },
      { key: 'rooms.amenity_tv', label: 'TV', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="15" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>' },
      { key: 'rooms.amenity_breakfast', label: 'Frühstück', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 8h1a4 4 0 110 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/></svg>' },
      { key: 'rooms.amenity_crib', label: 'Kinderbett*', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a3 3 0 00-3 3v1H6a2 2 0 00-2 2v8h16V8a2 2 0 00-2-2h-3V5a3 3 0 00-3-3z"/><path d="M4 16v2"/><path d="M20 16v2"/></svg>' },
      { key: 'rooms.amenity_wifi', label: 'WLAN', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1"/></svg>' }
    ],
    images: ['./images/solothurn/large-bedroom.webp', './images/solothurn/living-room.webp', './images/solothurn/kitchen.webp']
  }
];
var currentRoomIndex = 0;
var currentImageIndex = 0;
function renderRoom(index) {
  var room = roomData[index];
  if (!room) return;
  currentRoomIndex = index;
  currentImageIndex = 0;
  var t = window.t || function(k, r) { return k; };
  var name = t(room.nameKey) !== room.nameKey ? t(room.nameKey) : room.name;
  var desc = t(room.descKey) !== room.descKey ? t(room.descKey) : room.desc;
  var countLabel = room.count + ' ' + (t('rooms.rooms_label') !== 'rooms.rooms_label' ? t('rooms.rooms_label') : 'ZIMMER');
  var bookNow = t('rooms.book_now') !== 'rooms.book_now' ? t('rooms.book_now') : 'JETZT BUCHEN';
  var viewMore = t('rooms.view_more') !== 'rooms.view_more' ? t('rooms.view_more') : 'MEHR ANSCHAUEN';
  var html = '<div class="room-gallery">';
  html += '<img src="' + room.images[0] + '" alt="' + name + '" loading="lazy" width="600" height="450">';
  html += '<span class="room-count-badge">' + countLabel + '</span>';
  html += '<span class="room-price-badge">' + room.price + ' ' + room.priceNote + '</span>';
  if (room.images.length > 1) {
    html += '<button class="room-gallery-nav room-gallery-prev" aria-label="Previous image"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button>';
    html += '<button class="room-gallery-nav room-gallery-next" aria-label="Next image"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button>';
  }
  html += '</div>';
  html += '<div class="room-details">';
  html += '<h3>' + name + '</h3>';
  html += '<div class="room-amenities">';
  for (var a = 0; a < room.amenities.length; a++) {
    var am = room.amenities[a];
    var amLabel = t(am.key) !== am.key ? t(am.key) : am.label;
    html += '<div class="room-amenity">' + am.icon + '<span>' + amLabel + '</span></div>';
  }
  html += '</div>';
  html += '<p class="room-desc">' + desc + '</p>';
  html += '<div class="room-actions">';
  html += '<a href="#booking" class="btn btn-accent" data-scroll-to="bookingBar">' + bookNow + '</a>';
  html += '<button class="btn btn-outline room-view-more-btn">' + viewMore + '</button>';
  html += '</div></div>';
  roomDisplay.innerHTML = html;
  // Attach gallery nav events
  var prevBtn = roomDisplay.querySelector('.room-gallery-prev');
  var nextBtn = roomDisplay.querySelector('.room-gallery-next');
  if (prevBtn) prevBtn.addEventListener('click', function() { navigateGallery(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function() { navigateGallery(1); });
  // Attach scroll-to event on book now button
  var bookBtn = roomDisplay.querySelector('[data-scroll-to]');
  if (bookBtn) {
    bookBtn.addEventListener('click', function(e) {
      e.preventDefault();
      var target = document.getElementById(this.getAttribute('data-scroll-to'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
}
function navigateGallery(dir) {
  var room = roomData[currentRoomIndex];
  if (!room) return;
  currentImageIndex = (currentImageIndex + dir + room.images.length) % room.images.length;
  var img = roomDisplay.querySelector('.room-gallery img');
  if (img) {
    img.style.opacity = '0';
    setTimeout(function() {
      img.src = room.images[currentImageIndex];
      img.style.opacity = '1';
    }, 150);
  }
}
// Tab click handlers
document.querySelectorAll('.rooms-tab').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.rooms-tab').forEach(function(t) {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    this.classList.add('active');
    this.setAttribute('aria-selected', 'true');
    renderRoom(parseInt(this.getAttribute('data-room')));
  });
});
// Defer first room render until section is near viewport
if ('IntersectionObserver' in window) {
  var roomsSection = document.getElementById('rooms');
  if (roomsSection) {
    var roomObserver = new IntersectionObserver(function(entries) {
      if (entries[0].isIntersecting) {
        renderRoom(0);
        roomObserver.disconnect();
      }
    }, { rootMargin: '300px' });
    roomObserver.observe(roomsSection);
  }
} else {
  renderRoom(0);
}
}
// Cookie Banner
var cookieBanner = document.getElementById('cookieBanner');
var cookieAccept = document.getElementById('cookieAccept');
if (cookieBanner && !localStorage.getItem('cookies_accepted')) {
cookieBanner.style.display = 'block';
}
if (cookieAccept) {
cookieAccept.addEventListener('click', function () {
localStorage.setItem('cookies_accepted', '1');
cookieBanner.style.display = 'none';
});
}
})();