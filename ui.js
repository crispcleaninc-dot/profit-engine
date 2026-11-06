/* Crispus Profit Engine — command-center look (v1.6, Nov 6, 2026).
 * Dashboard, all-leads board, search, quick add, light/dark theme and the Install button.
 * Uses the data and change queue from app.js (window.PE), so everything still works offline and syncs the same way. */
(function () {
  'use strict';
  var BIZ = { TAX: ['#b8862b', 'Tax'], CARES: ['#0f8a7e', 'Home care'], HVAC: ['#2f6fd0', 'HVAC'], MERCH: ['#8a4fd0', 'Merch'], CMCC: ['#2e8b3d', 'CMCC'] };
  var I = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    biz: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    leads: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 3.5 6"/>',
    voice: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14 5.3"/><path d="M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4"/><path d="M6 21v-4h4"/>',
    alert: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/>',
    risk: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.5"/>',
    people: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    install: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'
  };
  function ico(n, s) { return '<svg class="ico" width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>'; }
  function col(k) { return (BIZ[k] || ['#5f6b7a'])[0]; }
  function chip(k) { return '<span class="bchip" style="--c:' + col(k) + '">' + PE.esc(k) + '</span>'; }
  function ring(pct, c, label) {
    var r = 26, len = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
    return '<svg class="ring" width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="' + PE.esc(label) + '"><circle cx="32" cy="32" r="' + r + '" fill="none" stroke="var(--line)" stroke-width="7"/>' +
      '<circle cx="32" cy="32" r="' + r + '" fill="none" stroke="' + c + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (len * p).toFixed(1) + ' ' + len.toFixed(1) + '" transform="rotate(-90 32 32)"/>' +
      '<text x="32" y="36" text-anchor="middle" font-size="13" font-weight="700" fill="currentColor">' + Math.round(p * 100) + '%</text></svg>';
  }
  function plans() {
    var leads = PE.T('Leads'), clients = PE.clientsView(), hist = PE.T('History');
    return PE.T('Businesses').map(function (b) { return PE.planFor(b, leads, clients, hist); });
  }
  function greet() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function kpi(icon, tone, value, label, href) {
    return '<a class="kpi ' + tone + '" href="' + href + '"><span class="kico">' + ico(icon, 22) + '</span><span class="kval">' + value + '</span><span class="klab">' + label + '</span></a>';
  }

  // ------------------------------------------------------------ dashboard
  function dash() {
    var ps = plans(), S = PE.S, out = S.vault ? S.vault.outbox.length : 0;
    var issues = [], leadsM = 0, need = 0, active = 0, risk = 0;
    ps.forEach(function (p) {
      p.issues.forEach(function (i) { issues.push({ b: p.b, m: i }); });
      leadsM += p.leadsMonth; need += p.leadsNeeded || 0; active += p.active; risk += p.atRisk.length;
    });
    var lst = PE.listingIssues().length;
    var last = (PE.C().lastRun || {}).time;
    var html = '<section class="hero"><div><div class="eyebrow">' + greet() + ', Cyars · ' + new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) + '</div>' +
      '<h1>Make My Business Profitable</h1><div class="sub">' + (PE.online() ? 'Live' : 'Offline — everything still works') + ' · morning check ' + PE.esc(last ? new Date(last).toLocaleString() : 'not yet') + '</div></div>' +
      '<button class="btn gold" data-ui="quick">' + ico('plus', 18) + ' Quick add</button></section>' +
      '<div class="kpis">' +
      kpi('alert', issues.length ? 'bad' : 'good', issues.length, 'Need you', '#/dash') +
      kpi('target', 'accent', leadsM + (need ? '<small> / ' + need + '</small>' : ''), 'Leads this month', '#/leads') +
      kpi('people', 'good', active, 'Active clients', '#/all') +
      kpi('risk', risk ? 'warn' : 'good', risk, 'At risk', '#/all') +
      kpi('voice', lst ? 'warn' : 'good', lst, 'Listing fixes', '#/listings') +
      kpi('sync', out ? 'warn' : 'good', out || '✓', out ? 'Waiting to sync' : 'All synced', '#/sync') + '</div>';
    html += '<div class="cols"><section class="panel" id="needs"><div class="ph"><h2>' + ico('alert', 18) + ' Needs you</h2><span class="pill">' + issues.length + '</span></div>' +
      (issues.length ? '<ul class="feed">' + issues.slice(0, 12).map(function (x) {
        return '<li style="--c:' + col(x.b.key) + '">' + chip(x.b.key) + '<span>' + PE.esc(x.m) + '</span>' + PE.issueList(x.b, [x.m]).replace(/^<ul class="iss"><li>[\s\S]*?(<a [\s\S]*?<\/a>)<\/li><\/ul>$/, '$1') + '</li>';
      }).join('') + '</ul>' + (issues.length > 12 ? '<p class="muted">+' + (issues.length - 12) + ' more inside each business.</p>' : '') : '<p class="ok">Nothing needs you right now.</p>') + '</section>';
    html += '<section class="panel"><div class="ph"><h2>' + ico('biz', 18) + ' Businesses</h2><a class="link" href="#/all">Full plans →</a></div><div class="btiles">' + ps.map(function (p) {
      var c = col(p.b.key), pct = p.leadsNeeded ? p.leadsMonth / p.leadsNeeded : (p.goal ? 1 : 0);
      return '<a class="btile" href="#/biz/' + encodeURIComponent(p.b.key) + '" style="--c:' + c + '">' + ring(pct, c, p.b.key + ' leads progress') +
        '<div class="bt"><div class="bn">' + PE.esc(p.b.name) + '</div>' +
        '<div class="muted">' + (!p.goal ? 'Set your goal' : (p.perWeek === null ? 'Set your price' : p.perWeek + ' leads/week · ' + p.leadsMonth + ' of ' + p.leadsNeeded)) + '</div>' +
        '<div class="muted">' + p.active + ' clients · ' + p.atRisk.length + ' at risk · ' + p.warm.length + ' warm</div>' +
        (p.issues.length ? '<span class="tag bad">' + p.issues.length + ' need you</span>' : '<span class="tag good">On track</span>') + '</div></a>';
    }).join('') + '</div></section></div>';
    var recent = PE.T('Leads').slice().sort(function (a, b) { return String(b.created).localeCompare(String(a.created)); }).slice(0, 6);
    html += '<div class="cols"><section class="panel"><div class="ph"><h2>' + ico('leads', 18) + ' Newest leads</h2><a class="link" href="#/leads">All leads →</a></div>' +
      (recent.length ? '<ul class="list">' + recent.map(function (l) {
        return '<li>' + chip(l.business) + '<div><b>' + PE.esc(l.name) + '</b><div class="muted">' + PE.esc(l.source) + ' · ' + PE.esc(l.created) + '</div></div><span class="stage s-' + PE.esc(l.stage) + '">' + PE.esc(l.stage) + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted">No leads yet.</p>') + '</section>';
    html += '<section class="panel"><div class="ph"><h2>' + ico('voice', 18) + ' Voice search</h2><a class="link" href="#/listings">Listings →</a></div><table class="cov"><tr><th></th><th>Siri</th><th>Alexa</th><th>Google</th></tr>' +
      PE.T('Cards').map(function (c) {
        var st = {}; PE.T('Listings').filter(function (r) { return r.business === c.key; }).forEach(function (r) { st[r.directory] = r.status; });
        var on = function (d) { return st[d] === 'verified' || st[d] === 'claimed'; };
        var dot = function (v, pend) { return '<td><span class="dot ' + (v ? 'on' : pend ? 'pend' : '') + '" aria-label="' + (v ? 'listed' : pend ? 'pending' : 'not yet') + '"></span></td>'; };
        return '<tr><td>' + chip(c.key) + '</td>' + dot(on('Apple Business Connect')) + dot(on('Bing Places') || on('Yelp for Business')) +
          dot(on('Google Business Profile'), st['Google Business Profile'] === 'pending verification') + '</tr>';
      }).join('') + '</table><p class="muted"><span class="dot on"></span> listed &nbsp; <span class="dot pend"></span> pending &nbsp; <span class="dot"></span> not yet</p></section></div>';
    return html;
  }

  // ------------------------------------------------------------ all leads board
  function leadsView(args) {
    var f = decodeURIComponent(args[0] || 'ALL'), stg = decodeURIComponent(args[1] || 'open');
    var all = PE.T('Leads').filter(function (l) { return (f === 'ALL' || l.business === f) && (stg === 'all' ? true : stg === 'open' ? ['won', 'lost'].indexOf(l.stage) < 0 : l.stage === stg); })
      .sort(function (a, b) { return String(b.updated || b.created).localeCompare(String(a.updated || a.created)); });
    var keys = ['ALL'].concat(PE.T('Businesses').map(function (b) { return b.key; }));
    var stages = ['open'].concat(PE.STAGES).concat(['all']);
    return '<h1>All leads</h1><div class="filters">' + keys.map(function (k) { return '<a class="fchip' + (k === f ? ' on' : '') + '" style="--c:' + col(k) + '" href="#/leads/' + encodeURIComponent(k) + '/' + stg + '">' + k + '</a>'; }).join('') + '</div>' +
      '<div class="filters">' + stages.map(function (s) { return '<a class="fchip sm' + (s === stg ? ' on' : '') + '" href="#/leads/' + encodeURIComponent(f) + '/' + s + '">' + s + '</a>'; }).join('') + '</div>' +
      '<p class="muted">' + all.length + ' lead(s). Tap a stage to move a lead — it saves on this device and syncs.</p>' +
      (all.length ? '<ul class="list cards">' + all.slice(0, 150).map(function (l) {
        return '<li class="lcard' + (l._pending ? ' pending' : '') + '" style="--c:' + col(l.business) + '"><div class="lrow">' + chip(l.business) + '<b>' + PE.esc(l.name) + '</b><span class="stage s-' + PE.esc(l.stage) + '">' + PE.esc(l.stage) + '</span></div>' +
          '<div class="muted">' + [l.contact, l.persona, l.source, l.created].filter(String).map(PE.esc).join(' · ') + '</div><div class="moves">' +
          PE.STAGES.filter(function (s) { return s !== l.stage; }).map(function (s) { return '<button class="light small" data-act="stage" data-id="' + PE.esc(l.id) + '" data-stage="' + s + '">' + s + '</button>'; }).join('') + '</div></li>';
      }).join('') + '</ul>' : '<p class="muted">No leads match.</p>');
  }

  // ------------------------------------------------------------ search
  function searchView(args) {
    var q = decodeURIComponent(args.join('/') || '').trim().toLowerCase();
    var has = function (o, fields) { return fields.some(function (k) { return String(o[k] || '').toLowerCase().indexOf(q) >= 0; }); };
    if (!q) return '<h1>Search</h1><p class="muted">Type a name, phone, email or business in the search box.</p>';
    var L = PE.T('Leads').filter(function (l) { return has(l, ['name', 'contact', 'persona', 'source', 'notes']); });
    var Cl = PE.T('Clients').filter(function (c) { return has(c, ['name', 'notes']); });
    var B = PE.T('Businesses').filter(function (b) { return has(b, ['name', 'key']); });
    var P = PE.T('Personas').filter(function (p) { return has(p, ['persona', 'who', 'where_to_find', 'offer']); });
    var sec = function (title, arr, fn) { return arr.length ? '<section class="panel"><div class="ph"><h2>' + title + '</h2><span class="pill">' + arr.length + '</span></div><ul class="list">' + arr.slice(0, 40).map(fn).join('') + '</ul></section>' : ''; };
    var body = sec('Leads', L, function (l) { return '<li>' + chip(l.business) + '<div><a href="#/biz/' + encodeURIComponent(l.business) + '/leads"><b>' + PE.esc(l.name) + '</b></a><div class="muted">' + PE.esc(l.contact) + ' · ' + PE.esc(l.stage) + '</div></div></li>'; }) +
      sec('Clients', Cl, function (c) { return '<li>' + chip(c.business) + '<div><a href="#/biz/' + encodeURIComponent(c.business) + '/clients"><b>' + PE.esc(c.name) + '</b></a><div class="muted">' + PE.esc(c.status) + '</div></div></li>'; }) +
      sec('Businesses', B, function (b) { return '<li>' + chip(b.key) + '<a href="#/biz/' + encodeURIComponent(b.key) + '"><b>' + PE.esc(b.name) + '</b></a></li>'; }) +
      sec('Personas', P, function (p) { return '<li>' + chip(p.business) + '<div><b>' + PE.esc(p.persona) + '</b><div class="muted">' + PE.esc(p.who) + '</div></div></li>'; });
    return '<h1>Search: “' + PE.esc(q) + '”</h1>' + (body || '<p class="muted">Nothing found.</p>');
  }

  // ------------------------------------------------------------ quick add sheet
  var sheet = document.getElementById('sheet');
  function openQuick() {
    var opts = PE.T('Businesses').map(function (b) { return '<option value="' + PE.esc(b.key) + '">' + PE.esc(b.name) + '</option>'; }).join('');
    sheet.innerHTML = '<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="qtitle"><div class="ph"><h2 id="qtitle">Quick add</h2><button class="light small" data-ui="close" aria-label="Close">Close</button></div>' +
      '<div class="seg" role="tablist"><button class="on" data-ui="qt" data-t="lead">Lead</button><button data-ui="qt" data-t="client">Client</button><button data-ui="qt" data-t="hist">Revenue</button></div>' +
      '<form id="qform" data-t="lead"><label>Business<select name="key">' + opts + '</select></label><div id="qfields"></div><button class="btn gold wide">Save</button>' +
      '<p class="muted">' + (PE.online() ? 'Saves now and syncs.' : 'You are offline — it saves on this device and syncs when you are back online.') + '</p></form></div>';
    fields('lead'); sheet.classList.add('open');
    var first = sheet.querySelector('select'); if (first) first.focus();
  }
  function fields(t) {
    var f = { lead: '<label>Name<input name="name" required></label><label>Phone or email<input name="contact"></label><label>Source<input name="source" placeholder="Referral, card, Facebook…"></label><label>Persona<input name="persona"></label>',
      client: '<label>Name<input name="name" required></label><label>Monthly value ($)<input name="value" inputmode="decimal"></label>',
      hist: '<label>Month (YYYY-MM)<input name="month" placeholder="2026-11" pattern="\\d{4}-\\d{2}" required></label><label>Revenue ($)<input name="revenue" inputmode="decimal" required></label>' }[t];
    document.getElementById('qfields').innerHTML = f; document.getElementById('qform').setAttribute('data-t', t);
    Array.prototype.forEach.call(sheet.querySelectorAll('.seg button'), function (b) { b.classList.toggle('on', b.getAttribute('data-t') === t); });
  }
  function closeQuick() { sheet.classList.remove('open'); sheet.innerHTML = ''; }
  sheet.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var fm = ev.target, t = fm.getAttribute('data-t'), d = {};
    Array.prototype.forEach.call(fm.elements, function (x) { if (x.name) d[x.name] = x.value.trim(); });
    var b = PE.T('Businesses').filter(function (x) { return x.key === d.key; })[0] || {};
    closeQuick();
    if (t === 'lead') PE.change('lead', { id: PE.rid() + PE.rid().slice(0, 4), key: d.key, name: d.name, contact: d.contact, persona: d.persona, source: d.source, value: b.avg_price || '', created: PE.today() }, 'Lead added');
    else if (t === 'client') PE.change('client', { id: PE.rid() + PE.rid().slice(0, 4), key: d.key, name: d.name, value: d.value }, 'Client added');
    else PE.change('hist', { key: d.key, month: d.month, revenue: d.revenue }, 'Month added');
  });
  sheet.addEventListener('click', function (ev) { if (ev.target === sheet) closeQuick(); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && sheet.classList.contains('open')) closeQuick(); });

  // ------------------------------------------------------------ shell: nav, search, theme, install
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-ui]'); if (!b) return;
    var a = b.getAttribute('data-ui');
    if (a === 'quick') { if (PE.S.vault) openQuick(); }
    else if (a === 'close') closeQuick();
    else if (a === 'qt') fields(b.getAttribute('data-t'));
    else if (a === 'theme') setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true);
    else if (a === 'install') doInstall();
  });
  var sf = document.getElementById('searchForm');
  if (sf) sf.addEventListener('submit', function (ev) { ev.preventDefault(); var q = sf.q.value.trim(); if (q && PE.S.vault) location.hash = '#/search/' + encodeURIComponent(q); });
  function setTheme(t, save) {
    document.documentElement.setAttribute('data-theme', t);
    var tb = document.getElementById('themeBtn'); if (tb) tb.innerHTML = ico(t === 'dark' ? 'sun' : 'moon', 20);
    if (save) try { localStorage.setItem('pe_theme', t); } catch (e) {}
  }
  var saved = null; try { saved = localStorage.getItem('pe_theme'); } catch (e) {}
  setTheme(saved || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), false);
  var deferred = null, ib = document.getElementById('installBtn');
  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone;
  var ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (ib) { ib.innerHTML = ico('install', 18) + '<span>Install</span>'; ib.hidden = standalone || !ios; }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; if (ib && !standalone) ib.hidden = false; });
  window.addEventListener('appinstalled', function () { if (ib) ib.hidden = true; });
  function doInstall() {
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; }); return; }
    PE.S.msg = ios ? 'To install on iPhone: tap the Share button in Safari, then "Add to Home Screen".' : 'To install: open your browser menu and choose "Install app" or "Add to Home screen".';
    if (PE.S.vault) PE.render(); else alertBox(PE.S.msg);
  }
  function alertBox(m) { var a = document.getElementById('app'); a.insertAdjacentHTML('afterbegin', '<div class="msg">' + PE.esc(m) + '</div>'); }
  var navEl = document.getElementById('nav');
  if (navEl) navEl.innerHTML = [['dash', 'home', 'Home', '#/'], ['all', 'biz', 'Businesses', '#/all'], ['leads', 'leads', 'Leads', '#/leads'], ['listings', 'voice', 'Listings', '#/listings'], ['setup', 'gear', 'Setup', '#/setup'], ['sync', 'sync', 'Sync', '#/sync']]
    .map(function (x) { return '<a href="' + x[3] + '" data-nav="' + x[0] + '">' + ico(x[1], 22) + '<span>' + x[2] + '</span>' + (x[0] === 'dash' ? '<b class="badge" id="needBadge" hidden></b>' : '') + '</a>'; }).join('');
  var sicon = document.getElementById('searchIco'); if (sicon) sicon.innerHTML = ico('search', 18);
  var fab = document.getElementById('fab'); if (fab) fab.innerHTML = ico('plus', 26);

  window.PEUI = {
    views: { dash: dash, leads: leadsView, search: searchView },
    after: function (h) {
      var cur = h[0] || 'dash'; if (cur === 'biz') cur = 'all';
      Array.prototype.forEach.call(document.querySelectorAll('#nav a'), function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === cur); });
      document.body.classList.toggle('signed-in', !!PE.S.vault);
      var n = 0; plans().forEach(function (p) { n += p.issues.length; });
      var bd = document.getElementById('needBadge'); if (bd) { bd.textContent = n > 99 ? '99+' : n; bd.hidden = !n; }
    }
  };
  // keep the shell in step with sign-in / lock (the PIN screen is drawn by app.js)
  new MutationObserver(function () { document.body.classList.toggle('signed-in', !!(PE.S && PE.S.vault)); }).observe(document.getElementById('app'), { childList: true });
})();
