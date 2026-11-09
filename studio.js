/* Crispus Profit Engine — Creative Studio + lead reply agent (v1.7, Nov 9, 2026).
 * Built from the "AI Creative Studio" engineering spec, sized for a free, phone-first app:
 *  - Ad Studio: an agent team (Director, Copywriter, Storyboard, Compliance, your OK, Painter, Editor, Publisher)
 *    turns a brief into ad copy variations, AI-painted shots and a short video with an AI disclosure.
 *  - Talk to leads: drafts replies to your leads in each business's voice with the right greeting, sign-off
 *    and accessibility footer. Nothing is ever sent automatically: you edit, then open it in Messages or email.
 *  - Library: finished ads saved on this device.
 * AI text and pictures come from free services (Pollinations). They need internet and have wait limits.
 * Ads and drafts never include client records; your personal number is blocked. */
(function () {
  'use strict';
  if (!window.PE || !window.PEUI) return;
  var E = PE.esc;
  var BIZC = { TAX: '#b8862b', CARES: '#0f8a7e', HVAC: '#2f6fd0', MERCH: '#8a4fd0', CMCC: '#2e8b3d' };
  var PERSONAL = '2486906860';
  function dg(s) { return String(s || '').replace(/\D/g, '').replace(/^1(\d{10})$/, '$1'); }
  function $(id) { return document.getElementById(id); }
  function toast(m) { var t = $('stToast'); if (!t) { t = document.createElement('div'); t.id = 'stToast'; t.className = 'st-toast'; document.body.appendChild(t); } t.textContent = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2600); }
  function busy(id, txt) { var b = $(id); if (b) b.innerHTML = txt ? '<span class="st-spin"></span>' + E(txt) : ''; ST.busy[id] = txt || ''; }

  /* ---------------- per-business voice (from "Cyars Communication & Consent Standards") ---------------- */
  var ADA = 'Accessibility notice. Ciarne Cyars uses AI-assisted drafting as a disability accommodation (Americans with Disabilities Act, 42 U.S.C. § 12101 et seq.). She reviews every message before it is sent and remains fully responsible for its content. If anything here looks inaccurate or unclear, please reply in writing so it can be corrected in writing.';
  var VOICE = {
    TAX: { hi: 'Dear {full},', bye: 'Respectfully,\nCyars\nCrispus Mundo Tax', foot: ADA + '\n\nConfidential tax information. This message may contain tax return information protected under Internal Revenue Code § 7216. It is intended only for the addressee. If you received it in error, please notify the sender and delete it. This message is not a formal tax opinion unless it says so expressly.' },
    CARES: { hi: 'Hello {first},', bye: 'With care,\nCyars\nCrisp Cares', foot: ADA + '\n\nProtected health information. This message may contain health information protected under HIPAA (45 C.F.R. Parts 160 and 164). It is intended only for the addressee. If you received it in error, please notify the sender and delete it. Email is not fully secure; tell us if you prefer another way to receive health information.' },
    HVAC: { hi: 'Hi {first},', bye: 'Thank you,\nCrisp Cares Heating & Cooling', foot: 'Accessibility notice. This message was prepared with AI-assisted drafting, used by our owner as a disability accommodation (42 U.S.C. § 12101 et seq.), and reviewed before sending. If anything looks inaccurate, please reply in writing so we can correct it in writing. Prices and scope are final only in a signed estimate or work order.' },
    MERCH: { hi: 'Hello {first},', bye: 'Best regards,\nCyars\nCrisp Clean Merch', foot: 'Accessibility notice. Ciarne Cyars uses AI-assisted drafting as a disability accommodation (42 U.S.C. § 12101 et seq.). She reviews every message before it is sent and remains fully responsible for its content. If anything looks inaccurate, please reply in writing so it can be corrected in writing.\n\nWork product. Attachments and plans are Crisp Clean Merch work products, shared under your agreement with us and confidential to your business.' },
    CMCC: { hi: 'Dear {first},', bye: 'In service,\nCyars\nCMCC Training Institute', foot: 'Accessibility notice. Ciarne Cyars uses AI-assisted drafting as a disability accommodation (42 U.S.C. § 12101 et seq.). She reviews every message before it is sent and remains fully responsible for its content. If anything looks inaccurate, please reply in writing so it can be corrected in writing.' }
  };
  var TEXT_FOOT = 'Drafted with AI help as an ADA accommodation and reviewed by Cyars. Reply in writing with any corrections.';
  function biz(key) { return PE.T('Businesses').filter(function (b) { return b.key === key; })[0] || { key: key, name: key }; }
  function card(key) {
    var c = PE.T('Cards').filter(function (x) { return x.key === key; })[0] || {}, o = {};
    ['brand', 'tagline', 'phone', 'text_phone', 'email', 'website', 'services'].forEach(function (k) { o[k] = c[k] || ''; });
    if (dg(o.phone) === PERSONAL) o.phone = ''; if (dg(o.text_phone) === PERSONAL) o.text_phone = '';
    if (/@crispcleans\.com$/i.test(o.email)) o.email = ''; // domain lapsed: mail bounces
    return o;
  }
  function contactLine(key) { var c = card(key); return [c.phone || c.text_phone, c.website, c.email].filter(Boolean).join(' · '); }

  /* ---------------- free AI helpers with built-in waits ---------------- */
  var LASTT = 0, LASTP = 0;
  function think(messages, ok, sid, label, fail) {
    var wait = Math.max(0, 47000 - (Date.now() - LASTT)), t0 = Date.now();
    var tick = setInterval(function () { var left = Math.ceil((wait - (Date.now() - t0)) / 1000); busy(sid, label + (left > 1 ? ' (free AI ready in ' + left + 's)' : '')); }, 1000);
    busy(sid, label);
    setTimeout(function () {
      clearInterval(tick); busy(sid, label); LASTT = Date.now();
      if (!PE.online()) { busy(sid, ''); return fail && fail('offline'); }
      fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'openai', messages: messages }) })
        .then(function (r) { if (!r.ok) throw new Error('busy ' + r.status); return r.json(); })
        .then(function (j) { LASTT = Date.now(); busy(sid, ''); var c = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content; if (!c) throw new Error('empty'); ok(String(c)); })
        .catch(function (e) { busy(sid, ''); if (fail) fail(String((e && e.message) || e)); });
    }, wait);
  }
  function paint(prompt, w, h, ok, sid, label, fail) {
    var wait = Math.max(0, 16000 - (Date.now() - LASTP));
    busy(sid, label + (wait > 1500 ? ' (free painter needs ' + Math.ceil(wait / 1000) + 's between pictures)' : ''));
    setTimeout(function () {
      LASTP = Date.now();
      fetch('https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=' + w + '&height=' + h + '&nologo=true&seed=' + Math.floor(Math.random() * 1e6))
        .then(function (r) { if (!r.ok) throw new Error('The free painter is busy (' + r.status + ')'); return r.blob(); })
        .then(function (b) { if (!/^image/.test(b.type)) throw new Error('The free painter did not send a picture'); var fr = new FileReader(); fr.onload = function () { LASTP = Date.now(); busy(sid, ''); ok(fr.result); }; fr.readAsDataURL(b); })
        .catch(function (e) { busy(sid, ''); toast(String((e && e.message) || e)); if (fail) fail(); });
    }, wait);
  }
  function jsonFrom(txt) { try { var m = String(txt).match(/\{[\s\S]*\}/); return JSON.parse(m ? m[0] : txt); } catch (e) { return null; } }
  function clean(s, n) { return String(s == null ? '' : s).replace(/https?:\/\/\S+/g, '').replace(/[<>]/g, '').trim().slice(0, n || 400); }

  /* ---------------- on-device library (ads are marketing material, not client data) ---------------- */
  var DB = null;
  function db() { return DB || (DB = new Promise(function (res, rej) { var r = indexedDB.open('pe-studio', 1); r.onupgradeneeded = function () { r.result.createObjectStore('ads', { keyPath: 'id' }); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; })); }
  function libPut(o) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('ads', 'readwrite'); t.objectStore('ads').put(o); t.oncomplete = res; }); }); }
  function libAll() { return db().then(function (d) { return new Promise(function (res) { var q = d.transaction('ads').objectStore('ads').getAll(); q.onsuccess = function () { res(q.result || []); }; }); }); }
  function libDel(id) { return db().then(function (d) { return new Promise(function (res) { var t = d.transaction('ads', 'readwrite'); t.objectStore('ads').delete(id); t.oncomplete = res; }); }); }

  /* ---------------- state ---------------- */
  var ST = { tab: 'ads', busy: {}, ad: null, agents: {}, imgs: [], vid: null, lib: null, lead: null, draft: '', chan: 'text', purpose: 'first', bizF: 'ALL' };
  var SHAPES = { feed: ['Facebook / Instagram feed (1:1)', 1080, 1080], story: ['Reels, Stories, TikTok (9:16)', 1080, 1920], wide: ['YouTube / website (16:9)', 1920, 1080] };
  var TEAM = [['dir', 'Director'], ['copy', 'Copywriter'], ['board', 'Storyboard'], ['law', 'Compliance'], ['ok', 'Your OK'], ['paint', 'Painter'], ['edit', 'Editor'], ['pub', 'Publisher']];

  /* ---------------- compliance agent (rules run on this device, every time) ---------------- */
  var RULES = [
    [/\bguarantee(d|s)?\b|\b100\s?%|risk[-\s]?free|no[-\s]?risk/i, 'block', 'Remove guarantees ("guaranteed", "100%", "risk-free"). Results can\'t be promised.'],
    [/(biggest|maximum|max|largest)\s+refund|irs[-\s]?approved|irs[-\s]?certified/i, 'block', 'Tax ads can\'t promise refunds or claim IRS approval.'],
    [/\b(cure|cures|heal|heals|treat|treats)\b|fda/i, 'block', 'Home care ads can\'t make medical claims.'],
    [/(“|")[^"”]{6,}(”|")\s*[-—–]\s*[A-Z]|\b(5|five)[-\s]?star review|\bour (happy )?clients? (say|said)/i, 'block', 'No made-up reviews or quotes. Only use real reviews you have permission to share.'],
    [/\b(#1|number one|best in (michigan|detroit|town|the state))\b/i, 'warn', '"#1" or "best" needs proof you can show. Soften it or remove it.'],
    [/@crispcleans\.com/i, 'block', 'The @crispcleans.com email bounces right now. Use another email.']
  ];
  function check(text) {
    var out = []; text = String(text || '');
    if (text.replace(/\D/g, '').indexOf(PERSONAL) > -1) out.push(['block', 'Your personal number can\'t go in client-facing work.']);
    RULES.forEach(function (r) { if (r[0].test(text)) out.push([r[1], r[2]]); });
    return out;
  }

  /* ================= AD STUDIO ================= */
  function teamHtml() { return '<div class="st-team">' + TEAM.map(function (a) { var s = ST.agents[a[0]] || ''; return '<span class="' + s + '">' + a[1] + (s === 'ok' ? ' ✓' : s === 'run' ? ' …' : s === 'bad' ? ' !' : '') + '</span>'; }).join('') + '</div>'; }
  function setA(k, v) { ST.agents[k] = v; var t = document.querySelector('.st-team'); if (t) t.outerHTML = teamHtml(); }
  function adsTab() {
    var bs = PE.T('Businesses'), a = ST.ad;
    var form = '<section class="panel"><div class="ph"><h2>New ad</h2></div><form id="stBrief" class="st-form">' +
      '<label>Business<select name="key">' + bs.map(function (b) { return '<option value="' + E(b.key) + '"' + (a && a.key === b.key ? ' selected' : '') + '>' + E(b.name) + '</option>'; }).join('') + '</select></label>' +
      '<label>Where it will run<select name="shape">' + Object.keys(SHAPES).map(function (k) { return '<option value="' + k + '"' + (a && a.shape === k ? ' selected' : '') + '>' + SHAPES[k][0] + '</option>'; }).join('') + '</select></label>' +
      '<label>Goal<select name="goal"><option>Get new leads</option><option>Book calls or appointments</option><option>Bring back past clients</option><option>Announce something new</option></select></label>' +
      '<label>Who it\'s for<select name="persona"><option value="">Pick a persona (optional)</option></select></label>' +
      '<label>What to say (offer, season, details)<textarea name="brief" rows="3" placeholder="e.g. Tax season is open. Same-week appointments, virtual or in person.">' + E(a ? a.brief : '') + '</textarea></label>' +
      '<button class="btn gold wide">Plan my ad with the team</button></form><div id="stAdBusy" class="st-busy">' + E(ST.busy.stAdBusy || '') + '</div></section>';
    return teamHtml() + form + '<div id="stPlan">' + (a && a.plan ? planHtml() : '') + '</div>';
  }
  function personaOpts(key) {
    var sel = document.querySelector('#stBrief [name=persona]'); if (!sel) return;
    sel.innerHTML = '<option value="">Pick a persona (optional)</option>' + PE.T('Personas').filter(function (p) { return p.business === key; }).map(function (p) { return '<option value="' + E(p.persona) + '">' + E(p.persona) + '</option>'; }).join('');
  }
  function localAd(a) {
    var b = biz(a.key), c = card(a.key), name = c.brand || b.name, off = clean(a.brief, 140) || 'We are here to help.';
    var cta = { 'Get new leads': 'Message us today', 'Book calls or appointments': 'Book your spot', 'Bring back past clients': 'Welcome back — reply to book', 'Announce something new': 'Learn more' }[a.goal] || 'Contact us';
    return { writer: 'built-in writer', variations: [
      { hook: 'Need help? ' + name + ' has you covered.', caption: off + ' ' + (c.tagline || ''), cta: cta, tags: '#Michigan #SmallBusiness' },
      { hook: 'Save time this season with ' + name + '.', caption: off, cta: cta, tags: '#Southfield #WestBloomfield' },
      { hook: 'Local. Trusted. Ready when you are.', caption: off + ' Serving Southfield, West Bloomfield and nearby.', cta: cta, tags: '#OaklandCounty' }],
      shots: [{ scene: 'a bright, welcoming small-business office in Michigan', overlay: 'Local help you can trust' }, { scene: 'a friendly professional helping a customer at a table, fictional people', overlay: off.slice(0, 40) }, { scene: 'a calm, organized desk with a laptop and coffee, morning light', overlay: cta }] };
  }
  function planAd(form) {
    var a = { id: 'ad' + Date.now(), key: form.key.value, shape: form.shape.value, goal: form.goal.value, persona: form.persona.value, brief: clean(form.brief.value, 400), created: PE.today() };
    if (a.brief.length < 5) return toast('Tell the team what the ad should say.');
    var pre = check(a.brief).filter(function (x) { return x[0] === 'block'; }); if (pre.length) return toast(pre[0][1]);
    ST.ad = a; ST.imgs = []; ST.vid = null; ST.agents = {}; setA('dir', 'run');
    var b = biz(a.key), c = card(a.key), per = PE.T('Personas').filter(function (p) { return p.business === a.key && p.persona === a.persona; })[0];
    var sys = 'You are the in-house creative team (director, copywriter, storyboard artist) for a small Michigan business owner. Write honest, plain, warm ad copy. Never promise results, never use "guaranteed", never invent reviews, testimonials, statistics, prices or awards, never mention real people or competitors. Pictures must show fictional people or places only, with no text or logos. Reply with ONLY JSON.';
    var usr = 'Business: ' + (c.brand || b.name) + ' (' + a.key + ')' + (c.services ? '\nServices: ' + c.services.replace(/\|/g, ', ') : '') + (c.tagline ? '\nTagline: ' + c.tagline : '') +
      '\nGoal: ' + a.goal + '\nWhere: ' + SHAPES[a.shape][0] + (per ? '\nAudience: ' + per.persona + ' — ' + (per.who || '') + (per.offer ? '. Offer that works for them: ' + per.offer : '') : '') +
      '\nWhat to say: ' + a.brief + '\nJSON shape: {"variations":[{"hook":"max 8 words","caption":"2-3 short sentences","cta":"max 5 words","tags":"3 hashtags"}] (exactly 3), "shots":[{"scene":"picture to paint, fictional, no text","overlay":"max 6 words on screen"}] (exactly 3)}';
    think([{ role: 'system', content: sys }, { role: 'user', content: usr }], function (txt) {
      var p = jsonFrom(txt);
      if (!p || !p.variations || !p.shots) { p = localAd(a); setA('dir', 'bad'); toast('The AI answer was unclear, so the built-in writer made the plan.'); }
      else { p.writer = 'free AI team'; p.variations = p.variations.slice(0, 3).map(function (v) { return { hook: clean(v.hook, 80), caption: clean(v.caption, 400), cta: clean(v.cta, 40), tags: clean(v.tags, 80) }; }); p.shots = p.shots.slice(0, 4).map(function (s) { return { scene: clean(s.scene, 200), overlay: clean(s.overlay, 50) }; }); setA('dir', 'ok'); }
      finish(p);
    }, 'stAdBusy', 'Director and copywriter are planning…', function () { setA('dir', 'bad'); toast('Free AI is busy, so the built-in writer made the plan.'); finish(localAd(a)); });
    function finish(p) { a.plan = p; a.pick = 0; setA('copy', 'ok'); setA('board', 'ok'); review(); setA('ok', 'run'); var el = $('stPlan'); if (el) el.innerHTML = planHtml(); }
  }
  function review() { var a = ST.ad, all = []; a.plan.variations.forEach(function (v, i) { check([v.hook, v.caption, v.cta].join(' ')).forEach(function (x) { all.push([x[0], 'Version ' + (i + 1) + ': ' + x[1]]); }); }); a.plan.shots.forEach(function (s, i) { check(s.overlay).forEach(function (x) { all.push([x[0], 'Shot ' + (i + 1) + ': ' + x[1]]); }); }); a.issues = all; setA('law', all.some(function (x) { return x[0] === 'block'; }) ? 'bad' : 'ok'); }
  function planHtml() {
    var a = ST.ad, p = a.plan;
    var h = '<section class="panel"><div class="ph"><h2>Plan from the ' + E(p.writer) + '</h2></div>' +
      (a.issues && a.issues.length ? '<div class="msg ' + (a.issues.some(function (x) { return x[0] === 'block'; }) ? 'err' : '') + '"><b>Compliance check</b><ul>' + a.issues.map(function (x) { return '<li>' + E(x[1]) + '</li>'; }).join('') + '</ul></div>' : '<div class="msg ok">Compliance check passed: no guarantees, no made-up reviews, no personal number. An "AI-generated imagery" label will be added to the pictures.</div>') +
      '<p class="muted">Pick one version, edit anything, then approve.</p>' +
      p.variations.map(function (v, i) {
        return '<div class="st-var' + (a.pick === i ? ' on' : '') + '"><label class="st-radio"><input type="radio" name="stPick" value="' + i + '"' + (a.pick === i ? ' checked' : '') + '> Version ' + (i + 1) + '</label>' +
          '<label>Hook<input data-v="' + i + '" data-f="hook" value="' + E(v.hook) + '"></label><label>Caption<textarea rows="3" data-v="' + i + '" data-f="caption">' + E(v.caption) + '</textarea></label>' +
          '<div class="st-two"><label>Button words<input data-v="' + i + '" data-f="cta" value="' + E(v.cta) + '"></label><label>Hashtags<input data-v="' + i + '" data-f="tags" value="' + E(v.tags) + '"></label></div></div>';
      }).join('') +
      '<h3>Shots</h3>' + p.shots.map(function (s, i) {
        return '<div class="st-shot"><label>Shot ' + (i + 1) + ' picture<input data-s="' + i + '" data-f="scene" value="' + E(s.scene) + '"></label><label>Words on screen<input data-s="' + i + '" data-f="overlay" value="' + E(s.overlay) + '"></label>' +
          (ST.imgs[i] ? '<img src="' + ST.imgs[i] + '" alt="Shot ' + (i + 1) + '">' : '') + '<button class="light small" data-st="repaint" data-i="' + i + '">Paint this shot only</button></div>';
      }).join('') +
      '<p class="muted">Free tools, $0. Painting ' + p.shots.length + ' shots takes about ' + Math.ceil(p.shots.length * 25 / 60) + '–' + Math.ceil(p.shots.length * 45 / 60) + ' minutes. Keep this screen open.</p>' +
      '<button class="btn gold wide" data-st="approve">Approve and make the ad</button><div id="stPaintBusy" class="st-busy">' + E(ST.busy.stPaintBusy || '') + '</div></section><div id="stOut">' + (ST.editorReady ? editorHtml() : '') + '</div>';
    return h;
  }
  function shotPrompt(s) { return 'professional advertising photo, ' + s.scene + ', fictional people only, warm natural light, clean modern look, no text, no words, no logos, no watermark'; }
  function size() { var s = SHAPES[ST.ad.shape]; var k = 720 / Math.max(s[1], s[2]); return [Math.round(s[1] * k), Math.round(s[2] * k)]; }
  function repaint(i, done) { var s = ST.ad.plan.shots[i]; if (!s) return; var z = size(); setA('paint', 'run');
    paint(shotPrompt(s), z[0], z[1], function (u) { ST.imgs[i] = u; var el = $('stPlan'); if (el) el.innerHTML = planHtml(); if (done) done(true); else setA('paint', 'ok'); }, 'stPaintBusy', 'Painting shot ' + (i + 1) + '…', function () { if (done) done(false); else setA('paint', 'bad'); }); }
  function approve() {
    review(); if (ST.ad.issues.some(function (x) { return x[0] === 'block'; })) { var el = $('stPlan'); if (el) el.innerHTML = planHtml(); return toast('Fix the items marked by the compliance check first.'); }
    setA('ok', 'ok'); var todo = [], fails = 0; ST.ad.plan.shots.forEach(function (s, i) { if (!ST.imgs[i]) todo.push(i); });
    (function next() { if (!todo.length) { setA('paint', fails ? 'bad' : 'ok'); ST.editorReady = true; setA('edit', 'ok'); var o = $('stOut'); if (o) o.innerHTML = editorHtml(); preview(0); return; } repaint(todo.shift(), function (ok) { if (!ok) fails++; next(); }); })();
  }
  function editorHtml() { var z = size();
    return '<section class="panel"><div class="ph"><h2>Your ad</h2></div><canvas id="stCan" width="' + z[0] + '" height="' + z[1] + '" class="st-can"></canvas>' +
      '<div class="st-row"><button class="btn" data-st="play">Play</button><button class="btn gold" data-st="record">Save video</button><button class="btn light" data-st="still">Save picture</button></div>' +
      '<div id="stVid">' + (ST.vid ? vidHtml() : '') + '</div>' +
      '<div class="st-row"><button class="btn light" data-st="copycap">Copy caption</button><button class="btn light" data-st="save">Save to Library</button></div>' +
      '<p class="muted">Publisher: nothing is posted for you. Download the video or picture, copy the caption, and post it yourself when you are ready. Pictures carry an "AI-generated imagery" label.</p><div id="stEdBusy" class="st-busy"></div></section>'; }
  function vidHtml() { return '<video src="' + ST.vid.url + '" controls playsinline class="st-can"></video><a class="btn gold wide" download="' + E(ST.vid.name) + '" href="' + ST.vid.url + '">Download video (' + ST.vid.ext.toUpperCase() + ')</a>'; }
  var SHOT = 3.2, PLAYING = false, RAF = 0;
  function cover(x, im, W, H, t) { var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(W / iw, H / ih) * (1.04 + 0.06 * t), dw = iw * k, dh = ih * k; x.drawImage(im, (W - dw) / 2 - t * W * 0.02, (H - dh) / 2, dw, dh); }
  function wrapText(x, txt, cx, y, maxW, lh) { var w = String(txt || '').split(/\s+/), line = '', lines = []; w.forEach(function (s) { var t = line ? line + ' ' + s : s; if (x.measureText(t).width > maxW && line) { lines.push(line); line = s; } else line = t; }); if (line) lines.push(line); lines.forEach(function (l, i) { x.fillText(l, cx, y + i * lh); }); return lines.length; }
  var IMC = {};
  function img(u) { if (!IMC[u]) { var im = new Image(); im.src = u; IMC[u] = im; } return IMC[u]; }
  function frame(t) {
    var c = $('stCan'); if (!c) return; var x = c.getContext('2d'), W = c.width, H = c.height, a = ST.ad, v = a.plan.variations[a.pick || 0], n = a.plan.shots.length, col = BIZC[a.key] || '#14204A', cd = card(a.key), b = biz(a.key);
    var i = Math.floor(t / SHOT), lt = (t - i * SHOT) / SHOT, fs = Math.round(Math.min(W, H) / 16);
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    if (i < n) {
      var u = ST.imgs[i]; if (u && img(u).complete) cover(x, img(u), W, H, lt); else { var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, col); g.addColorStop(1, '#14204A'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
      var g2 = x.createLinearGradient(0, H * 0.45, 0, H); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,.72)'); x.fillStyle = g2; x.fillRect(0, H * 0.45, W, H * 0.55);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 ' + fs + 'px system-ui,sans-serif';
      var txt = i === 0 ? v.hook : a.plan.shots[i].overlay; x.globalAlpha = Math.min(1, lt * 4); wrapText(x, txt, W / 2, H * 0.78, W * 0.86, fs * 1.15); x.globalAlpha = 1;
      if (u) label(x, W, 'AI-generated imagery');
    } else {
      x.fillStyle = '#14204A'; x.fillRect(0, 0, W, H); x.fillStyle = col; x.fillRect(0, 0, W, H * 0.012); x.fillRect(0, H * 0.988, W, H * 0.012);
      x.fillStyle = '#C9A961'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 ' + Math.round(fs * 1.1) + 'px Georgia,serif'; wrapText(x, cd.brand || b.name, W / 2, H * 0.3, W * 0.86, fs * 1.2);
      x.fillStyle = '#fff'; x.font = '600 ' + Math.round(fs * 0.62) + 'px system-ui,sans-serif'; wrapText(x, cd.tagline || '', W / 2, H * 0.42, W * 0.8, fs * 0.8);
      x.fillStyle = '#C9A961'; var bw = W * 0.62, bh = fs * 1.5; x.beginPath(); if (x.roundRect) x.roundRect((W - bw) / 2, H * 0.55, bw, bh, bh / 2); else x.rect((W - bw) / 2, H * 0.55, bw, bh); x.fill();
      x.fillStyle = '#14204A'; x.font = '800 ' + Math.round(fs * 0.7) + 'px system-ui,sans-serif'; x.fillText(v.cta, W / 2, H * 0.55 + bh / 2);
      x.fillStyle = '#fff'; x.font = '600 ' + Math.round(fs * 0.55) + 'px system-ui,sans-serif'; wrapText(x, contactLine(a.key), W / 2, H * 0.74, W * 0.86, fs * 0.75);
      if (ST.imgs.some(Boolean)) label(x, W, 'AI-generated imagery');
    }
  }
  function label(x, W, t) { x.save(); var f = Math.max(11, Math.round(W / 50)); x.font = '600 ' + f + 'px system-ui,sans-serif'; var w = x.measureText(t).width + f; x.globalAlpha = 0.8; x.fillStyle = '#000'; x.fillRect(W - w - 8, 8, w, f * 1.7); x.globalAlpha = 1; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, W - w / 2 - 8, 8 + f * 0.85); x.restore(); }
  function total() { return (ST.ad.plan.shots.length + 1) * SHOT; }
  function preview(t) { frame(t); }
  function play(onEnd) { if (PLAYING) { PLAYING = false; cancelAnimationFrame(RAF); return; } PLAYING = true; var t0 = Date.now();
    (function loop() { if (!PLAYING) return; var t = (Date.now() - t0) / 1000; if (t > total()) { PLAYING = false; frame(total() - 0.01); if (onEnd) onEnd(); return; } frame(t); RAF = requestAnimationFrame(loop); })(); }
  function record() {
    var c = $('stCan'); if (!c || !c.captureStream || !window.MediaRecorder) return toast('This browser cannot record video. Try Chrome.');
    var types = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4'], mt = ''; for (var i = 0; i < types.length; i++) { try { if (MediaRecorder.isTypeSupported(types[i])) { mt = types[i]; break; } } catch (e) {} }
    var r; try { r = new MediaRecorder(c.captureStream(30), mt ? { mimeType: mt, videoBitsPerSecond: 5000000 } : {}); } catch (e) { return toast('Video recording is not available here.'); }
    var chunks = []; r.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    r.onstop = function () { busy('stEdBusy', ''); var type = (r.mimeType || 'video/webm').split(';')[0], ext = type.indexOf('mp4') > -1 ? 'mp4' : 'webm', blob = new Blob(chunks, { type: type });
      ST.vid = { url: URL.createObjectURL(blob), ext: ext, name: (ST.ad.key + '-ad-' + ST.ad.created).toLowerCase() + '.' + ext, blob: blob }; var el = $('stVid'); if (el) el.innerHTML = vidHtml(); setA('pub', 'ok'); };
    if (PLAYING) play(); r.start(250); busy('stEdBusy', 'Recording… keep this screen open'); play(function () { setTimeout(function () { r.stop(); }, 300); });
  }
  function still() { frame(SHOT * 0.9); var a = document.createElement('a'); a.href = $('stCan').toDataURL('image/png'); a.download = (ST.ad.key + '-ad-' + ST.ad.created).toLowerCase() + '.png'; document.body.appendChild(a); a.click(); a.remove(); }
  function captionText() { var v = ST.ad.plan.variations[ST.ad.pick || 0]; return [v.hook, '', v.caption, '', v.cta + (contactLine(ST.ad.key) ? ': ' + contactLine(ST.ad.key) : ''), '', v.tags, '', 'Images are AI-generated.'].join('\n').trim(); }
  function copy(t) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copied'); }, function () { window.prompt('Copy this:', t); }); }
  function saveAd() { frame(SHOT * 0.9); var a = ST.ad; libPut({ id: a.id, key: a.key, created: a.created, shape: a.shape, goal: a.goal, caption: captionText(), thumb: $('stCan').toDataURL('image/jpeg', 0.8), video: ST.vid ? ST.vid.blob : null, ext: ST.vid ? ST.vid.ext : '' }).then(function () { ST.lib = null; toast('Saved to Library on this device'); }); }

  /* ================= TALK TO LEADS (reply agent) ================= */
  var PURPOSE = { first: 'First reply to a new lead', follow: 'Friendly follow-up (they have not answered)', book: 'Ask to set up a call or appointment', back: 'Win back a past client' };
  function first(n) { return String(n || '').trim().split(/\s+/)[0] || 'there'; }
  function leadsTab() {
    var keys = ['ALL'].concat(PE.T('Businesses').map(function (b) { return b.key; }));
    var list = PE.T('Leads').filter(function (l) { return (ST.bizF === 'ALL' || l.business === ST.bizF) && ['won', 'lost'].indexOf(l.stage) < 0; }).sort(function (a, b) { return String(b.updated || b.created).localeCompare(String(a.updated || a.created)); });
    var l = ST.lead && PE.T('Leads').filter(function (x) { return x.id === ST.lead; })[0];
    var h = '<div class="filters">' + keys.map(function (k) { return '<a class="fchip' + (k === ST.bizF ? ' on' : '') + '" href="#/studio/leads" data-st="bizf" data-k="' + E(k) + '">' + E(k) + '</a>'; }).join('') + '</div>';
    if (!l) return h + '<p class="muted">Pick a lead. The reply agent drafts a message in that business\'s voice. You read it, change anything, and send it yourself. Nothing is sent automatically.</p>' +
      (list.length ? '<ul class="list cards">' + list.slice(0, 80).map(function (x) { return '<li class="lcard" style="--c:' + (BIZC[x.business] || '#5f6b7a') + '"><div class="lrow"><span class="bchip" style="--c:' + (BIZC[x.business] || '#5f6b7a') + '">' + E(x.business) + '</span><b>' + E(x.name) + '</b><span class="stage s-' + E(x.stage) + '">' + E(x.stage) + '</span></div><div class="muted">' + [x.source, x.created].filter(String).map(E).join(' · ') + '</div><button class="btn small" data-st="pick" data-id="' + E(x.id) + '">Draft a reply</button></li>'; }).join('') + '</ul>' : '<p class="muted">No open leads.</p>');
    var hasEmail = /@/.test(l.contact || ''), hasPhone = dg(l.contact).length >= 10;
    return h + '<section class="panel"><div class="ph"><h2>Reply to ' + E(l.name) + '</h2><button class="light small" data-st="unpick">Back</button></div>' +
      '<div class="muted">' + [l.business, l.contact, l.source, l.persona, l.stage].filter(String).map(E).join(' · ') + '</div>' +
      '<div class="st-two"><label>Send by<select id="stChan"><option value="text"' + (ST.chan === 'text' ? ' selected' : '') + '>Text message</option><option value="email"' + (ST.chan === 'email' ? ' selected' : '') + '>Email</option></select></label>' +
      '<label>Purpose<select id="stPur">' + Object.keys(PURPOSE).map(function (k) { return '<option value="' + k + '"' + (ST.purpose === k ? ' selected' : '') + '>' + PURPOSE[k] + '</option>'; }).join('') + '</select></label></div>' +
      '<label>Anything the agent should know (optional)<input id="stNote" placeholder="e.g. they asked about Saturday appointments"></label>' +
      '<button class="btn gold wide" data-st="draft">Draft it</button><div id="stLeadBusy" class="st-busy">' + E(ST.busy.stLeadBusy || '') + '</div>' +
      '<label>Message (edit anything)<textarea id="stDraft" rows="12">' + E(ST.draft) + '</textarea></label><div id="stDraftCheck"></div>' +
      '<div class="st-row">' + (hasPhone ? '<button class="btn" data-st="sms">Open in Messages</button>' : '') + (hasEmail ? '<button class="btn" data-st="mail">Open in email</button>' : '') + '<button class="btn light" data-st="copydraft">Copy</button></div>' +
      '<div class="st-row"><button class="btn light" data-st="contacted">Mark as contacted</button></div>' +
      '<p class="muted">You send it from your own phone or email. Figures, prices, tax or legal details stay out unless you add them yourself.' + (l.business === 'TAX' ? ' Tax rule: this reply is about tax prep only. Offering this person other services needs their separate § 7216 consent first.' : '') + (l.business === 'CARES' ? ' Home care rule: keep diagnoses, medications and care details out of texts.' : '') + '</p></section>';
  }
  function assemble(l, body) {
    var v = VOICE[l.business] || VOICE.MERCH, nm = String(l.name || '').trim(), hi = v.hi.replace('{full}', nm || 'there').replace('{first}', first(nm)), cl = contactLine(l.business);
    if (ST.chan === 'text') return 'Hi ' + first(nm) + '! ' + body + '\n\n— ' + v.bye.split('\n').slice(1).join(', ') + (cl ? '\n' + cl : '') + '\n\n' + TEXT_FOOT;
    return hi + '\n\n' + body + '\n\n' + v.bye + (cl ? '\n' + cl : '') + '\n\n———\n' + v.foot;
  }
  function localBody(l) { var b = card(l.business).brand || biz(l.business).name;
    return { first: 'Thank you for reaching out to ' + b + '. I would be glad to help. What is a good time for a quick call this week?', follow: 'I wanted to follow up on your request with ' + b + '. Are you still looking for help? I am happy to answer any questions.', book: 'Would you like to set up a short call or appointment? Reply with a day and time that works for you.', back: 'It has been a while, and we would love to help you again at ' + b + '. Is there anything we can do for you this season?' }[ST.purpose]; }
  function draft() {
    var l = PE.T('Leads').filter(function (x) { return x.id === ST.lead; })[0]; if (!l) return;
    ST.chan = $('stChan').value; ST.purpose = $('stPur').value; var note = clean(($('stNote') || {}).value, 200), b = biz(l.business), cd = card(l.business);
    var sys = 'You write short, warm, professional replies for a small business owner named Cyars to people who contacted her business. Write ONLY the body: no greeting line, no sign-off, no footer. ' + (ST.chan === 'text' ? 'Max 2 sentences, under 280 characters.' : '3-5 short sentences.') +
      ' Never quote prices, fees, refund amounts, deadlines, tax or legal advice, or health details. Never promise results. Never mention AI. End with one clear next step (a question or invitation).';
    var usr = 'Business: ' + (cd.brand || b.name) + ' (' + l.business + ')' + (cd.services ? '. Services: ' + cd.services.replace(/\|/g, ', ') : '') + '\nPurpose: ' + PURPOSE[ST.purpose] + '\nLead first name: ' + first(l.name) + '\nHow they found us: ' + (l.source || 'unknown') + (note ? '\nNote from Cyars: ' + note : '');
    think([{ role: 'system', content: sys }, { role: 'user', content: usr }], function (txt) {
      var body = clean(txt, ST.chan === 'text' ? 320 : 900).replace(/^(hi|hello|dear)[^,\n]*,\s*/i, ''); body = body.charAt(0).toUpperCase() + body.slice(1);
      ST.draft = assemble(l, body); paintDraft();
    }, 'stLeadBusy', 'Reply agent is writing…', function () { ST.draft = assemble(l, localBody(l)); paintDraft(); toast('Free AI is busy, so this is a ready-made reply. Edit as you like.'); });
  }
  function paintDraft() { var t = $('stDraft'); if (t) t.value = ST.draft; draftCheck(); }
  function draftCheck() { var t = $('stDraft'), box = $('stDraftCheck'); if (!t || !box) return; ST.draft = t.value; var is = check(t.value);
    box.innerHTML = is.length ? '<div class="msg ' + (is.some(function (x) { return x[0] === 'block'; }) ? 'err' : '') + '">' + is.map(function (x) { return E(x[1]); }).join('<br>') + '</div>' : ''; return is; }
  function sendVia(kind) {
    var l = PE.T('Leads').filter(function (x) { return x.id === ST.lead; })[0]; if (!l) return; var is = draftCheck();
    if (is.some(function (x) { return x[0] === 'block'; })) return toast('Fix the flagged items first.');
    if (!ST.draft.trim()) return toast('Draft a message first.');
    if (kind === 'sms') { var ph = dg(l.contact); location.href = 'sms:' + ph + (/iPhone|iPad/.test(navigator.userAgent) ? '&' : '?') + 'body=' + encodeURIComponent(ST.draft); }
    else { var em = (String(l.contact).match(/[^\s,;]+@[^\s,;]+/) || [''])[0], subj = (card(l.business).brand || biz(l.business).name) + ' — following up'; location.href = 'mailto:' + em + '?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(ST.draft); }
  }

  /* ================= LIBRARY ================= */
  function libTab() {
    if (!ST.lib) { libAll().then(function (l) { ST.lib = l.sort(function (a, b) { return String(b.id).localeCompare(String(a.id)); }); if (ST.tab === 'lib') PE.render(); }); return '<p class="muted">Loading…</p>'; }
    if (!ST.lib.length) return '<p class="muted">No saved ads yet. Make one in Ad Studio and tap Save to Library.</p>';
    return '<div class="st-lib">' + ST.lib.map(function (a) { return '<div class="st-libc"><img src="' + a.thumb + '" alt=""><div class="muted">' + E(a.key) + ' · ' + E(a.created) + ' · ' + E((SHAPES[a.shape] || [''])[0]) + '</div>' +
      '<div class="st-row"><button class="light small" data-st="libcap" data-id="' + E(a.id) + '">Copy caption</button>' + (a.video ? '<button class="light small" data-st="libvid" data-id="' + E(a.id) + '">Download video</button>' : '') + '<button class="light small" data-st="libdel" data-id="' + E(a.id) + '">Delete</button></div></div>'; }).join('') + '</div><p class="muted">Saved on this device only.</p>';
  }

  /* ================= view + events ================= */
  function view(args) {
    ST.tab = args[0] || ST.tab || 'ads';
    var tabs = [['ads', 'Ad Studio'], ['leads', 'Talk to leads'], ['lib', 'Library']];
    var body = ST.tab === 'leads' ? leadsTab() : ST.tab === 'lib' ? libTab() : adsTab();
    return '<section class="hero st-hero"><div><div class="eyebrow">Creative Studio · agent team</div><h1>Make ads and reply to leads</h1><div class="sub">' + (PE.online() ? 'Free AI ready' : 'Offline: the AI needs internet. Saved ads and your Library still work.') + '</div></div></section>' +
      '<div class="filters">' + tabs.map(function (t) { return '<a class="fchip' + (t[0] === ST.tab ? ' on' : '') + '" href="#/studio/' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</div>' + body;
  }
  PEUI.views.studio = view;
  var after0 = PEUI.after;
  PEUI.after = function (h) {
    if (after0) after0(h);
    if (h[0] !== 'studio') { PLAYING = false; return; }
    var f = $('stBrief'); if (f) { personaOpts(f.key.value); f.key.addEventListener('change', function () { personaOpts(f.key.value); }); }
    if (ST.editorReady && $('stCan')) frame(SHOT * 0.9);
    var d = $('stDraft'); if (d) { d.addEventListener('input', draftCheck); draftCheck(); }
  };
  document.addEventListener('submit', function (ev) { if (ev.target && ev.target.id === 'stBrief') { ev.preventDefault(); ST.editorReady = false; planAd(ev.target); } }, true);
  document.addEventListener('input', function (ev) {
    var t = ev.target; if (!ST.ad || !ST.ad.plan) return;
    if (t.hasAttribute('data-v')) { ST.ad.plan.variations[+t.getAttribute('data-v')][t.getAttribute('data-f')] = t.value; }
    else if (t.hasAttribute('data-s')) { ST.ad.plan.shots[+t.getAttribute('data-s')][t.getAttribute('data-f')] = t.value; }
  });
  document.addEventListener('change', function (ev) { var t = ev.target; if (t.name === 'stPick' && ST.ad) { ST.ad.pick = +t.value; Array.prototype.forEach.call(document.querySelectorAll('.st-var'), function (el, i) { el.classList.toggle('on', i === ST.ad.pick); }); if ($('stCan')) frame(SHOT * 0.9); } });
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-st]'); if (!b) return; var a = b.getAttribute('data-st');
    if (a === 'bizf') { ev.preventDefault(); ST.bizF = b.getAttribute('data-k'); ST.lead = null; PE.render(); }
    else if (a === 'pick') { ST.lead = b.getAttribute('data-id'); ST.draft = ''; PE.render(); }
    else if (a === 'unpick') { ST.lead = null; PE.render(); }
    else if (a === 'draft') draft();
    else if (a === 'sms' || a === 'mail') sendVia(a);
    else if (a === 'copydraft') { draftCheck(); copy(ST.draft); }
    else if (a === 'contacted') { var l = PE.T('Leads').filter(function (x) { return x.id === ST.lead; })[0]; if (l && l.stage === 'new') PE.change('stage', { id: l.id, stage: 'contacted' }, 'Moved ' + l.name + ' to contacted'); else toast('Already past "new"'); }
    else if (a === 'repaint') { review(); repaint(+b.getAttribute('data-i')); }
    else if (a === 'approve') approve();
    else if (a === 'play') play();
    else if (a === 'record') record();
    else if (a === 'still') still();
    else if (a === 'copycap') copy(captionText());
    else if (a === 'save') saveAd();
    else if (a === 'libcap' || a === 'libvid' || a === 'libdel') {
      var id = b.getAttribute('data-id'), it = (ST.lib || []).filter(function (x) { return x.id === id; })[0]; if (!it) return;
      if (a === 'libcap') copy(it.caption);
      else if (a === 'libvid') { var x = document.createElement('a'); x.href = URL.createObjectURL(it.video); x.download = (it.key + '-ad-' + it.created).toLowerCase() + '.' + (it.ext || 'webm'); document.body.appendChild(x); x.click(); x.remove(); }
      else libDel(id).then(function () { ST.lib = null; PE.render(); });
    }
  });

  /* nav entry + a dashboard shortcut */
  var nav = $('nav');
  if (nav && !nav.querySelector('[data-nav=studio]')) {
    var a = document.createElement('a'); a.href = '#/studio'; a.setAttribute('data-nav', 'studio');
    a.innerHTML = '<svg class="ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg><span>Studio</span>';
    var setup = nav.querySelector('[data-nav=setup]'); nav.insertBefore(a, setup || null);
  }
  var css = document.createElement('style');
  css.textContent = '.st-team{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 12px}.st-team span{border:1px solid var(--line);border-radius:999px;padding:5px 10px;font-size:12px;color:var(--muted);background:var(--panel)}' +
    '.st-team span.run{border-color:#C9A961;color:#9a7a2c;font-weight:700}.st-team span.ok{border-color:#2e8b3d;color:#2e8b3d}.st-team span.bad{border-color:#c0392b;color:#c0392b}' +
    '.st-form label,.st-var label,.st-shot label,.panel label{display:block;margin:8px 0}.st-form select,.st-form textarea,.st-var input,.st-var textarea,.st-shot input,.panel textarea,.panel select,.panel input{width:100%}' +
    '.st-var{border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin:10px 0}.st-var.on{border-color:#C9A961;box-shadow:0 0 0 2px #C9A96155}.st-radio{font-weight:700}' +
    '.st-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.st-shot{border:1px dashed var(--line);border-radius:12px;padding:8px 10px;margin:8px 0}.st-shot img{width:100%;max-width:360px;border-radius:10px;display:block;margin:6px 0}' +
    '.st-can{width:100%;max-width:460px;border-radius:14px;display:block;margin:8px auto;background:#000}.st-row{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.st-row .btn{flex:1}' +
    '.st-busy{min-height:18px;margin:6px 0;font-weight:600;color:#9a7a2c}.st-spin{display:inline-block;width:14px;height:14px;border:2px solid #C9A961;border-top-color:transparent;border-radius:50%;animation:stsp .8s linear infinite;vertical-align:-2px;margin-right:6px}@keyframes stsp{to{transform:rotate(360deg)}}' +
    '.st-lib{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}.st-libc{border:1px solid var(--line);border-radius:14px;padding:8px;background:var(--panel)}.st-libc img{width:100%;border-radius:10px}' +
    '.st-toast{position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#14204A;color:#fff;padding:10px 16px;border-radius:999px;font-size:14px;z-index:50;opacity:0;transition:.25s;pointer-events:none}.st-toast.show{opacity:.96}' +
    '.msg.ok{background:#e9f7ec;color:#1f6b2d;border-radius:12px;padding:10px 12px}';
  document.head.appendChild(css);
})();
