/* Crispus Profit Engine — offline app (v1.6, Nov 6, 2026: command-center look in ui.js).
 * Works with no internet: a full copy of the Profit Engine data is kept on this device, encrypted with your PIN
 * (AES-GCM, key made from the PIN with PBKDF2). Every change is saved on the device at once and queued; when the
 * device is online the queue is sent to the Profit Engine (Apps Script) and a fresh copy comes back.
 * The first sign-in on a device needs internet (the PIN is checked by the Profit Engine). After that it opens offline.
 */
(function () {
  'use strict';
  var CFG = window.PE_CONFIG || {};
  var app = document.getElementById('app'), netBtn = document.getElementById('netBtn');
  var S = { key: null, vault: null, syncing: false, msg: '', err: '' };
  var STAGES = ['new', 'contacted', 'consult', 'proposal', 'won', 'lost'];

  // ------------------------------------------------------------ small helpers
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function num(v) { var n = Number(String(v === undefined || v === null ? '' : v).replace(/[$,]/g, '')); return isFinite(n) ? n : 0; }
  function money(n) { return n === null || n === '' || n === undefined ? '—' : '$' + Math.round(num(n)).toLocaleString(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function monthKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1); }
  function rid() { var a = new Uint8Array(6); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (x) { return pad(x.toString(16)).slice(-2); }).join(''); }
  function T(name) { return (S.vault && S.vault.data && S.vault.data.tabs[name]) || []; }
  function C() { return (S.vault && S.vault.data && S.vault.data.config) || {}; }
  function online() { return navigator.onLine !== false; }

  // ------------------------------------------------------------ device storage (IndexedDB)
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('profit-engine', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function kv(mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) {
    var tx = d.transaction('kv', mode), st = tx.objectStore('kv'), out = fn(st);
    tx.oncomplete = function () { res(out && out.result); }; tx.onerror = function () { rej(tx.error); };
  }); }); }
  function get(k) { return kv('readonly', function (s) { return s.get(k); }); }
  function put(k, v) { return kv('readwrite', function (s) { s.put(v, k); }); }
  function del(k) { return kv('readwrite', function (s) { s.delete(k); }); }

  // ------------------------------------------------------------ encryption with the PIN
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function deriveKey(pin, salt) {
    return crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 210000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  function seal(key, obj) {
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)))
      .then(function (ct) { return { iv: b64(iv), ct: b64(ct) }; });
  }
  function unseal(key, box) {
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv) }, key, unb64(box.ct))
      .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); });
  }
  var saving = Promise.resolve();
  function save() { saving = saving.then(function () { return seal(S.key, S.vault).then(function (box) { return put('vault', box); }); }); return saving; }

  // ------------------------------------------------------------ server calls
  function api(body) {
    if (!CFG.API_URL) return Promise.reject(new Error('API_URL missing in config.js'));
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' })
      .then(function (r) { if (!r.ok) throw new Error('Server answered ' + r.status); return r.json(); });
  }

  // ------------------------------------------------------------ changes (applied here at once, queued for the server)
  function applyLocal(op) {
    var p = op.data || {}, t = op.type, tabs = S.vault.data.tabs;
    var find = function (tab, f, v) { return (tabs[tab] || []).filter(function (x) { return String(x[f]) === String(v); })[0]; };
    if (t === 'lead') { if (!find('Leads', 'id', p.id)) (tabs.Leads = tabs.Leads || []).push({ id: p.id, business: p.key, name: p.name, contact: p.contact || '', source: p.source || 'Manual (offline app)', persona: p.persona || '', stage: 'new', value: p.value || '', created: p.created || today(), updated: today(), notes: p.notes || '', _pending: 1 }); }
    else if (t === 'client') { if (!find('Clients', 'id', p.id)) (tabs.Clients = tabs.Clients || []).push({ id: p.id, business: p.key, name: p.name, status: 'active', monthly_value: p.value || '', last_contact: today(), added: today(), notes: p.notes || '', _pending: 1 }); }
    else if (t === 'stage') {
      var l = find('Leads', 'id', p.id); if (!l) return;
      l.stage = p.stage; l.updated = today(); l._pending = 1;
      if (p.stage === 'won') tabs.Clients.push({ id: 'w' + rid(), business: l.business, name: l.name, status: 'active', monthly_value: l.value, last_contact: today(), added: today(), notes: 'Won from lead ' + l.id, _pending: 1 });
    } else if (t === 'cstatus') {
      var c = find('Clients', 'id', p.id); if (!c) return;
      c.status = p.status; c._pending = 1;
      if (p.status === 'active') { c.last_contact = today(); c.risk_reason = ''; }
      if (p.status === 'at_risk') c.risk_reason = p.reason || 'Marked at risk';
      autoBackups();
    } else if (t === 'biz') {
      var b = find('Businesses', 'key', p.key), vals = {};
      ['name', 'monthly_goal', 'avg_price', 'margin_pct', 'capacity_month', 'close_rate', 'churn_month', 'billing', 'season_months', 'front_page', 'leads_sheet_id'].forEach(function (k) { vals[k] = p[k]; });
      if (b) {
        if (String(b.monthly_goal) !== String(p.monthly_goal)) vals.goal_note = 'STATED by you ' + today();
        if (String(b.avg_price) !== String(p.avg_price)) vals.price_note = 'STATED by you ' + today();
        Object.keys(vals).forEach(function (k) { b[k] = vals[k]; }); b._pending = 1;
      } else { vals.key = p.key; vals._pending = 1; tabs.Businesses.push(vals); }
    } else if (t === 'persona') { tabs.Personas.push({ business: p.key, persona: p.persona, who: p.who, where_to_find: p.where, offer: p.offer, _pending: 1 }); }
    else if (t === 'hist') { tabs.History.push({ month: p.month, business: p.key, revenue: p.revenue, source: 'STATED by you ' + today(), _pending: 1 }); }
    else if (t === 'lst') {
      var r = (tabs.Listings || []).filter(function (x) { return x.business === p.business && x.directory === p.directory; })[0]; if (!r) return;
      ['status', 'listed_name', 'listed_phone', 'listing_url', 'notes'].forEach(function (k) { r[k] = p[k]; }); r.last_checked = today(); r._pending = 1;
    } else if (t === 'cardsave') {
      var cd = find('Cards', 'key', p.key); if (!cd) return;
      ['brand', 'tagline', 'phone', 'text_phone', 'email', 'website', 'services'].forEach(function (k) { cd[k] = p[k]; }); cd._pending = 1;
    }
  }
  function change(type, data, note) {
    var op = { id: 'op-' + Date.now().toString(36) + '-' + rid(), type: type, data: data, at: new Date().toISOString() };
    applyLocal(op);
    S.vault.outbox.push(op);
    S.msg = (note || 'Saved') + (online() ? '.' : ' on this device — it will sync when you are back online.');
    return save().then(function () { render(); sync(); });
  }
  function autoBackups() {  // same rule as the Profit Engine: give each at-risk client a warm lead from the same business
    var used = {}, leads = T('Leads'), clients = T('Clients');
    clients.forEach(function (c) { if (c.backup_lead) used[c.backup_lead] = 1; });
    clients.filter(function (c) { return c.status === 'at_risk' && !c.backup_lead; }).forEach(function (c) {
      var l = leads.filter(function (x) { return x.business === c.business && !used[x.id] && ['contacted', 'consult', 'proposal', 'new'].indexOf(x.stage) >= 0; })
        .sort(function (a, b) { return STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage); })[0];
      if (l) { c.backup_lead = l.id; used[l.id] = 1; }
    });
  }

  // ------------------------------------------------------------ sync
  function sync(force) {
    if (!S.vault || S.syncing || !online()) { status(); return Promise.resolve(); }
    if (!force && !S.vault.outbox.length && S.vault.lastSync && Date.now() - Date.parse(S.vault.lastSync) < 60e3) { status(); return Promise.resolve(); }
    S.syncing = true; status();
    var sent = S.vault.outbox.slice(0, 200), sentIds = {};
    sent.forEach(function (o) { sentIds[o.id] = 1; });
    return api({ action: 'sync', token: S.vault.token, ops: sent.map(function (o) { return { id: o.id, type: o.type, data: o.data }; }) }).then(function (res) {
      if (!res.ok && res.auth === false) { S.vault.needLogin = true; S.err = res.error; return save(); }
      if (!res.ok) throw new Error(res.error || 'Sync failed');
      (res.results || []).forEach(function (r) { if (!r.ok) (S.vault.errors = S.vault.errors || []).push({ at: new Date().toISOString(), msg: r.msg }); });
      S.vault.outbox = S.vault.outbox.filter(function (o) { return !sentIds[o.id]; });
      S.vault.data = res.data;
      S.vault.outbox.forEach(applyLocal);  // changes made while this sync was running stay on top
      S.vault.lastSync = new Date().toISOString();
      S.vault.needLogin = false;
      return save();
    }).catch(function (e) { if (S.vault) S.vault.lastError = String(e.message || e); }).then(function () {
      S.syncing = false; status();
      if (!S.vault) return;
      render();
      if (S.vault.outbox.length && !S.vault.needLogin && !S.vault.lastError) setTimeout(function () { sync(true); }, 500);
      S.vault.lastError = '';
    });
  }
  function status() {
    if (!netBtn) return;
    var n = S.vault ? S.vault.outbox.length : 0;
    netBtn.className = 'net' + (!online() ? ' off' : n ? ' wait' : '');
    netBtn.textContent = S.syncing ? 'Syncing…' : !online() ? 'Offline' + (n ? ' · ' + n + ' waiting' : '') : n ? n + ' to sync' : 'Synced';
  }
  window.addEventListener('online', function () { status(); sync(true); });
  window.addEventListener('offline', status);
  setInterval(function () { if (S.vault) sync(); }, 60e3);
  netBtn.addEventListener('click', function () { location.hash = '#/sync'; });

  // ------------------------------------------------------------ plan math (same rules as the Profit Engine)
  function growth(series) {
    var pts = series.filter(function (p) { return p.v > 0; });
    if (pts.length < 3) return null;
    var n = pts.length, sx = 0, sy = 0, sxy = 0, sxx = 0;
    pts.forEach(function (p, i) { var y = Math.log(p.v); sx += i; sy += y; sxy += i * y; sxx += i * i; });
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    return Math.max(-0.15, Math.min(0.15, Math.exp(slope) - 1));
  }
  function project(b, hist) {
    var series = hist.filter(function (h) { return h.business === b.key; }).sort(function (a, c) { return String(a.month) < String(c.month) ? -1 : 1; })
      .map(function (h) { return { m: String(h.month).slice(0, 7), v: num(h.revenue) }; });
    var season = String(b.season_months || '').split(',').map(Number).filter(Boolean);
    var g = growth(season.length && b.key === 'TAX' ? [] : series);
    var last = series.length ? series[series.length - 1].v : 0;
    var avg = series.length ? series.reduce(function (s, p) { return s + p.v; }, 0) / series.length : 0;
    var out = [], d = new Date(); d.setDate(1);
    var a = function (arr) { return arr.length ? arr.reduce(function (s, p) { return s + p.v; }, 0) / arr.length : 0; };
    for (var t = 1; t <= 12; t++) {
      var m = new Date(d.getFullYear(), d.getMonth() + t, 1), mm = m.getMonth() + 1;
      var base = g === null ? avg : last * Math.pow(1 + g, t);
      if (b.key === 'TAX' && season.length) {
        var inS = series.filter(function (p) { return season.indexOf(Number(p.m.slice(5))) >= 0; });
        var offS = series.filter(function (p) { return season.indexOf(Number(p.m.slice(5))) < 0; });
        base = season.indexOf(mm) >= 0 ? a(inS) : a(offS);
      }
      out.push({ month: monthKey(m), value: Math.round(base) });
    }
    return { points: out, months: series.length, growth: g, basis: series.length ? (g === null ? 'average of ' + series.length + ' month(s)' : 'trend of ' + series.length + ' months') : 'no records yet' };
  }
  function clientsView() {  // shows clients with no contact in 30+ days as at risk, like the morning check does
    var days = C().atRiskDays || 30, cutoff = Date.now() - days * 864e5;
    return T('Clients').map(function (c) {
      if (c.status === 'active' && c.last_contact && Date.parse(c.last_contact) < cutoff) { var x = Object.assign({}, c); x.status = 'at_risk'; x.risk_reason = 'No contact in ' + days + '+ days'; return x; }
      return c;
    });
  }
  function planFor(b, leads, clients, hist) {
    var goal = num(b.monthly_goal), price = num(b.avg_price), close = num(b.close_rate) || 0.2, churn = num(b.churn_month);
    var mine = clients.filter(function (c) { return c.business === b.key; });
    var active = mine.filter(function (c) { return c.status === 'active' || c.status === 'at_risk'; });
    var atRisk = mine.filter(function (c) { return c.status === 'at_risk'; });
    var monthly = String(b.billing || '').toLowerCase() === 'monthly';
    var recurring = monthly ? active.reduce(function (s, c) { return s + num(c.monthly_value); }, 0) : 0;
    var bl = leads.filter(function (l) { return l.business === b.key; });
    var open = bl.filter(function (l) { return ['won', 'lost'].indexOf(l.stage) < 0; });
    var warm = open.filter(function (l) { return ['contacted', 'consult', 'proposal'].indexOf(l.stage) >= 0; });
    var thisMonth = monthKey(new Date());
    var wonMonth = bl.filter(function (l) { return l.stage === 'won' && String(l.updated).slice(0, 7) === thisMonth; });
    var leadsMonth = bl.filter(function (l) { return String(l.created).slice(0, 7) === thisMonth; });
    var proj = project(b, hist);
    var season = String(b.season_months || '').split(',').map(Number).filter(Boolean);
    var inSeason = !season.length || season.indexOf(new Date().getMonth() + 1) >= 0;
    var wonValue = monthly ? 0 : wonMonth.reduce(function (s, l) { return s + num(l.value); }, 0);
    var seasonal = !!season.length && !monthly && b.key === 'TAX';
    var monthGoal = goal, gap, newNeeded, leadsNeeded, perWeek, expectedSoFar, horizon = 'month';
    var replace = Math.ceil(active.length * churn);
    if (seasonal && !inSeason) {
      horizon = 'season';
      var now = new Date(), startM = Math.min.apply(null, season), endM = Math.max.apply(null, season);
      var start = new Date(now.getFullYear() + (now.getMonth() + 1 > endM ? 1 : 0), startM - 1, 1);
      var end = new Date(start.getFullYear(), endM, 0);
      monthGoal = goal * season.length; gap = Math.max(0, monthGoal);
      newNeeded = price ? Math.max(0, Math.ceil(gap / price) - active.length) : null;
      leadsNeeded = newNeeded !== null ? Math.max(0, Math.ceil(newNeeded / close) - open.length) : null;
      var weeks = Math.max(1, (end - now) / (7 * 864e5));
      perWeek = leadsNeeded !== null ? Math.ceil(leadsNeeded / weeks) : null;
      expectedSoFar = null;
    } else {
      gap = Math.max(0, monthGoal - recurring - wonValue);
      newNeeded = price ? Math.ceil(gap / price) : null;
      if (newNeeded !== null) newNeeded += replace;
      leadsNeeded = newNeeded !== null ? Math.ceil(newNeeded / close) : null;
      perWeek = leadsNeeded !== null ? Math.ceil(leadsNeeded / 4.33) : null;
      var day = new Date().getDate(), dim = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      expectedSoFar = leadsNeeded !== null ? Math.round(leadsNeeded * day / dim) : null;
    }
    var bench = atRisk.length + replace, issues = [];
    if (!goal) issues.push('Set a monthly goal so the plan can tell you how many clients you need.');
    if (!price) issues.push('Set the average price per client.');
    if (horizon === 'season' && leadsNeeded) issues.push('Off-season: ' + leadsNeeded + ' more leads needed before the season ends to reach ' + money(monthGoal) + ' (' + perWeek + ' a week, starting now; counts your ' + active.length + ' returning clients).');
    if (expectedSoFar !== null && leadsNeeded !== null && leadsMonth.length < expectedSoFar) issues.push('Behind on leads: ' + leadsMonth.length + ' so far this month, ' + expectedSoFar + ' needed by today (' + leadsNeeded + ' for the month).');
    if (num(b.capacity_month) && newNeeded > num(b.capacity_month)) issues.push('Needs ' + newNeeded + ' new clients but capacity is ' + b.capacity_month + ' — call on staff or raise prices.');
    atRisk.forEach(function (c) { if (!c.backup_lead) issues.push('At-risk client ' + c.name + ' has no backup lead ready.'); });
    if (warm.length < bench) issues.push('Backup bench is thin: ' + warm.length + ' warm lead(s), ' + bench + ' needed to cover at-risk and expected losses.');
    return { b: b, goal: monthGoal, horizon: horizon, recurring: recurring, gap: gap, newNeeded: newNeeded, leadsNeeded: leadsNeeded, perWeek: perWeek,
      leadsMonth: leadsMonth.length, wonMonth: wonMonth.length, active: active.length, atRisk: atRisk, open: open, warm: warm, bench: bench, proj: proj, issues: issues,
      stages: STAGES.map(function (s) { return [s, bl.filter(function (l) { return l.stage === s; }).length]; }) };
  }
  function fixFor(b, text) {
    if (/goal|price|capacity/i.test(text)) return ['#/setup/' + b.key, 'Fix on Setup'];
    if (/at-risk|backup/i.test(text)) return ['#/biz/' + b.key + '/clients', 'See clients'];
    if (/lead/i.test(text)) return ['#/biz/' + b.key + '/leads', 'Add / work leads'];
    return ['#/biz/' + b.key, 'Open'];
  }
  function issueList(b, issues) {
    return '<ul class="iss">' + issues.map(function (i) { var f = fixFor(b, i); return '<li>' + esc(i) + ' <a href="' + f[0] + '"><b>' + f[1] + ' →</b></a></li>'; }).join('') + '</ul>';
  }

  // ------------------------------------------------------------ screens
  function flash() {
    var h = (S.msg ? '<div class="msg">' + esc(S.msg) + '</div>' : '') + (S.err ? '<div class="msg err">' + esc(S.err) + '</div>' : '');
    S.msg = ''; S.err = ''; return h;
  }
  function pinScreen(first) {
    app.innerHTML = '<div class="pin card"><h1>' + (first ? 'Sign in on this device' : 'Unlock') + '</h1>' + flash() +
      '<p class="muted">' + (first ? 'Enter your Profit Engine PIN. The first sign-in on a device needs internet; after that the app opens with no internet.' :
        'Your data is saved on this device, locked with your PIN. Works with or without internet.') + '</p>' +
      '<form data-form="' + (first ? 'login' : 'unlock') + '"><label>PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required autofocus></label>' +
      (first ? '<label>Name this device<input name="device" value="' + esc(/iPhone|Android/.test(navigator.userAgent) ? 'Phone' : 'Computer') + '"></label>' : '') +
      '<button>' + (first ? 'Sign in' : 'Unlock') + '</button></form>' +
      (first ? '' : '<p class="muted">Not your device or forgot the PIN? <button class="light small" data-act="forget">Remove saved data from this device</button></p>') + '</div>';
  }
  function home() {
    var biz = T('Businesses'), leads = T('Leads'), clients = clientsView(), hist = T('History'), last = C().lastRun || {};
    var cards = biz.map(function (b) {
      var p = planFor(b, leads, clients, hist), open = '#/biz/' + encodeURIComponent(b.key);
      return '<div class="card' + (b._pending ? ' pending' : '') + '"><a href="' + open + '"><b>' + esc(b.name) + '</b></a> <span class="pill">' + esc(b.key) + '</span>' +
        '<div class="k">' + (p.leadsNeeded === null || !p.goal ? '<a class="bad" href="#/setup/' + esc(b.key) + '">' + (!num(b.avg_price) ? 'Set goal + price' : 'Set your goal') + '</a>' : '<a href="' + open + '/plan">' + p.perWeek + ' leads/week</a>') + '</div>' +
        '<div class="muted">' + (!p.goal ? 'No monthly goal yet' : p.horizon === 'season' ? 'Next season goal ' + money(p.goal) + ' · need ' + p.newNeeded + ' clients · ' + p.leadsNeeded + ' more leads before season ends' :
          'Goal ' + money(p.goal) + '/mo · need ' + p.newNeeded + ' new client(s) · ' + p.leadsMonth + ' of ' + p.leadsNeeded + ' leads this month') + '</div>' +
        '<div class="muted">' + p.active + ' active client(s) · ' + p.atRisk.length + ' at risk · ' + p.warm.length + ' warm backup(s)</div>' +
        (p.issues.length ? '<div class="bad">' + p.issues.length + ' need you:</div>' + issueList(b, p.issues) : '<div class="ok">On track</div>') +
        '<a class="btn" href="' + open + '">Open ' + esc(b.key) + '</a></div>';
    }).join('');
    return '<h1>Make My Business Profitable</h1>' + navTop() + flash() +
      '<p class="muted">Last morning check on the server: ' + esc(last.time ? new Date(last.time).toLocaleString() : 'not yet') + ' · Data on this device as of ' + esc(S.vault.data.at ? new Date(S.vault.data.at).toLocaleString() : '—') + '</p>' +
      '<div class="grid">' + cards + '</div>';
  }
  function navTop() {
    return '<div class="toolbar"><a class="btn light" href="#/all">All businesses</a><a class="btn light" href="#/setup">Setup</a><a class="btn light" href="#/listings">Listings &amp; cards</a>' +
      '<button class="light" data-act="run">Check now</button><a class="btn light" href="#/sync">Sync</a></div>';
  }
  function bizPage(key, jump) {
    var b = T('Businesses').filter(function (x) { return x.key === key; })[0];
    if (!b) return '<p>Business not found.</p>' + navTop();
    var leads = T('Leads'), clients = clientsView(), p = planFor(b, leads, clients, T('History'));
    var maxStage = Math.max.apply(null, p.stages.map(function (s) { return s[1]; }).concat([1]));
    var funnel = p.stages.map(function (s) { return '<tr><td><a href="#/biz/' + esc(key) + '/leads">' + s[0] + '</a></td><td style="width:70%"><div class="bar" style="width:' + Math.max(2, 100 * s[1] / maxStage) + '%"></div></td><td>' + s[1] + '</td></tr>'; }).join('');
    var leadRows = p.open.slice(0, 80).map(function (l) {
      return '<tr' + (l._pending ? ' class="pending"' : '') + '><td>' + esc(l.name) + '<div class="muted">' + esc(l.persona) + ' · ' + esc(l.source) + (l.contact ? ' · ' + esc(l.contact) : '') + '</div></td><td>' + esc(l.stage) + '</td><td>' +
        STAGES.filter(function (s) { return s !== l.stage; }).map(function (s) { return '<button class="light small" data-act="stage" data-id="' + esc(l.id) + '" data-stage="' + s + '">' + s + '</button>'; }).join('') + '</td></tr>';
    }).join('') || '<tr><td class="muted">No open leads.</td></tr>';
    var leadName = {}; leads.forEach(function (l) { leadName[l.id] = l.name; });
    var clientRows = clients.filter(function (c) { return c.business === key && c.status !== 'lost'; }).map(function (c) {
      return '<tr' + (c._pending ? ' class="pending"' : '') + '><td>' + esc(c.name) + (c.status === 'at_risk' ? ' <span class="bad">at risk</span><div class="muted">' + esc(c.risk_reason) +
        (c.backup_lead ? ' · backup: ' + esc(leadName[c.backup_lead] || c.backup_lead) : ' · NO BACKUP') + '</div>' : '') + '</td><td>' + money(c.monthly_value) + '</td><td>' +
        ['active:Talked today', 'at_risk:At risk', 'lost:Lost'].map(function (x) { var y = x.split(':'); return '<button class="light small" data-act="cstatus" data-id="' + esc(c.id) + '" data-status="' + y[0] + '">' + y[1] + '</button>'; }).join('') + '</td></tr>';
    }).join('') || '<tr><td class="muted">No clients recorded yet.</td></tr>';
    var personas = T('Personas').filter(function (x) { return x.business === key; }).map(function (x) { return '<tr><td><b>' + esc(x.persona) + '</b><div class="muted">' + esc(x.who) + '</div></td><td>' + esc(x.where_to_find) + '</td><td>' + esc(x.offer) + '</td></tr>'; }).join('');
    var proj = p.proj.points.map(function (x) { return '<td>' + x.month.slice(5) + '<br><b>' + money(x.value) + '</b></td>'; }).join('');
    var market = T('Market').filter(function (m) { return m.business === key || m.business === 'ALL'; }).map(function (m) { return '<tr><td>' + esc(m.metric) + '</td><td>' + esc(m.value) + '</td><td><a href="' + esc(m.source) + '" target="_blank" rel="noopener">source</a> <span class="muted">' + esc(m.as_of) + '</span></td></tr>'; }).join('');
    var src = T('Sources').filter(function (x) { return x.business === key || x.business === 'ALL'; });
    var sec = function (id, label) { return '<a class="btn light small" href="#/biz/' + esc(key) + '/' + id + '">' + label + '</a>'; };
    var html = '<h1>' + esc(b.name) + '</h1>' + navTop() + flash() +
      '<div class="nav">' + sec('plan', 'Plan') + sec('needs', 'Needs you') + sec('funnel', 'Funnel') + sec('leads', 'Leads') + sec('clients', 'Clients') + sec('personas', 'Personas') + sec('projection', 'Projection') + sec('market', 'Market') + sec('links', 'Files & links') +
      '<a class="btn light small" href="#/setup/' + esc(key) + '">Edit goal &amp; prices</a></div>' +
      '<div class="grid" id="plan"><div class="card"><div class="muted">' + (p.horizon === 'season' ? 'Before next season' : 'This month') + '</div><div class="k">' + (p.leadsNeeded === null ? '—' : p.leadsNeeded + ' leads → ' + p.newNeeded + ' clients') + '</div><div class="muted">' + (p.perWeek === null ? 'Set goal + price on Setup' : p.perWeek + ' leads a week · ' + p.leadsMonth + ' so far · ' + p.wonMonth + ' won') + '</div></div>' +
      '<div class="card"><div class="muted">Goal vs. recurring</div><div class="k">' + money(p.goal) + '</div><div class="muted">' + money(p.recurring) + ' already recurring · gap ' + money(p.gap) + '</div></div>' +
      '<div class="card"><div class="muted">Backup bench</div><div class="k">' + p.warm.length + ' / ' + p.bench + '</div><div class="muted">warm leads ready vs. needed for at-risk + expected losses</div></div></div>' +
      (p.issues.length ? '<div class="card" id="needs"><b>Needs you</b>' + issueList(b, p.issues) + '</div>' : '<div id="needs"></div>') +
      '<div class="card" id="funnel"><b>Client funnel</b><table>' + funnel + '</table></div>' +
      '<div class="card" id="leads"><b>Open leads</b><div class="scroll"><table>' + leadRows + '</table></div><details><summary>Add a lead</summary><form data-form="lead" data-key="' + esc(key) + '">' +
      '<label>Name<input name="name" required></label><label>Phone or email<input name="contact"></label><label>Persona<input name="persona"></label><label>Source<input name="source" placeholder="Referral, Facebook, card…"></label>' +
      '<label>Value ($)<input name="value" value="' + esc(b.avg_price) + '"></label><button>Add lead</button></form></details></div>' +
      '<div class="card" id="clients"><b>Clients</b><div class="scroll"><table>' + clientRows + '</table></div><details><summary>Add a client</summary><form data-form="client" data-key="' + esc(key) + '">' +
      '<label>Name<input name="name" required></label><label>Monthly value ($)<input name="value"></label><button>Add client</button></form></details></div>' +
      '<div class="card" id="personas"><b>Who to bring in (personas)</b><div class="scroll"><table>' + personas + '</table></div><details><summary>Add a persona</summary><form data-form="persona" data-key="' + esc(key) + '">' +
      '<label>Persona<input name="persona" required></label><label>Who they are<input name="who"></label><label>Where to find them<input name="where"></label><label>Offer<input name="offer"></label><button>Add</button></form></details></div>' +
      '<div class="card" id="projection"><b>12-month projection</b> <span class="muted">(' + esc(p.proj.basis) + (p.proj.growth !== null ? ', ' + Math.round(p.proj.growth * 1000) / 10 + '%/mo' : '') + '; rough — records are partial)</span>' +
      '<div class="scroll"><table><tr>' + proj + '</tr></table></div><details><summary>Add a month of revenue</summary><form data-form="hist" data-key="' + esc(key) + '">' +
      '<label>Month (YYYY-MM)<input name="month" placeholder="2026-09" pattern="\\d{4}-\\d{2}" required></label><label>Revenue ($)<input name="revenue" inputmode="decimal" required></label><button>Add</button></form></details></div>' +
      '<div class="card" id="market"><b>Market</b><div class="scroll"><table>' + market + '</table></div></div>' +
      '<div class="card" id="links"><b>Files &amp; links</b> <span class="muted">(open when online)</span><ul class="iss">' +
      (b.front_page ? '<li><a href="' + esc(b.front_page) + '" target="_blank" rel="noopener">Front page (what clients see) ↗</a></li>' : '') +
      (b.leads_sheet_id ? '<li><a href="https://docs.google.com/spreadsheets/d/' + esc(b.leads_sheet_id) + '/edit" target="_blank" rel="noopener">Front page leads sheet ↗</a></li>' : '') +
      (C().dataUrl ? '<li><a href="' + esc(C().dataUrl) + '" target="_blank" rel="noopener">Profit Engine data sheet (all tabs) ↗</a></li>' : '') + '</ul>' +
      (src.length ? '<b>Built from your files</b><ul class="iss">' + src.map(function (x) { return '<li><a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.title) + ' ↗</a> <span class="muted">' + esc(x.used_for) + '</span></li>'; }).join('') + '</ul>' : '') + '</div>';
    return html;
  }
  var BIZ_FIELDS = [['name', 'Name'], ['monthly_goal', 'Monthly revenue goal ($)', 'goal_note'], ['avg_price', 'Average price per client ($)', 'price_note'], ['margin_pct', 'Profit margin (e.g. 0.4)'],
    ['capacity_month', 'Most new clients you can handle a month'], ['close_rate', 'Close rate (share of leads that become clients, e.g. 0.2)'], ['churn_month', 'Share of clients lost per month (e.g. 0.05)'],
    ['billing', 'Billing (monthly / yearly / one-time / project / cohort)'], ['season_months', 'Busy months (numbers, e.g. 1,2,3,4)'], ['front_page', 'Front page link'], ['leads_sheet_id', 'Front page leads sheet ID']];
  function setupPage(only) {
    var all = T('Businesses'), biz = all.filter(function (x) { return !only || x.key === only; });
    var f = function (b) {
      return '<div class="card' + (b._pending ? ' pending' : '') + '"><b>' + esc(b.name || 'New business') + '</b>' + (b.key ? ' <a class="btn light small" href="#/biz/' + esc(b.key) + '">Open ' + esc(b.key) + ' plan</a>' : '') +
        '<form data-form="biz" data-key="' + esc(b.key || '') + '">' + (b.key ? '' : '<label>Key (2–10 capital letters)<input name="key" pattern="[A-Z0-9]{2,10}" required></label>') +
        BIZ_FIELDS.map(function (x) { return '<label>' + x[1] + '<input name="' + x[0] + '" value="' + esc(b[x[0]]) + '">' + (x[2] && b[x[2]] ? '<span class="muted">' + esc(b[x[2]]) + '</span>' : '') + '</label>'; }).join('') +
        '<button>Save</button></form></div>';
    };
    return '<h1>Setup' + (only ? ' — ' + esc(only) : '') + '</h1>' + navTop() + flash() + '<div class="card">Jump to: ' + all.map(function (x) { return '<a class="btn light small" href="#/setup/' + esc(x.key) + '">' + esc(x.key) + '</a>'; }).join('') +
      '<a class="btn light small" href="#/setup">All</a></div>' + biz.map(f).join('') + (only ? '' : f({}));
  }
  function listingIssues() {
    var cards = {}, out = [], dirs = C().directories || [];
    T('Cards').forEach(function (c) { cards[c.key] = c; });
    T('Listings').forEach(function (r) {
      var c = cards[r.business] || {}, d = dirs.filter(function (x) { return x[0] === r.directory; })[0] || ['', '', ''];
      var dg = function (s) { return String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); };
      if (r.status === 'not needed') return;
      if (r.status === 'needs fix') out.push({ b: r.business, m: r.directory + ' needs a fix' + (r.notes ? ': ' + r.notes : '') });
      else if (r.status !== 'verified' && r.status !== 'claimed') out.push({ b: r.business, m: r.directory + ' is ' + (r.status || 'not started') + ' (feeds ' + d[2] + ')' });
      if (r.listed_phone && c.phone && dg(r.listed_phone) !== dg(c.phone)) out.push({ b: r.business, m: r.directory + ' shows ' + r.listed_phone + ' but your card says ' + c.phone });
      if (r.listed_name && c.brand && String(r.listed_name).trim().toLowerCase() !== String(c.brand).trim().toLowerCase()) out.push({ b: r.business, m: r.directory + ' name "' + r.listed_name + '" doesn\'t match "' + c.brand + '"' });
    });
    return out;
  }
  function listingsPage() {
    var issues = listingIssues(), dirs = C().directories || [], statuses = C().listingStatuses || [], lst = T('Listings');
    var opt = function (list, cur) { return list.map(function (s) { return '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join(''); };
    var h = '<h1>Listings &amp; cards</h1>' + navTop() + flash() +
      '<div class="card"><b>How voice search finds you</b><p class="muted">Siri uses Apple Business Connect (with Yelp reviews). Alexa uses Bing Places and Yelp. Google Assistant uses your Google Business Profile. Keep the same name, phone and hours on every one. Manage: ' +
      dirs.map(function (d) { return '<a href="' + esc(d[1]) + '" target="_blank" rel="noopener">' + esc(d[0]) + '</a>'; }).join(' · ') + '</p>' +
      (issues.length ? '<div class="bad">' + issues.length + ' need you:</div><ul class="iss">' + issues.map(function (x) { return '<li><b>' + esc(x.b) + ':</b> ' + esc(x.m) + '</li>'; }).join('') + '</ul>' : '<div class="ok">Every listing is set up and matches.</div>') + '</div>';
    T('Cards').forEach(function (c) {
      var st = {}; lst.filter(function (r) { return r.business === c.key; }).forEach(function (r) { st[r.directory] = r.status; });
      var on = function (d) { return st[d] === 'verified' || st[d] === 'claimed'; };
      var cov = [['Siri', on('Apple Business Connect')], ['Alexa', on('Bing Places') || on('Yelp for Business')], ['Google Assistant', on('Google Business Profile')]];
      var url = (C().execUrl || '') + '?card=' + encodeURIComponent(c.key), off = new URL('card.html?card=' + encodeURIComponent(c.key), location.href).href;
      h += '<div class="card' + (c._pending ? ' pending' : '') + '" id="c-' + esc(c.key) + '"><b>' + esc(c.brand) + '</b> <span class="pill">' + esc(c.key) + '</span><p>' + cov.map(function (v) { return (v[1] ? '✅ ' : '⬜ ') + v[0]; }).join(' &nbsp; ') + '</p>' +
        '<p class="muted">Card link (NFC sticker / QR): <a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url) + '</a><br>Works-offline card page: <a href="' + esc(off) + '" target="_blank" rel="noopener">' + esc(off) + '</a></p>' +
        lst.filter(function (r) { return r.business === c.key; }).map(function (r) {
          return '<details' + (r._pending ? ' class="pending"' : '') + '><summary>' + esc(r.directory) + ' — ' + esc(r.status || 'not started') + '</summary><form data-form="lst" data-business="' + esc(r.business) + '" data-directory="' + esc(r.directory) + '">' +
            '<label>Status<select name="status">' + opt(statuses, r.status) + '</select></label><label>Name shown<input name="listed_name" value="' + esc(r.listed_name) + '"></label>' +
            '<label>Phone shown<input name="listed_phone" value="' + esc(r.listed_phone) + '"></label><label>Listing link<input name="listing_url" value="' + esc(r.listing_url) + '"></label>' +
            '<label>Notes<input name="notes" value="' + esc(r.notes) + '"></label><button>Save</button></form></details>';
        }).join('') +
        '<details><summary>Edit this card</summary><form data-form="cardsave" data-key="' + esc(c.key) + '">' +
        [['brand', 'Business name'], ['tagline', 'Tagline'], ['phone', 'Call number'], ['text_phone', 'Text number'], ['email', 'Email'], ['website', 'Website'], ['services', 'Services (separate with |)']]
          .map(function (x) { return '<label>' + x[1] + '<input name="' + x[0] + '" value="' + esc(c[x[0]]) + '"></label>'; }).join('') + '<button>Save card</button></form></details></div>';
    });
    return h;
  }
  function syncPage() {
    var v = S.vault, errs = (v.errors || []).slice(-20).reverse();
    return '<h1>Sync</h1>' + navTop() + flash() + '<div class="card"><p><b>' + (online() ? 'Online' : 'Offline') + '</b> · ' + v.outbox.length + ' change(s) waiting to send</p>' +
      '<p class="muted">Last synced: ' + esc(v.lastSync ? new Date(v.lastSync).toLocaleString() : 'never') + '</p>' +
      (v.needLogin ? '<div class="msg err">This device was signed out on the server. Sign in again with your PIN while online; your waiting changes are kept.</div><button data-act="relogin">Sign in again</button>' : '') +
      '<button data-act="syncnow"' + (online() ? '' : ' disabled') + '>Sync now</button><button class="light" data-act="lock">Lock app</button></div>' +
      (v.outbox.length ? '<div class="card"><b>Waiting to send</b><ul class="iss">' + v.outbox.map(function (o) { return '<li>' + esc(o.type) + ' · ' + esc(new Date(o.at).toLocaleString()) + ' · ' + esc(o.data.name || o.data.key || o.data.directory || o.data.stage || o.data.status || '') + '</li>'; }).join('') + '</ul></div>' : '') +
      (errs.length ? '<div class="card"><b>Changes the server could not apply</b><ul class="iss">' + errs.map(function (e) { return '<li>' + esc(new Date(e.at).toLocaleString()) + ' · ' + esc(e.msg) + '</li>'; }).join('') + '</ul><button class="light small" data-act="clearerr">Clear this list</button></div>' : '') +
      '<div class="card muted">How it works: every change is saved on this device right away (locked with your PIN) and sent to the Profit Engine when you are online. The server keeps one copy of the truth; if the same item was changed in two places, the change sent last wins. Morning checks, lead imports from your front pages and alert emails run on the server and show up here after the next sync.</div>';
  }

  // ------------------------------------------------------------ router
  window.PE = { T: T, C: C, S: S, STAGES: STAGES, planFor: planFor, clientsView: clientsView, change: change, sync: function (f) { return sync(f); },
    online: online, esc: esc, num: num, money: money, rid: rid, today: today, issueList: issueList, listingIssues: function () { return listingIssues(); }, render: function () { render(); } };
  function render() {
    status();
    if (!S.vault) return;
    if (S.vault.needLogin && !online()) S.err = S.err || 'Signed out on the server — changes are still saved here and will send after you sign in again online.';
    var h = location.hash.replace(/^#\/?/, '').split('/'), html;
    if (h[0] === 'biz' && h[1]) html = bizPage(decodeURIComponent(h[1]));
    else if (h[0] === 'setup') html = setupPage(h[1] ? decodeURIComponent(h[1]) : '');
    else if (h[0] === 'listings') html = listingsPage();
    else if (h[0] === 'sync') html = syncPage();
    else if (h[0] === 'all') html = home();
    else if (window.PEUI && PEUI.views[h[0]]) html = PEUI.views[h[0]](h.slice(1));
    else html = window.PEUI ? PEUI.views.dash([]) : home();
    app.innerHTML = html;
    var jump = h[0] === 'biz' ? h[2] : '';
    var el = jump && document.getElementById(jump);
    if (el) el.scrollIntoView(); else if (!jump) window.scrollTo(0, 0);
    if (window.PEUI && PEUI.after) PEUI.after(h);
  }
  window.addEventListener('hashchange', function () { if (S.vault) render(); });

  function formData(f) { var o = {}; Array.prototype.forEach.call(f.elements, function (x) { if (x.name) o[x.name] = x.value.trim(); }); return o; }
  app.addEventListener('submit', function (ev) {
    var f = ev.target, kind = f.getAttribute('data-form'); if (!kind) return;
    ev.preventDefault();
    var d = formData(f), key = f.getAttribute('data-key');
    if (kind === 'login') return login(d.pin, d.device);
    if (kind === 'unlock') return unlock(d.pin);
    if (kind === 'lead') return change('lead', { id: rid() + rid().slice(0, 4), key: key, name: d.name, contact: d.contact, persona: d.persona, source: d.source, value: d.value, created: today() }, 'Lead added');
    if (kind === 'client') return change('client', { id: rid() + rid().slice(0, 4), key: key, name: d.name, value: d.value }, 'Client added');
    if (kind === 'persona') return change('persona', { key: key, persona: d.persona, who: d.who, where: d.where, offer: d.offer }, 'Persona added');
    if (kind === 'hist') return change('hist', { key: key, month: d.month, revenue: d.revenue }, 'Month added');
    if (kind === 'biz') {
      var k = key || d.key;
      if (!/^[A-Z0-9]{2,10}$/.test(k)) { S.err = 'Key must be 2–10 capital letters'; return render(); }
      var data = { key: k }; BIZ_FIELDS.forEach(function (x) { data[x[0]] = d[x[0]] || ''; });
      return change('biz', data, 'Saved ' + (d.name || k));
    }
    if (kind === 'lst') return change('lst', { business: f.getAttribute('data-business'), directory: f.getAttribute('data-directory'), status: d.status, listed_name: d.listed_name, listed_phone: d.listed_phone, listing_url: d.listing_url, notes: d.notes }, 'Listing saved');
    if (kind === 'cardsave') {
      var dg = function (s) { return String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); };
      if (dg(d.phone) === '2486906860' || dg(d.text_phone) === '2486906860') { S.err = 'Your personal number can\'t go on a client card — use the business line.'; return render(); }
      return change('cardsave', { key: key, brand: d.brand, tagline: d.tagline, phone: d.phone, text_phone: d.text_phone, email: d.email, website: d.website, services: d.services }, 'Card saved');
    }
  });
  app.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;
    var a = b.getAttribute('data-act');
    if (a === 'stage') { var l = T('Leads').filter(function (x) { return x.id === b.getAttribute('data-id'); })[0]; change('stage', { id: b.getAttribute('data-id'), stage: b.getAttribute('data-stage') }, 'Moved ' + (l ? l.name : 'lead') + ' to ' + b.getAttribute('data-stage')); }
    else if (a === 'cstatus') change('cstatus', { id: b.getAttribute('data-id'), status: b.getAttribute('data-status') }, 'Client updated');
    else if (a === 'run') { if (online()) change('run', {}, 'Check requested'); else { S.msg = 'The full check runs on the server — it will run after your next sync. The numbers here are already up to date with your changes.'; render(); } }
    else if (a === 'syncnow') sync(true);
    else if (a === 'clearerr') { S.vault.errors = []; save().then(render); }
    else if (a === 'lock') { S.key = null; S.vault = null; pinScreen(false); status(); }
    else if (a === 'relogin') { S.vault.relogin = true; pinScreen(true); }
    else if (a === 'forget') { if (window.confirm('Remove all Profit Engine data saved on this device? Changes not yet synced will be lost.')) Promise.all([del('vault'), del('salt')]).then(function () { pinScreen(true); }); }
  });

  // ------------------------------------------------------------ sign in / unlock
  function login(pin, device) {
    if (!online()) { S.err = 'The first sign-in on a device needs internet.'; return pinScreen(true); }
    app.innerHTML = '<p class="muted">Signing in…</p>';
    var keep = S.vault && S.vault.relogin ? S.vault.outbox : [];
    return api({ action: 'login', pin: pin, device: device || 'device' }).then(function (res) {
      if (!res.ok) { S.err = res.error || 'Could not sign in'; return pinScreen(true); }
      var salt = crypto.getRandomValues(new Uint8Array(16));
      return deriveKey(pin, salt).then(function (key) {
        S.key = key; S.vault = { token: res.token, data: res.data, outbox: keep, lastSync: new Date().toISOString(), errors: [] };
        keep.forEach(applyLocal);
        return put('salt', b64(salt)).then(save).then(function () { S.msg = 'Signed in. This device now works with or without internet.'; render(); if (keep.length) sync(true); });
      });
    }).catch(function (e) { S.err = 'Could not reach the Profit Engine: ' + e.message; pinScreen(true); });
  }
  function unlock(pin) {
    return Promise.all([get('salt'), get('vault')]).then(function (r) {
      if (!r[0] || !r[1]) return pinScreen(true);
      return deriveKey(pin, unb64(r[0])).then(function (key) {
        return unseal(key, r[1]).then(function (v) { S.key = key; S.vault = v; v.outbox = v.outbox || []; render(); sync(true); });
      });
    }).catch(function () { S.err = 'Wrong PIN.'; setTimeout(function () { pinScreen(false); }, 900); });
  }

  // ------------------------------------------------------------ start
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  get('vault').then(function (v) { pinScreen(!v); status(); }).catch(function (e) { app.innerHTML = '<div class="msg err">This browser blocked app storage (' + esc(e.message) + '). Open the app in Chrome or Safari, not a private window.</div>'; });
})();
