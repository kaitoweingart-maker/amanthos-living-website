(function () {
'use strict';
var API_BASE = window.AMANTHOS_API_BASE || 'https://amanthos-website-api.onrender.com';
var sessionId = 'chat-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6);
var panel = document.getElementById('chatPanel');
var messages = document.getElementById('chatMessages');
var input = document.getElementById('chatInput');
var sendBtn = document.getElementById('chatSendBtn');
var isSending = false;
if (panel) {
panel.style.display = 'none';
}
function sendMessage() {
if (isSending) return;
var text = input.value.trim();
if (!text) return;
isSending = true;
addMessage('user', text);
input.value = '';
input.focus();
showTyping();
fetch(API_BASE + '/api/chat', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
message: text,
session_id: sessionId,
}),
mode: 'cors',
})
.then(function (res) {
if (!res.ok) {
return res.json().then(function (errData) {
throw new Error(errData.error || 'Server error');
}).catch(function () {
throw new Error('Server error (HTTP ' + res.status + ')');
});
}
return res.json();
})
.then(function (data) {
hideTyping();
isSending = false;
if (data.reply) {
addMessage('assistant', data.reply);
if (data.session_id) sessionId = data.session_id;
} else if (data.error) {
addMessage('assistant', window.t ? window.t('chat.error_generic') : 'Sorry, I encountered an issue. Please try again.');
}
})
.catch(function (err) {
hideTyping();
isSending = false;
var msg = window.t ? window.t('chat.error_connection') : 'Connection error. Please try again in a moment.';
if (err.message && err.message.indexOf('Failed to fetch') !== -1) {
msg = window.t ? window.t('chat.error_waking') : 'I\'m waking up — please try again in about 30 seconds. Our server may need a moment to start.';
}
addMessage('assistant', msg);
console.error('Chat error:', err);
});
}
if (sendBtn) {
sendBtn.addEventListener('click', sendMessage);
}
if (input) {
input.addEventListener('keydown', function (e) {
if (e.key === 'Enter' && !e.shiftKey) {
e.preventDefault();
sendMessage();
}
});
}
function addMessage(role, text) {
var div = document.createElement('div');
div.className = 'chat-msg ' + role;
if (role === 'assistant') {
div.innerHTML = formatText(text);
} else {
var p = document.createElement('p');
p.textContent = text;
div.appendChild(p);
}
messages.appendChild(div);
messages.scrollTop = messages.scrollHeight;
}
function showTyping() {
var typing = document.createElement('div');
typing.className = 'chat-msg typing';
typing.id = 'chatTyping';
typing.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
messages.appendChild(typing);
messages.scrollTop = messages.scrollHeight;
}
function hideTyping() {
var typing = document.getElementById('chatTyping');
if (typing) typing.remove();
}
function formatText(text) {
var html = escapeHtml(text);
html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
html = html.replace(/\n- /g, '<br>&bull; ');
html = html.replace(/\n/g, '<br>');
return '<p>' + html + '</p>';
}
function escapeHtml(str) {
var div = document.createElement('div');
div.textContent = str;
return div.innerHTML;
}
window.initChat = function () {
if (panel) panel.style.display = 'flex';
if (input) setTimeout(function () { input.focus(); }, 200);
};
})();