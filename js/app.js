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
}
localStorage.removeItem('preselect_location');
}
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
setInterval(updateTicker, 8000);
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
'Robert F.', 'Claudia M.', 'Daniel W.', 'Martina K.',
'Christian B.', 'Nicole R.', 'Markus S.', 'Karin P.',
'Patrick L.', 'Sabine G.', 'Martin H.', 'Silvia W.',
'Reto B.', 'Andrea M.', 'Simon K.', 'Barbara F.',
'Jan P.', 'Katharina S.', 'Felix L.', 'Simone R.',
'Alexander H.', 'Isabelle W.', 'Tobias M.', 'Laura K.',
'Philipp B.', 'Melanie S.', 'Fabian R.', 'Stefanie P.',
'Benjamin G.', 'Daniela L.', 'Florian W.', 'Manuela H.',
'Sebastian K.', 'Corinne M.', 'Dominik F.', 'Franziska B.',
'Jonas S.', 'Petra R.', 'Luca P.', 'Regula W.',
'Nicolas G.', 'Verena K.', 'Raphael M.', 'Ursula L.',
'Samuel H.', 'Brigitte F.', 'Adrian B.', 'Tamara S.',
'Marcel R.', 'Eveline P.', 'Christoph W.', 'Ruth G.',
'Beat M.', 'Susanne K.', 'Yves L.', 'Helena F.',
'Pierre B.', 'Margrit S.', 'Alain R.', 'Esther P.',
'Laurent W.', 'Nathalie G.', 'Pascal K.', 'Vreni M.',
'René L.', 'Marie F.', 'Hans B.', 'Irene S.',
'Fritz R.', 'Doris P.', 'Werner W.', 'Eliane G.',
'Hugo K.', 'Anita M.', 'Kurt L.', 'Carmen F.',
'Roland B.', 'Yvonne S.', 'Bruno R.', 'Heidi P.',
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
setTimeout(function () {
showToast();
setInterval(function () {
showToast();
}, 18000 + Math.random() * 17000);
}, 8000);
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
setInterval(function () {
fomoViewers.textContent = Math.floor(Math.random() * 20) + 15;
fomoTime.textContent = (Math.floor(Math.random() * 8) + 1) + ' min ago';
fomoLoc.textContent = fomoLocations[Math.floor(Math.random() * fomoLocations.length)];
}, 20000);
}
var urgencyCount = document.getElementById('urgencyCount');
if (urgencyCount) {
urgencyCount.textContent = Math.floor(Math.random() * 8) + 7;
}
var urgencyLeft = document.getElementById('urgencyLeft');
if (urgencyLeft) {
urgencyLeft.textContent = Math.floor(Math.random() * 5) + 2;
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