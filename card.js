/* Public card / front page that works offline: ?card=HVAC or ?front=CARES.
   Business details are cached on this phone after the first visit. A request made with no internet is kept
   on this phone and sent automatically when the phone is back online. */
(function () {
  'use strict';
  var CFG = window.PE_CONFIG || {}, m = document.getElementById('m');
  var q = new URLSearchParams(location.search), kind = q.get('front') ? 'front' : 'card', key = String(q.get('front') || q.get('card') || 'HVAC').toUpperCase();
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function api(body) {
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function dg(s) { return String(s || '').replace(/\D/g, ''); }
  function queue() { return ls('pe_pubq') || []; }
  function flush() {
    var qq = queue(); if (!qq.length || !navigator.onLine) return Promise.resolve();
    var item = qq[0];
    return api(item).then(function (r) {
      if (r.ok || r.error) { ls('pe_pubq', queue().slice(1)); }
      if (queue().length) return flush();
      var n = document.getElementById('qnote'); if (n) n.innerHTML = '<div class="ok">Your saved request was sent. Thank you!</div>';
    }).catch(function () {});
  }
  window.addEventListener('online', flush);
  function show(pub, note, ok) {
    var c = kind === 'card' ? (pub.cards || []).filter(function (x) { return x.key === key; })[0] : (pub.fronts || []).filter(function (x) { return x.key === key; })[0];
    if (!c) { m.innerHTML = '<p>Page not found.</p>'; return; }
    document.title = c.brand;
    var btn = [];
    if (kind === 'card') {
      if (c.phone) btn.push('<a class="cb" href="tel:+1' + dg(c.phone) + '">Call ' + esc(c.phone) + '</a>');
      if (c.text_phone) btn.push('<a class="cb" href="sms:+1' + dg(c.text_phone) + '">Text us</a>');
      if (c.email) btn.push('<a class="cb" href="mailto:' + esc(c.email) + '">Email</a>');
      if (c.website) btn.push('<a class="cb" href="' + esc(c.website) + '">Website</a>');
      btn.push('<a class="cb gold" href="' + esc(pub.vcfBase + key) + '">Save contact</a>');
    }
    var needs = (kind === 'card' ? c.services : c.asks) || ['Not sure yet'];
    var found = (pub.foundVia || []).map(function (s) { return '<option' + (kind === 'card' && s === 'Tapped or scanned a card' ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
    var pending = queue().filter(function (x) { return x.key === key; }).length;
    m.innerHTML = '<div class="brand">' + esc(c.brand) + '</div><h1>' + esc(kind === 'card' ? c.brand : c.title) + '</h1><p>' + esc(kind === 'card' ? c.tagline : c.lead) + '</p>' +
      (btn.length ? '<div class="cbs">' + btn.join('') + '</div>' : '') + (note ? '<div class="' + (ok ? 'ok' : 'bad') + '">' + esc(note) + '</div>' : '') +
      '<div id="qnote">' + (pending ? '<div class="ok">' + pending + ' request saved on this phone — it sends by itself when you are back online.</div>' : '') + '</div>' +
      (ok ? '' : '<div class="card"><b>' + (kind === 'card' ? 'Request service' : 'Get started') + '</b><form id="f"><input class="hp" name="website" tabindex="-1" autocomplete="off">' +
        '<label>Your name<input name="name" required maxlength="80"></label><label>Phone or email<input name="contact" required maxlength="120"></label>' +
        '<label>What do you need?<select name="need">' + needs.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('') + '</select></label>' +
        '<label>How did you find us?<select name="found">' + found + '</select></label>' +
        '<label>Anything else we should know? (optional)<textarea name="notes" rows="3" maxlength="600"></textarea></label>' +
        '<label class="ck"><input type="checkbox" name="consent" value="yes" required><span>' + esc(c.consent) + '</span></label><button>Send</button></form></div>') +
      (kind === 'front' ? '<p class="muted">' + esc(c.contact) + '</p>' : '');
    var f = document.getElementById('f');
    if (f) f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var d = {}; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) d[x.name] = x.type === 'checkbox' ? (x.checked ? 'yes' : '') : x.value.trim(); });
      var req = { action: 'pubLead', kind: kind, key: key, name: d.name, contact: d.contact, need: d.need, found: d.found, notes: d.notes, consent: d.consent, website: d.website,
        clientId: Date.now().toString(36) + Math.random().toString(36).slice(2, 8) };
      var offline = function () { req.queued = true; var qq = queue(); qq.push(req); ls('pe_pubq', qq); show(pub, 'No internet right now — your request is saved on this phone and will send by itself when you are back online.', true); };
      if (!navigator.onLine) return offline();
      api(req).then(function (r) { if (r.ok) show(pub, 'Thank you, ' + d.name + ' — we got your request and will reach out soon.', true); else show(pub, r.error || 'Please try again.', false); }).catch(offline);
    });
  }
  var cached = ls('pe_pub');
  if (cached) show(cached);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  api({ action: 'pub' }).then(function (pub) { if (pub.ok) { ls('pe_pub', pub); if (!document.getElementById('f') || !cached) show(pub); } flush(); })
    .catch(function () { if (!cached) m.innerHTML = '<p class="muted">Connect to the internet once to load this page. After that it works offline.</p>'; });
})();
