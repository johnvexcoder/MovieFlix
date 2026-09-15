/**
 * legacy-tv.js — MovieFlix Smart TV portal (ES5, dependency-free).
 *
 * Runs only in the standalone /legacy-tv.html page (see legacy-gate.js).
 * Talks to the existing MovieFlix JSON APIs over XHR; cookies ride along
 * same-origin so the exact same session/QR/profile security applies.
 *
 * Deliberately ES5: no arrow functions, no let/const/destructuring/spread,
 * no template literals, no fetch/Promise/Proxy. Keep it that way.
 */
(function () {
  'use strict';

  var DOC = document;
  var timers = [];

  /* ------------------------------------------------------------------ *
   *  Small utilities                                                     *
   * ------------------------------------------------------------------ */
  function $(id) { return DOC.getElementById(id); }

  function clear(node) { if (node) { node.innerHTML = ''; } return node; }

  function addClass(node, cls) {
    if (!node || !cls) return;
    var c = String(node.className || '');
    if (c.split(/\s+/).indexOf(cls) < 0) node.className = (c + ' ' + cls).replace(/^\s+/, '');
  }

  function removeClass(node, cls) {
    if (!node || !cls) return;
    var parts = String(node.className || '').split(/\s+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] && parts[i] !== cls) out.push(parts[i]);
    }
    node.className = out.join(' ');
  }

  function hasClass(node, cls) {
    if (!node) return false;
    return String(node.className || '').split(/\s+/).indexOf(cls) >= 0;
  }

  function make(tag, attrs, text) {
    var node = DOC.createElement(tag);
    if (attrs) {
      for (var key in attrs) {
        if (Object.prototype.hasOwnProperty.call(attrs, key)) {
          node.setAttribute(key, attrs[key]);
        }
      }
    }
    if (text !== undefined && text !== null) node.appendChild(DOC.createTextNode(String(text)));
    return node;
  }

  function bindClick(node, fn) {
    if (!node) return;
    node.onclick = function (e) { if (e && e.stopPropagation) e.stopPropagation(); fn(); };
  }

  function escapeHtml(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    function two(n) { return (n < 10 ? '0' : '') + n; }
    if (h > 0) return h + ':' + two(m) + ':' + two(s);
    return two(m) + ':' + two(s);
  }

  function posterUrl(item, mediaId) {
    var p = item && (item.posterUrl || item.backdropUrl);
    if (p) return p;
    return '/api/media/' + mediaId + '/image?kind=poster';
  }

  /* ------------------------------------------------------------------ *
   *  Capability report (used by ?diag=1)                                 *
   * ------------------------------------------------------------------ */
  function caps() {
    var out = {};
    out.ua = String(window.navigator.userAgent || '');
    var modEl = DOC.createElement('script');
    var moduleOk = false;
    try { modEl.setAttribute('type', 'module'); moduleOk = modEl.type === 'module'; } catch (e) { moduleOk = false; }
    out.modules = moduleOk || ('noModule' in DOC.createElement('script'));
    out.promise = typeof window.Promise === 'function';
    out.fetch = typeof window.fetch === 'function';
    out.xhr = typeof window.XMLHttpRequest === 'function';
    out.json = typeof window.JSON === 'object' && typeof window.JSON.parse === 'function';
    out.localStorage = (function () { try { return typeof window.localStorage !== 'undefined'; } catch (e) { return false; } })();
    out.qrcode = typeof window.qrcode === 'function';
    out.hlsNative = probePlayType('application/vnd.apple.mpegurl') || probePlayType('application/x-mpegURL');
    out.mp4 = probePlayType('video/mp4');
    out.h264 = probePlayType('video/mp4; codecs="avc1.42E01E"');
    out.h264High = probePlayType('video/mp4; codecs="avc1.64001F"');
    out.mse = typeof window.MediaSource === 'function';
    out.matchMedia = typeof window.matchMedia === 'function';
    out.cryptoUuid = typeof window.crypto === 'object' && typeof window.crypto.randomUUID === 'function';
    out.canvas = (function () {
      try {
        var c = DOC.createElement('canvas');
        return !!c && typeof c.getContext === 'function' && !!c.getContext('2d');
      } catch (e) { return false; }
    })();
    out.performance = typeof window.performance === 'object' && typeof window.performance.now === 'function';
    return out;
  }

  function probePlayType(mime) {
    try {
      var v = DOC.createElement('video');
      return typeof v.canPlayType === 'function' ? String(v.canPlayType(mime)) : '';
    } catch (e) { return ''; }
  }

  /* ------------------------------------------------------------------ *
   *  XHR JSON transport (with one refresh retry on a 401)                *
   * ------------------------------------------------------------------ */
  function http(opts, done) {
    var method = opts.method || 'GET';
    var url = opts.url;
    var body = opts.body || null;
    var retries = opts.retries || 0;

    var xhr = new XMLHttpRequest();
    try { xhr.withCredentials = true; } catch (e) { /* harmless */ }
    xhr.open(method, url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    if (body) xhr.setRequestHeader('Content-Type', 'application/json');

    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      var text = '';
      try { text = xhr.responseText || ''; } catch (e) { text = ''; }
      var data = null;
      if (text) {
        try { data = JSON.parse(text); } catch (e) { data = null; }
      }
      var res = { status: xhr.status, data: data, text: text, ok: xhr.status >= 200 && xhr.status < 300 };

      if (res.status === 401 && retries === 0 && opts.allowRefresh !== false) {
        http({ method: 'POST', url: '/api/auth/refresh', body: null, retries: 1, allowRefresh: false }, function (rr) {
          if (rr !== null && typeof rr === 'object' && rr.ok) {
            http(opts, done);
          } else {
            done(res);
          }
        });
        return;
      }
      done(res);
    };

    xhr.onerror = function () { done({ status: 0, data: null, text: '', ok: false }); };

    try {
      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) xhr.send(JSON.stringify(body));
      else xhr.send(null);
    } catch (e) {
      done({ status: 0, data: null, text: '', ok: false });
    }
  }

  /* ------------------------------------------------------------------ *
   *  App state + router                                                  *
   * ------------------------------------------------------------------ */
  var APP = {
    screen: 'boot',
    history: [],
    profile: null,
    qr: null,
    lastError: '',
    player: null
  };
  // Expose for diagnostics and programmatic tests (window.APP.*).
  window.APP = APP;

  function pushScreen(name, render, back) {
    APP.history.push({ name: name, back: back || null });
    APP.screen = name;
    render();
  }

  function popScreen() {
    var entry = APP.history.pop();
    if (entry && entry.back) { entry.back(); return; }
    if (APP.history.length > 0) {
      var prev = APP.history.pop();
      APP.screen = prev.name;
      if (prev.back) prev.back();
      else boot();
    } else {
      boot();
    }
  }
  // note: popScreen pops the entry for the screen we are leaving; the caller
  // re-pushes the previous screen's renderer. Simpler pattern used below:
  // back() is explicit per screen via pushScreen's back callback.

  function goBack() {
    var entry = APP.history.pop();
    if (entry && entry.back) { entry.back(); return; }
    if (APP.history.length > 0) {
      var prev = APP.history[APP.history.length - 1];
      // re-push the renderer for the previous screen
      var cb = prev.back;
      APP.history.pop();
      if (cb) cb();
      else boot();
    } else {
      boot();
    }
  }

  function stage() {
    return clear($('app'));
  }

  /* ------------------------------------------------------------------ *
   *  Navigation (grid of focusables)                                         *
   * ------------------------------------------------------------------ */
  var NAV = { rows: 0, cols: 1, ri: 0, ci: 0, grid: [], active: true };

  function setGrid(grid) {
    NAV.grid = grid || [];
    NAV.rows = NAV.grid.length;
    NAV.cols = 1;
    var r, c;
    for (r = 0; r < NAV.rows; r++) {
      if (NAV.grid[r] && NAV.grid[r].length > NAV.cols) NAV.cols = NAV.grid[r].length;
    }
    NAV.ri = 0;
    NAV.ci = 0;
    paintFocus();
  }

  function cur() {
    if (NAV.ri < 0 || NAV.ri >= NAV.rows) return null;
    var row = NAV.grid[NAV.ri] || [];
    if (NAV.ci < 0 || NAV.ci >= row.length) return null;
    return row[NAV.ci];
  }

  function paintFocus() {
    var r, c, row, cell;
    for (r = 0; r < NAV.rows; r++) {
      row = NAV.grid[r] || [];
      for (c = 0; c < row.length; c++) {
        cell = row[c];
        if (cell && cell.el) {
          if (r === NAV.ri && c === NAV.ci) addClass(cell.el, 'focused');
          else removeClass(cell.el, 'focused');
        }
      }
    }
    var focused = cur();
    if (focused && focused.el) {
      try { focused.el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); focused.el.scrollIntoView(); } catch (e) {
        try { focused.el.scrollIntoView(); } catch (e2) { /* ignore */ }
      }
    }
    // Lazy image loader: hydrate the row that just received focus.
    if (typeof NAV.hydrate === 'function') {
      try { NAV.hydrate(NAV.ri); } catch (e) { /* ignore */ }
    }
  }

  function navMove(dr, dc) {
    var row = NAV.grid[NAV.ri] || [];
    var nextRi = NAV.ri;
    var nextCi = NAV.ci;
    if (dc !== 0) {
      nextCi = NAV.ci + dc;
      if (nextCi < 0) {
        // wrap to previous row's last item, or stop
        if (NAV.ri > 0) { nextRi = NAV.ri - 1; nextCi = (NAV.grid[nextRi] || []).length - 1; }
        else nextCi = 0;
      } else if (nextCi >= row.length) {
        if (NAV.ri < NAV.rows - 1) { nextRi = NAV.ri + 1; nextCi = 0; }
        else nextCi = row.length - 1;
      }
    }
    if (dr !== 0) {
      nextRi = NAV.ri + dr;
      if (nextRi < 0) nextRi = 0;
      if (nextRi >= NAV.rows) nextRi = NAV.rows - 1;
      var nRow = NAV.grid[nextRi] || [];
      if (nextCi >= nRow.length) nextCi = nRow.length ? nRow.length - 1 : 0;
    }
    NAV.ri = nextRi;
    NAV.ci = nextCi;
    paintFocus();
  }

  function activate() {
    var cell = cur();
    if (cell && cell.action) cell.action();
  }

  function onKey(e) {
    var kc = e.keyCode || e.which || 0;
    var ae = DOC.activeElement;
    var activeTag = ae ? String(ae.tagName || '').toUpperCase() : '';
    if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

    var handled = true;
    if (kc === 37) navMove(0, -1);             // left
    else if (kc === 39) navMove(0, 1);         // right
    else if (kc === 38) navMove(-1, 0);        // up
    else if (kc === 40) navMove(1, 0);         // down
    else if (kc === 13 || kc === 108 || kc === 32) { if (kc === 32) e.preventDefault ? e.preventDefault() : (e.returnValue = false); activate(); }
    else if (kc === 8 || kc === 27) goBack();  // backspace / escape
    else handled = false;

    if (handled && e.preventDefault) e.preventDefault();
    if (handled && e.stopPropagation) e.stopPropagation();
  }

  try { window.addEventListener('keydown', onKey, false); } catch (e) { /* ignore */ }

  /* ------------------------------------------------------------------ *
   *  Boot / session check                                                *
   * ------------------------------------------------------------------ */
  function boot() {
    APP.screen = 'boot';
    var q = String(window.location.search || '');
    if (q.indexOf('diag=1') >= 0) { showDiag(); return; }
    http({ method: 'GET', url: '/api/auth/me' }, function (res) {
      if (res.ok && res.data && res.data.success && res.data.data) {
        APP.profile = res.data.data;
        showHome();
      } else {
        showLogin();
      }
    });
  }

  function banner(title, sub) {
    var box = make('div');
    var top = make('header');
    addClass(top, 'top');
    var brand = make('a', { class: 'brand', href: '/legacy-tv.html' }, 'MOVIEFLIX');
    var subEl = make('div', { class: 'sub' }, sub || 'Smart TV');
    top.appendChild(brand);
    top.appendChild(subEl);
    box.appendChild(top);
    return box;
  }

  /* ------------------------------------------------------------------ *
   *  Login (QR)                                                         *
   * ------------------------------------------------------------------ */
  function showLogin() {
    var view = stage();
    APP.history = [];
    APP.screen = 'login';
    APP.qr = null;
    var gen = 0;

    var box = banner('MOVIEFLIX', 'Sign in with the MovieFlix app on your phone');
    var panel = make('div');
    addClass(panel, 'panel login-panel');
    var root = make('div'); // contains qr + code + status + refresh button
    panel.appendChild(root);
    box.appendChild(panel);
    view.appendChild(box);

    function buildQr(qr) {
      clear(root);
      var title = make('h1', {}, 'Sign in to your TV');
      root.appendChild(title);
      root.appendChild(make('p', { class: 'hint' }, 'Open the MovieFlix website on your phone and scan this code, or visit the sign-in page and enter the code below.'));
      var qrBox = make('div');
      addClass(qrBox, 'qrbox');
      try {
        var q = window.qrcode(0, 'M');
        q.addData(qr.qrUrl || '');
        q.make();
        var table = q.createTableTag(4, 10);
        if (typeof table === 'string') {
          // createTableTag returns an HTML string in most builds
          var holder = make('div');
          var d = DOC.createElement('div');
          d.innerHTML = table;
          holder.appendChild(d.firstChild ? d.childNodes[0] : d);
          qrBox.appendChild(holder);
        } else if (typeof table === 'object' && table.nodeType) {
          qrBox.appendChild(table);
        }
      } catch (e) {
        APP.lastError = 'QR render failed: ' + String(e && e.message || e);
        qrBox.appendChild(make('div', { class: 'err' }, 'QR could not render on this device.'));
      }
      root.appendChild(qrBox);
      root.appendChild(make('div', { class: 'code' }, qr.code));
      var count = make('div', { class: 'count' }, '');
      root.appendChild(count);
      root.appendChild(make('div', { class: 'status' }, ''));
      var refresh = make('button', { class: 'btn ghost' }, 'Generate New Code');
      root.appendChild(refresh);
      bindClick(refresh, startQr);

      /* Classic username/password login — works on any old TV engine, no
       * phone required. Lives on the same sign-in panel as the QR code. */
      var divider = make('div', { class: 'divider' }, 'OR');
      root.appendChild(divider);
      var formWrap = make('div');
      addClass(formWrap, 'loginform');
      root.appendChild(formWrap);
      formWrap.appendChild(make('p', { class: 'hint' }, 'Sign in with your username and password:'));
      var fname = DOC.createElement('input');
      fname.type = 'text';
      fname.className = 'tvin';
      fname.placeholder = 'Username or email';
      fname.setAttribute('autocomplete', 'username');
      var fpass = DOC.createElement('input');
      fpass.type = 'password';
      fpass.className = 'tvin';
      fpass.placeholder = 'Password';
      fpass.setAttribute('autocomplete', 'current-password');
      var formStatus = make('div', { class: 'status' }, '');
      var signin = make('button', { class: 'btn' }, 'Sign In');
      formWrap.appendChild(fname);
      formWrap.appendChild(fpass);
      formWrap.appendChild(formStatus);
      formWrap.appendChild(signin);
      var formStatusEl = formStatus;
      function submitLogin() {
        var u = String(fname.value || '').trim();
        var p = String(fpass.value || '');
        if (!u || !p) {
          formStatusEl.textContent = 'Enter your username and password.';
          formStatusEl.className = 'status err';
          return;
        }
        formStatusEl.textContent = 'Signing in\u2026';
        formStatusEl.className = 'status';
        http({ method: 'POST', url: '/api/auth/account-login', body: { username: u, password: p }, allowRefresh: true }, function (res) {
          if (res.ok && res.data && res.data.success) {
            var d = res.data.data || {};
            if (d.requiresPayment) { showPayment(); return; }
            showProfiles();
            return;
          }
          formStatusEl.textContent = (res.data && res.data.error) || 'Sign-in failed. Try again.';
          formStatusEl.className = 'status err';
        });
      }
      bindClick(signin, submitLogin);
      fname.addEventListener('keydown', function (e) {
        if (e.keyCode === 13 || e.keyCode === 108) submitLogin();
      });
      fpass.addEventListener('keydown', function (e) {
        if (e.keyCode === 13 || e.keyCode === 108) submitLogin();
      });
      setGrid([
        [{ el: refresh, action: startQr }],
        [{ el: fname, action: function () { try { fname.focus(); } catch (e) { /* ignore */ } } }],
        [{ el: fpass, action: function () { try { fpass.focus(); } catch (e) { /* ignore */ } } }],
        [{ el: signin, action: submitLogin }]
      ]);

      var myGen = gen;
      var startedAt = Date.now();
      var countdown = window.setInterval(function () {
        if (myGen !== gen) { window.clearInterval(countdown); return; }
        var remain = qr.expiresIn - Math.floor((Date.now() - startedAt) / 1000);
        if (remain < 0) remain = 0;
        count.textContent = 'Code expires in ' + formatTime(remain);
        if (remain <= 0) { window.clearInterval(countdown); expired(); }
      }, 1000);
      timers.push(countdown);

      // status poll
      var done = false;
      function stopPoll() { if (done) return; done = true; window.clearInterval(poll); window.clearInterval(countdown); }
      function expired() {
        stopPoll();
        setStatus('Code expired — getting a new one\u2026', '');
        startQr();
      }
      function setStatus(text, cls) {
        var st = root.querySelector('.status');
        if (!st) return;
        st.textContent = text;
        st.className = 'status' + (cls ? ' ' + cls : '');
      }
      var poll = window.setInterval(function () {
        if (myGen !== gen) { window.clearInterval(poll); return; }
        http({ method: 'GET', url: '/api/auth/tv/status?code=' + encodeURIComponent(qr.code), allowRefresh: false }, function (res) {
          if (done || myGen !== gen || !res.ok || !res.data || !res.data.success) return;
          var st = res.data.data && res.data.data.status;
          if (st === 'approved') {
            stopPoll();
            setStatus('Approved — signing you in\u2026', 'ok');
            claim(qr.code, res.data.data.claimToken);
          } else if (st === 'expired') {
            expired();
          }
        });
      }, 3000);
      timers.push(poll);
    }

    function claim(code, token) {
      http({ method: 'POST', url: '/api/auth/tv/claim', body: { code: code, claimToken: token } }, function (res) {
        if (res.ok && res.data && res.data.success) {
          showProfiles();
        } else {
          setStatus((res.data && res.data.error) || 'Sign-in failed. Try again.', 'err');
          startQr();
        }
      });
    }

    function startQr() {
      gen++;
      for (var i = 0; i < timers.length; i++) { window.clearInterval(timers[i]); }
      timers.length = 0;
      clear(root);
      root.appendChild(make('div', { class: 'status' }, 'Getting a code\u2026'));
      http({ method: 'POST', url: '/api/auth/tv/qr', body: {}, allowRefresh: false }, function (res) {
        if (res.ok && res.data && res.data.success && res.data.data) {
          APP.qr = res.data.data;
          buildQr(APP.qr);
        } else {
          clear(root);
          root.appendChild(make('h1', {}, 'Could not reach the server'));
          root.appendChild(make('p', { class: 'hint' }, 'Check that this TV can reach the MovieFlix server, then try again.'));
          var retry = make('button', { class: 'btn' }, 'Try Again');
          root.appendChild(retry);
          bindClick(retry, showLogin);
        }
      });
    }

    startQr();
  }

  /* ------------------------------------------------------------------ *
   *  Profiles                                                           *
   * ------------------------------------------------------------------ */
  function showProfiles() {
    var view = stage();
    APP.history = [];
    APP.screen = 'profiles';
    var box = banner('MOVIEFLIX', 'Who\u2019s watching?');
    addClass(box, 'profiles-view');
    view.appendChild(box);
    box.appendChild(make('div', { class: 'status ' }, 'Loading profiles\u2026'));

    http({ method: 'GET', url: '/api/account/profiles' }, function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        clear(box);
        box.appendChild(make('div', { class: 'err' }, 'Could not load profiles. Try again.'));
        var b = make('button', { class: 'btn' }, 'Back to Sign In');
        box.appendChild(b);
        bindClick(b, showLogin);
        return;
      }
      var profiles = res.data.data.profiles || [];
      if (profiles.length === 0) {
        clear(box);
        box.appendChild(make('div', { class: 'err' }, 'No profiles on this account.'));
        var signOut = make('button', { class: 'btn' }, 'Sign Out');
        box.appendChild(signOut);
        bindClick(signOut, doSignout);
        return;
      }

      clear(box);
      box.appendChild(make('div', { class: 'status' }, 'Choose a profile to continue.'));
      var grid = [];
      var rowItems = [];
      for (var i = 0; i < profiles.length; i++) {
        (function (prof) {
          var tile = make('div', { class: 'tile' });
          var post = make('div', { class: 'poster' });
          var letter = make('div', {
            style: 'width:190px;height:285px;display:table;text-align:center;background:#0d2a3d;'
          });
          letter.innerHTML = '<div style="display:table-cell;vertical-align:middle;font-size:120px;font-weight:900;color:#04dcff;">' +
            escapeHtml(String((prof.name || '?').charAt(0)).toUpperCase()) + '</div>';
          post.appendChild(letter);
          tile.appendChild(post);
          var nm = make('span', { class: 'name' }, prof.name + (prof.isMainProfile ? '  \u00b7 main' : ''));
          tile.appendChild(nm);
          if (prof.hasPin) nm.appendChild(make('span', { style: 'color:#fbbf24;float:right;', }, '\uD83D\uDD12'));
          var tileAction = function () {
            if (prof.hasPin) showPin(prof);
            else profileLogin(prof, null);
          };
          bindClick(tile, tileAction);
          box.appendChild(tile);
          rowItems.push({ el: tile, action: null, tap: tileAction });
        })(profiles[i]);
      }
      grid.push(rowItems.map(function (t) { return { el: t.el, action: t.tap }; }));
      var utilRow = [];
      var manageBtn = make('button', { class: 'btn ghost' }, 'Manage Profiles');
      bindClick(manageBtn, showManageProfiles);
      box.appendChild(manageBtn);
      utilRow.push({ el: manageBtn, action: function () { showManageProfiles(); } });
      var signoutRow = [];
      var so = make('button', { class: 'btn ghost' }, 'Sign Out');
      bindClick(so, doSignout);
      box.appendChild(so);
      signoutRow.push({ el: so, action: function () { doSignout(); } });
      grid.push(utilRow, signoutRow);

      setGrid(grid);
      box.appendChild(make('div', { class: 'try' }, 'Use the arrow keys to choose and press OK.'));
    });
  }

  function doSignout() {
    http({ method: 'POST', url: '/api/auth/logout', body: null }, function () {
      showLogin();
    });
  }

  /* ------------------------------------------------------------------ *
   *  Payment & plans                                                    *
   * ------------------------------------------------------------------ */
  var payGen = 0;

  function fmtMoney(minor) {
    var v = Math.max(0, Number(minor || 0) / 100);
    return 'PHP ' + v.toFixed(2);
  }
  function fmtPlanTag(plan) {
    return plan.isLifetime ? 'Lifetime access' : (plan.durationHours + ' hours');
  }

  function showPayment() {
    var view = stage();
    APP.screen = 'payment';
    var box = banner('MOVIEFLIX', 'Payment & Plans');
    view.appendChild(box);
    var root = make('div');
    addClass(root, 'panel');
    box.appendChild(root);
    var gen = ++payGen;

    function clearTimers() {
      for (var i = 0; i < timers.length; i++) { window.clearInterval(timers[i]); }
      timers.length = 0;
    }

    function setStatus(text, cls) {
      var st = root.querySelector('.status');
      if (!st) return;
      st.textContent = text;
      st.className = 'status' + (cls ? ' ' + cls : '');
    }

    function goBack() { clearTimers(); gen++; showProfiles(); }

    function drawLoading(msg) {
      clearTimers();
      clear(root);
      root.appendChild(make('h1', {}, msg || 'Loading\u2026'));
    }

    function drawError(msg) {
      clearTimers();
      clear(root);
      root.appendChild(make('h1', {}, 'Payment unavailable'));
      root.appendChild(make('p', { class: 'hint' }, String(msg || 'Try again later.')));
      var retry = make('button', { class: 'btn' }, 'Try Again');
      bindClick(retry, showPayment);
      var back = make('button', { class: 'btn ghost' }, '\u2190 Back to Profiles');
      bindClick(back, goBack);
      root.appendChild(retry);
      root.appendChild(back);
      setGrid([
        [{ el: retry, action: showPayment }],
        [{ el: back, action: goBack }]
      ]);
    }

    function drawPlans() {
      clearTimers();
      clear(root);
      root.appendChild(make('h1', {}, 'Choose a plan'));
      root.appendChild(make('p', { class: 'hint' }, 'Select a plan, then pay with GCash or Maya by scanning the QR code on your phone.'));
      var statusNote = make('div', { class: 'status' }, 'Checking your membership\u2026');
      root.appendChild(statusNote);
      var backBtn = make('button', { class: 'btn ghost' }, '\u2190 Back to Profiles');
      root.appendChild(backBtn);
      bindClick(backBtn, goBack);
      http({ method: 'GET', url: '/api/billing/orders', allowRefresh: true }, function (res) {
        if (gen !== payGen) return;
        if (res.ok && res.data && res.data.data && Array.isArray(res.data.data.orders)) {
          var active = null;
          var all = res.data.data.orders;
          for (var i = 0; i < all.length; i++) {
            if (all[i].status === 'PAID') active = all[i];
          }
          if (active && active.entitlementEnd) {
            statusNote.textContent = 'Your membership is active until ' + String(active.entitlementEnd).slice(0, 10) + '.';
            statusNote.className = 'status payok';
          } else {
            statusNote.textContent = 'You do not have an active plan yet.';
          }
        } else {
          statusNote.textContent = '';
        }
      });
      var grid = [];
      var planRow = [];
      for (var i = 0; i < plans.length; i++) {
        (function (plan) {
          var off = plan.percentOff > 0 ? ' \u2014 ' + plan.percentOff + '% off!' : '';
          var opt = make('button', { class: 'opt prow' }, plan.name);
          opt.appendChild(make('span', { class: 'tag' }, fmtPlanTag(plan) + off));
          opt.appendChild(make('span', { class: 'price' }, 'PHP ' + Number(plan.finalPrice || 0).toFixed(2)));
          bindClick(opt, function () { showConfirm(plan); });
          root.appendChild(opt);
          planRow.push({ el: opt, action: function () { showConfirm(plan); } });
        })(plans[i]);
      }
      grid.push(planRow);
      grid.push([{ el: backBtn, action: goBack }]);
      setGrid(grid);
    }

    function showConfirm(plan) {
      clearTimers();
      clear(root);
      root.appendChild(make('h1', {}, 'Confirm payment'));
      root.appendChild(make('p', { class: 'hint' }, 'Review your plan, then continue.'));
      var statusNote = make('div', { class: 'status' }, 'Calculating price\u2026');
      root.appendChild(statusNote);
      var payBtn = make('button', { class: 'btn' }, 'Pay Now');
      var backBtn = make('button', { class: 'btn ghost' }, '\u2190 Choose another plan');
      bindClick(backBtn, function () { drawPlans(); });
      bindClick(payBtn, function () { createOrderNow(plan); });
      root.appendChild(payBtn);
      root.appendChild(backBtn);
      setGrid([
        [{ el: payBtn, action: function () { createOrderNow(plan); } }],
        [{ el: backBtn, action: function () { drawPlans(); } }]
      ]);
      http({ method: 'POST', url: '/api/billing/quote', body: { planId: plan.id }, allowRefresh: true }, function (res) {
        if (gen !== payGen) return;
        if (!res.ok || !res.data || !res.data.success) {
          statusNote.textContent = (res.data && res.data.error) || 'Could not calculate price.';
          statusNote.className = 'status err';
          return;
        }
        var q = res.data.data || {};
        statusNote.innerHTML = '';
        statusNote.textContent = '';
        root.insertBefore(make('div', { class: 'meta' },
          plan.name + ' \u2014 ' + fmtPlanTag(plan) + '\nPrice: ' + fmtMoney(q.finalAmountMinor) +
          (q.discountAmountMinor > 0 ? '  (discount applied)' : '')), payBtn);
      });
    }

    function createOrderNow(plan) {
      clearTimers();
      // Swap in a FRESH status element. The earlier quote/confirm callbacks
      // keep a reference to the old one, so a late quote response arriving
      // after this payment POST cannot overwrite the payment status.
      var old = root.querySelector('.status');
      var statusNote = make('div', { class: 'status' }, 'Creating payment\u2026');
      if (old) root.replaceChild(statusNote, old);
      else root.appendChild(statusNote);
      statusNote.textContent = 'Creating payment\u2026';
      statusNote.className = 'status';
      http({ method: 'POST', url: '/api/billing/orders', body: { planId: plan.id }, allowRefresh: true }, function (res) {
        if (gen !== payGen) return;
        if (!res.ok || !res.data || !res.data.success) {
          statusNote.textContent = (res.data && res.data.error) || 'Payment could not be created.';
          statusNote.className = 'status err';
          return;
        }
        var d = res.data.data || {};
        if (d.status === 'PAID') { drawSuccess(d); return; }
        if (d.qrImage) { drawQrPayment(d); return; }
        statusNote.textContent = 'Payment is ' + String(d.status || 'pending') + ' \u2014 try again in a moment.';
      });
    }

    function drawQrPayment(order) {
      clearTimers();
      clear(root);
      root.appendChild(make('h1', {}, 'Scan to pay'));
      root.appendChild(make('p', { class: 'hint' }, 'Open GCash or Maya on your phone and scan the QR code. Keep this window open.' + (order.amountMinor ? '\nAmount: ' + fmtMoney(order.amountMinor) : '')));
      var card = make('div', { class: 'paycard' });
      var img = DOC.createElement('img');
      img.src = String(order.qrImage || '');
      img.alt = 'Payment QR code';
      card.appendChild(img);
      root.appendChild(card);
      var statusNote = make('div', { class: 'status' }, 'Waiting for payment\u2026');
      root.appendChild(statusNote);
      var backBtn = make('button', { class: 'btn ghost' }, '\u2190 Back to Profiles');
      bindClick(backBtn, goBack);
      root.appendChild(backBtn);
      setGrid([[{ el: backBtn, action: goBack }]]);
      var attempts = 0;
      var timer = window.setInterval(function () {
        if (gen !== payGen) { window.clearInterval(timer); return; }
        attempts++;
        if (attempts > 90) {
          window.clearInterval(timer);
          statusNote.textContent = 'Still waiting. Re-check with your payment app.';
          return;
        }
        http({ method: 'GET', url: '/api/billing/orders/' + encodeURIComponent(order.id), allowRefresh: true }, function (res) {
          if (gen !== payGen) { window.clearInterval(timer); return; }
          if (!res.ok || !res.data || !res.data.success) return;
          var o = res.data.data.order || {};
          if (o.status === 'PAID') { window.clearInterval(timer); drawSuccess(o); return; }
          if (o.status === 'FAILED' || o.status === 'EXPIRED' || o.status === 'CANCELLED') {
            window.clearInterval(timer);
            statusNote.textContent = 'Payment ' + o.status.toLowerCase() + '. You can try again from the start.';
            statusNote.className = 'status err';
            var again = make('button', { class: 'btn' }, 'Try Again');
            bindClick(again, showPayment);
            root.appendChild(again);
            setGrid([
              [{ el: again, action: showPayment }],
              [{ el: backBtn, action: goBack }]
            ]);
            return;
          }
          statusNote.textContent = 'Waiting for payment\u2026';
        });
      }, 4000);
      timers.push(timer);
    }

    function drawSuccess(order) {
      clearTimers();
      clear(root);
      root.appendChild(make('h1', {}, 'Payment confirmed \u2713'));
      root.appendChild(make('p', { class: 'hint' }, order.planName ? order.planName + ' is now active on your account.' : 'Your membership is now active.'));
      var cont = make('button', { class: 'btn' }, 'Continue to Profiles');
      bindClick(cont, goBack);
      root.appendChild(cont);
      setGrid([[{ el: cont, action: goBack }]]);
    }

    function loadPlans() {
      drawLoading('Loading plans\u2026');
      http({ method: 'GET', url: '/api/plans', allowRefresh: true }, function (res) {
        if (gen !== payGen) return;
        if (!res.ok || !res.data || !res.data.success) {
          drawError((res.data && res.data.error) || 'Could not load plans.');
          return;
        }
        plans = res.data.data.plans || [];
        if (!plans || !plans.length) {
          drawError('No plans are available right now.');
          return;
        }
        drawPlans();
      });
    }

    var plans = [];
    loadPlans();
  }

  /* ------------------------------------------------------------------ *
   *  Account settings: Payment, Report a Problem, Feedback              *
   * ------------------------------------------------------------------ */
  function showSettings() {
    var view = stage();
    APP.screen = 'settings';
    var box = banner('MOVIEFLIX', 'Account');
    view.appendChild(box);
    var panel = make('div');
    addClass(panel, 'panel');
    box.appendChild(panel);
    panel.appendChild(make('p', { class: 'hint' }, 'Manage your plan, report a problem, or share feedback.'));
    var backBtn = make('button', { class: 'btn ghost' }, '\u2190 Back to Home');
    bindClick(backBtn, showHome);
    panel.appendChild(backBtn);

    function row(label, action) {
      var b = make('button', { class: 'opt' }, label);
      bindClick(b, action);
      panel.appendChild(b);
      return { el: b, action: action };
    }
    setGrid([
      [row('Payment / Plans', showPayment)],
      [row('Report a Problem', function () { showContact('report'); })],
      [row('Give Feedback', function () { showContact('feedback'); })],
      [{ el: backBtn, action: showHome }]
    ]);
  }

  function showContact(type) {
    var isReport = type === 'report';
    var view = stage();
    APP.screen = 'contact';
    var box = banner('MOVIEFLIX', isReport ? 'Report a Problem' : 'Give Feedback');
    view.appendChild(box);
    var root = make('div');
    addClass(root, 'panel');
    box.appendChild(root);
    root.appendChild(make('p', { class: 'hint' },
      isReport
        ? 'Something not working? Describe what happened and we will look into it.'
        : 'Tell us what you love, what could be better, and what you would like to see next.'));

    var subj = DOC.createElement('input');
    subj.type = 'text';
    subj.className = 'tvin';
    subj.placeholder = isReport ? 'Subject (optional)' : 'Subject (optional)';
    var msg = DOC.createElement('textarea');
    msg.className = 'tvin textarea';
    msg.placeholder = isReport ? 'What happened, what were you doing\u2026' : 'Share your feedback\u2026';
    var status = make('div', { class: 'status' }, '');
    var submit = make('button', { class: 'btn' }, isReport ? 'Submit Report' : 'Send Feedback');
    var backBtn = make('button', { class: 'btn ghost' }, '\u2190 Back to Settings');
    bindClick(backBtn, showSettings);
    bindClick(submit, send);

    root.appendChild(subj);
    root.appendChild(msg);
    root.appendChild(status);
    root.appendChild(submit);
    root.appendChild(backBtn);
    setGrid([
      [{ el: subj, action: function () { try { subj.focus(); } catch (e) { /* ignore */ } } }],
      [{ el: msg, action: function () { try { msg.focus(); } catch (e) { /* ignore */ } } }],
      [{ el: submit, action: send }, { el: backBtn, action: showSettings }]
    ]);

    function send() {
      var subject = String(subj.value || '').trim();
      var message = String(msg.value || '').trim();
      if (message.length < 3) {
        status.textContent = 'Please describe your ' + (isReport ? 'problem' : 'feedback') + ' (at least 3 characters).';
        status.className = 'status err';
        return;
      }
      status.textContent = 'Submitting\u2026';
      status.className = 'status';
      http({ method: 'POST', url: '/api/contact', body: { type: type, subject: subject, message: message }, allowRefresh: true }, function (res) {
        if (res.ok && res.data && res.data.success) {
          status.textContent = 'Thank you! Your ' + (isReport ? 'report' : 'feedback') + ' has been received.';
          status.className = 'status payok';
          subj.value = '';
          msg.value = '';
          return;
        }
        status.textContent = (res.data && res.data.error) || 'Could not submit. Try again.';
        status.className = 'status err';
      });
    }
  }

  /* ------------------------------------------------------------------ *
   *  Profile management  (Create + Edit, 10-foot / D-pad)                *
   * ------------------------------------------------------------------ */
  var AVATARS = [
    { id: 'fire', emoji: '\uD83D\uDD25' }, { id: 'star', emoji: '\u2B50' },
    { id: 'gem', emoji: '\uD83D\uDC8E' }, { id: 'crown', emoji: '\uD83D\uDC51' },
    { id: 'rocket', emoji: '\uD83D\uDE80' }, { id: 'bolt', emoji: '\u26A1' },
    { id: 'cool', emoji: '\uD83D\uDE0E' }, { id: 'starstruck', emoji: '\uD83E\uDD29' },
    { id: 'director', emoji: '\uD83C\uDFAC' }, { id: 'popcorn', emoji: '\uD83C\uDF7F' },
    { id: 'camera', emoji: '\uD83C\uDFA5' }, { id: 'tv', emoji: '\uD83D\uDCFA' },
    { id: 'detective', emoji: '\uD83D\uDD75\uFE0F' }, { id: 'zombie', emoji: '\uD83E\uDDFF' },
    { id: 'robot', emoji: '\uD83E\uDD16' }, { id: 'skull', emoji: '\uD83D\uDC80' },
    { id: 'mic', emoji: '\uD83C\uDFA4' }, { id: 'guitar', emoji: '\uD83C\uDFB8' },
    { id: 'headphones', emoji: '\uD83C\uDFA7' }, { id: 'piano', emoji: '\uD83C\uDFB9' },
    { id: 'whale', emoji: '\uD83D\uDC33' }, { id: 'penguin', emoji: '\uD83D\uDC27' },
    { id: 'lion', emoji: '\uD83E\uDD81' }, { id: 'panda', emoji: '\uD83D\uDC3C' },
    { id: 'dog', emoji: '\uD83D\uDC36' }, { id: 'cat', emoji: '\uD83D\uDC31' },
    { id: 'space', emoji: '\uD83D\uDE80' }, { id: 'trophy', emoji: '\uD83C\uDFC6' }
  ];

  function showManageProfiles() {
    var view = stage();
    APP.screen = 'manage';
    var box = banner('MOVIEFLIX', 'Manage profiles');
    view.appendChild(box);
    box.appendChild(make('div', { class: 'status' }, 'Loading\u2026'));

    http({ method: 'GET', url: '/api/account/profiles' }, function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        clear(box);
        box.appendChild(make('div', { class: 'err' }, 'Could not load profiles.'));
        var b = make('button', { class: 'btn' }, '\u2190 Back');
        bindClick(b, showProfiles);
        box.appendChild(b);
        setGrid([[{ el: b, action: showProfiles }]]);
        return;
      }
      var profiles = res.data.data.profiles || [];
      var canCreate = res.data.data.canCreateMore !== false;
      clear(box);
      box.appendChild(make('div', { class: 'status' }, 'Edit a profile or add a new one.'));
      var grid = [];
      var rowItems = [];
      for (var i = 0; i < profiles.length; i++) {
        (function (prof) {
          var tile = make('div', { class: 'tile' });
          var post = make('div', { class: 'poster' });
          var letter = make('div', {
            style: 'width:140px;height:210px;display:table;text-align:center;background:#0d2a3d;'
          });
          letter.innerHTML = '<div style="display:table-cell;vertical-align:middle;font-size:88px;font-weight:900;color:#04dcff;">' +
            escapeHtml(String((prof.name || '?').charAt(0)).toUpperCase()) + '</div>';
          post.appendChild(letter);
          tile.appendChild(post);
          var nm = make('span', { class: 'name' }, prof.name + (prof.isMainProfile ? '  \u00b7 main' : ''));
          tile.appendChild(nm);
          var tileAction = function () { showProfileForm(prof, true); };
          bindClick(tile, tileAction);
          box.appendChild(tile);
          rowItems.push({ el: tile, action: tileAction });
        })(profiles[i]);
      }
      grid.push(rowItems.map(function (t) { return { el: t.el, action: t.action }; }));

      var addRow = [];
      if (canCreate) {
        var addBtn = make('button', { class: 'btn' }, '+ Add Profile');
        bindClick(addBtn, function () { showProfileForm(null, false); });
        box.appendChild(addBtn);
        addRow.push({ el: addBtn, action: function () { showProfileForm(null, false); } });
      }
      var backBtn = make('button', { class: 'btn ghost' }, '\u2190 Back');
      bindClick(backBtn, showProfiles);
      box.appendChild(backBtn);
      addRow.push({ el: backBtn, action: showProfiles });
      grid.push(addRow);
      setGrid(grid);
    });
  }

  function showProfileForm(prof, isEdit) {
    var view = stage();
    APP.screen = 'profile-form';
    var name = prof ? String(prof.name || '') : '';
    var avatarId = prof ? (prof.avatarUrl || 'star') : 'star';
    var pin = '';

    var box = banner('MOVIEFLIX', isEdit ? 'Edit \u201c' + name + '\u201d' : 'Add a profile');
    view.appendChild(box);

    var panel = make('div');
    addClass(panel, 'panel');
    box.appendChild(panel);
    panel.appendChild(make('h1', {}, isEdit ? 'Edit Profile' : 'Create Profile'));

    var nameLine = make('div', { class: 'name-line' }, name);
    panel.appendChild(nameLine);
    var hint = make('div', { class: 'hint' }, 'Use the arrow keys + OK to build a name.');
    panel.appendChild(hint);

    function render() {
      nameLine.textContent = name || '\u2014';
      avatarEl.textContent = avatarEmoji(avatarId);
      pinLine.textContent = pin ? '\u2022\u2022\u2022\u2022' : '(none)';
    }
    function avatarEmoji(id) {
      for (var a = 0; a < AVATARS.length; a++) if (AVATARS[a].id === id) return AVATARS[a].emoji;
      return '\u2B50';
    }

    /* Avatar picker (single row, wraps) */
    var avatarRow = make('div');
    addClass(avatarRow, 'avatar-row');
    var avatarGridRow = [];
    for (var a = 0; a < AVATARS.length; a++) {
      (function (opt) {
        var av = make('button', { class: 'avatar' }, opt.emoji);
        bindClick(av, function () { avatarId = opt.id; render(); paintFocus(); });
        avatarRow.appendChild(av);
        avatarGridRow.push({ el: av, action: function () { avatarId = opt.id; render(); } });
      })(AVATARS[a]);
    }
    box.appendChild(avatarRow);

    var avatarEl = make('span', { class: 'avatar-big' }, '');
    panel.appendChild(avatarEl);
    var pinLine = make('span', { class: 'pin-line' }, '(none)');
    panel.appendChild(pinLine);

    /* On-screen keyboard: A–Z flipped into rows of 13, then SPACE and DEL are
     * dropped onto the LAST letter row so the keyboard stays a tidy 2-row
     * D-pad grid (third row: Save / Cancel). */
    var KB = [
      'A','B','C','D','E','F','G','H','I','J','K','L','M',
      'N','O','P','Q','R','S','T','U','V','W','X','Y','Z'
    ];
    var kbBox = make('div');
    addClass(kbBox, 'kb');
    box.appendChild(kbBox);
    var kbGrid = [];
    var kbRow = [];
    for (var k = 0; k < KB.length; k++) {
      (function (ch) {
        var b = make('button', { class: 'key' }, ch);
        bindClick(b, function () {
          if (name.length < 20) name += ch;
          render();
        });
        kbBox.appendChild(b);
        kbRow.push({ el: b, action: function () { if (name.length < 20) name += ch; render(); } });
        if (kbRow.length === 13) { kbGrid.push(kbRow); kbRow = []; }
      })(KB[k]);
    }
    var spaceBtn = make('button', { class: 'key wide' }, 'SPACE');
    bindClick(spaceBtn, function () { if (name.length < 20) name += ' '; render(); });
    kbBox.appendChild(spaceBtn);
    var delBtn = make('button', { class: 'key' }, '\u232B');
    bindClick(delBtn, function () { if (name.length > 0) name = name.slice(0, name.length - 1); render(); });
    kbBox.appendChild(delBtn);
    if (kbGrid.length) {
      var lastKbRow = kbGrid[kbGrid.length - 1];
      lastKbRow.push({ el: spaceBtn, action: function () { if (name.length < 20) name += ' '; render(); } });
      lastKbRow.push({ el: delBtn, action: function () { if (name.length > 0) name = name.slice(0, name.length - 1); render(); } });
    } else {
      kbGrid.push([
        { el: spaceBtn, action: function () { if (name.length < 20) name += ' '; render(); } },
        { el: delBtn, action: function () { if (name.length > 0) name = name.slice(0, name.length - 1); render(); } }
      ]);
    }

    /* PIN control: optional 4-digit pad (reuses app-wide D-pad pattern). */
    var pinRow = make('div');
    addClass(pinRow, 'pin-row');
    box.appendChild(pinRow);
    var pinGridRow = [];
    var pinToggle = make('button', { class: 'btn ghost' }, 'Set a PIN');
    bindClick(pinToggle, function () {
      if (pin) { pin = ''; pinToggle.textContent = 'Set a PIN'; }
      else { pin = ''; showPinSetter(); }
      render();
      paintFocus();
    });
    pinRow.appendChild(pinToggle);
    pinGridRow.push({ el: pinToggle, action: function () { if (pin) { pin = ''; pinToggle.textContent = 'Set a PIN'; } else { pin = ''; showPinSetter(); } render(); } });

    function showPinSetter() {
      var current = '';
      var dots = make('div'); addClass(dots, 'pins');
      var numBtns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
      var pinGrid = [];
      var pinWrap = make('div');
      addClass(pinWrap, 'pin-setter');
      box.appendChild(pinWrap);
      pinWrap.appendChild(dots);
      function refreshDots() {
        var dotsStr = '';
        for (var d = 0; d < 4; d++) dotsStr += '<span class="dot"></span>';
        dots.innerHTML = dotsStr;
        var filled = dots.querySelectorAll('.dot');
        for (var f = 0; f < current.length && f < filled.length; f++) filled[f].className = 'dot filled';
      }
      refreshDots();
      function commitPin() {
        pin = current;
        pinToggle.textContent = 'Clear PIN';
        render();
        try { box.removeChild(pinWrap); } catch (e) {}
        setGrid(kbGrid.concat([actionsRow]));
        paintFocus();
      }
      var numRow = [];
      for (var n = 0; n < numBtns.length; n++) {
        (function (digit) {
          var b = make('button', { class: 'key num' }, String(digit));
          bindClick(b, function () {
            if (current.length < 4) current += String(digit);
            refreshDots();
            if (current.length === 4) commitPin();
          });
          pinWrap.appendChild(b);
          numRow.push({ el: b, action: function () {
            if (current.length < 4) current += String(digit);
            refreshDots();
            if (current.length === 4) commitPin();
          } });
        })(numBtns[n]);
        if (numRow.length === 5) { pinGrid.push(numRow); numRow = []; }
      }
      if (numRow.length > 0) pinGrid.push(numRow);
      var doneRow = [];
      var cancelPin = make('button', { class: 'btn ghost' }, 'Cancel');
      bindClick(cancelPin, function () { try { box.removeChild(pinWrap); } catch (e) {} setGrid(kbGrid.concat([actionsRow])); paintFocus(); });
      pinWrap.appendChild(cancelPin);
      doneRow.push({ el: cancelPin, action: function () { try { box.removeChild(pinWrap); } catch (e) {} setGrid(kbGrid.concat([actionsRow])); paintFocus(); } });
      pinGrid.push(doneRow);
      setGrid(pinGrid);
    }

    /* Save */
    var saveRow = make('div');
    addClass(saveRow, 'actions');
    box.appendChild(saveRow);
    var saveBtn = make('button', { class: 'btn' }, 'Save');
    function doSave() {
      var n = String(name || '').trim();
      if (!n) { hint.textContent = 'Enter a name first.'; return; }
      var body = { name: n, avatarUrl: avatarId };
      if (pin) body.pin = pin;
      var url = isEdit ? '/api/profiles/' + encodeURIComponent(prof.id) : '/api/account/profiles';
      var method = isEdit ? 'PUT' : 'POST';
      http({ method: method, url: url, body: body }, function (res) {
        if (res.ok) { showProfiles(); return; }
        hint.textContent = (res.data && res.data.error) ? res.data.error : 'Could not save. Try again.';
      });
    }
    bindClick(saveBtn, doSave);
    saveRow.appendChild(saveBtn);
    var cancelSave = make('button', { class: 'btn ghost' }, 'Cancel');
    bindClick(cancelSave, showProfiles);
    saveRow.appendChild(cancelSave);

    // Save and Cancel are separate D-pad cells (OK activates them), so the
    // keyboard grid's final row is reachable with an ArrowDown + OK.
    var actionsRow = [
      { el: saveBtn, action: doSave },
      { el: cancelSave, action: showProfiles }
    ];
    setGrid(kbGrid.concat([actionsRow]));
    render();
  }

  /* ------------------------------------------------------------------ *
   *  PIN entry                                                           *
   * ------------------------------------------------------------------ */
  var PIN = { profile: null, value: '' };

  function showPin(prof) {
    var view = stage();
    APP.screen = 'pin';
    PIN.profile = prof;
    PIN.value = '';
    var box = banner('MOVIEFLIX', 'Enter the 4-digit PIN for \u201c' + prof.name + '\u201d');
    view.appendChild(box);
    var panel = make('div');
    addClass(panel, 'panel');
    box.appendChild(panel);
    panel.appendChild(make('h1', {}, 'Enter your PIN'));

    var dots = make('div');
    addClass(dots, 'pins');
    panel.appendChild(dots);
    var errLine = make('div', { class: 'err' }, '');
    panel.appendChild(errLine);

    function paintDots() {
      clear(dots);
      for (var i = 0; i < 4; i++) {
        var d = make('div', { class: 'pin-dot' + (i < PIN.value.length ? ' filled' : '') });
        dots.appendChild(d);
      }
    }

    function submit() {
      errLine.textContent = '';
      profileLogin(PIN.profile, PIN.value);
    }

    function press(key) {
      if (PIN.value.length < 4) {
        PIN.value += String(key);
        paintDots();
      }
      if (PIN.value.length === 4) submit();
    }

    function backCaret() {
      if (PIN.value.length > 0) { PIN.value = PIN.value.slice(0, -1); paintDots(); }
    }

    // Override back navigation while typing: pop a digit first.
    pushScreen('pin', function () {}, function () {
      if (PIN.value.length > 0) { backCaret(); }
      else goBackToBoot();
    });

    paintDots();
    var pad = make('div');
    addClass(pad, 'pinpad');
    var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
    var grid = [];
    var row = [];
    for (var i = 0; i < keys.length; i++) {
      (function (label, index) {
        var k = make('button', { class: 'key' }, label);
        bindClick(k, function () {
          if (label === 'C') backCaret();
          else if (label === 'OK') pinOK();
          else press(label);
        });
        pad.appendChild(k);
        row.push({
          el: k,
          action: function () {
            if (label === 'C') backCaret();
            else if (label === 'OK') pinOK();
            else press(label);
          }
        });
        if (row.length === 4) { grid.push(row); row = []; }
      })(keys[i], i);
    }
    if (row.length) grid.push(row);
    // Move grid focus to "OK"? Start focused on first key.
    var help = make('button', { class: 'btn ghost' }, '\u2190 Back');
    bindClick(help, function () { goBackToBoot(); });
    panel.appendChild(pad);
    panel.appendChild(help);

    function pinOK() {
      if (PIN.value.length === 4) submit();
      else errLine.textContent = 'Enter all 4 digits.';
    }

    grid.push([{ el: help, action: function () { goBackToBoot(); } }]);
    setGrid(grid);
  }

  function goBackToBoot() {
    APP.history = [];
    boot();
  }

  function showPinError(message) {
    var panel = DOC.querySelector('.panel .err');
    if (panel) panel.textContent = message || 'Incorrect PIN.';
  }

  function profileLogin(prof, pin) {
    var view = stage();
    APP.screen = 'logging';
    var box = banner('MOVIEFLIX', '');
    view.appendChild(box);
    box.appendChild(make('div', { class: 'status' }, 'Signing in to \u201c' + prof.name + '\u201d\u2026'));
    http({ method: 'POST', url: '/api/auth/profile-login', body: { profileId: prof.id, pin: pin || undefined } }, function (res) {
      if (res.ok && res.data && res.data.success && res.data.data && res.data.data.profile) {
        APP.profile = res.data.data.profile;
        showHome();
      } else {
        var code = res.data && res.data.code;
        var msg = (res.data && res.data.error) || 'Could not sign in.';
        if (res.status === 0) msg = 'Network error. Check the server connection.';
        if (code === 'PIN_INVALID') msg = 'Incorrect PIN.';
        if (code === 'PIN_LOCKOUT') msg = 'Too many PIN attempts. Try again shortly.';
        if (code === 'PROFILE_IN_USE') msg = 'This profile is in use on another device.';
        if (code === 'ACCOUNT_SESSION_LIMIT') msg = 'This account reached its session limit.';
        if (code === 'RATE_LIMITED') msg = 'Too many attempts. Please wait.';
        showPin(prof);
        window.setTimeout(function () { showPinError(msg); }, 50);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   *  Home / browse                                                       *
   * ------------------------------------------------------------------ */
  function showHome() {
    var view = stage();
    APP.history = [];
    APP.screen = 'home';
    var profName = APP.profile ? APP.profile.name : '';
    var box = banner('MOVIEFLIX', profName ? 'Watching as ' + profName : 'Browse your library');
    view.appendChild(box);

    var signoutWrap = make('div');
    var so = make('button', { class: 'btn ghost' }, 'Sign Out');
    bindClick(so, doSignout);
    signoutWrap.appendChild(so);
    box.appendChild(signoutWrap);

    box.appendChild(make('div', { class: 'status' }, 'Loading your library\u2026'));

    http({ method: 'GET', url: '/api/home' }, function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        clear(box);
        box.appendChild(make('div', { class: 'err' }, 'Could not load your library.'));
        var retry = make('button', { class: 'btn' }, 'Try Again');
        bindClick(retry, function () { showHome(); });
        box.appendChild(retry);
        return;
      }
      var data = res.data.data || {};
      var grid = [];
      var hydrated = {};

      function hydrate(ri) {
        if (hydrated[ri]) return;
        var row = NAV.grid[ri];
        if (!row) return;
        hydrated[ri] = true;
        for (var c = 0; c < row.length; c++) {
          if (!row[c] || !row[c].el) continue;
          var imgs = row[c].el.querySelectorAll('img[data-src]');
          for (var j = 0; j < imgs.length; j++) {
            var src = imgs[j].getAttribute('data-src');
            if (src) { imgs[j].setAttribute('src', src); imgs[j].removeAttribute('data-src'); }
          }
        }
      }

      function addRow(title, items) {
        if (!items || items.length === 0) return;
        var rowBox = make('div');
        addClass(rowBox, 'row');
        rowBox.appendChild(make('h2', {}, title));
        var tiles = make('div');
        addClass(tiles, 'tiles');
        rowBox.appendChild(tiles);
        box.appendChild(rowBox);

        var rowCells = [];
        for (var i = 0; i < items.length; i++) {
          (function (item) {
            var tile = make('div', { class: 'tile' });
            var post = make('div', { class: 'poster' });
            var img = make('img', { alt: item.title || '', width: '190', height: '285' });
            img.setAttribute('data-src', posterUrl(item, item.id || ''));
            post.appendChild(img);
            tile.appendChild(post);
            var nameSpan = make('span', { class: 'name' }, item.title || '\u2014');
            if (item.progress && item.progress.percent) {
              nameSpan.appendChild(make('span', { class: 'pct' }, Math.round(item.progress.percent) + '%'));
            }
            tile.appendChild(nameSpan);
            var action = function () { showTitle(item.id || ''); };
            bindClick(tile, action);
            tiles.appendChild(tile);
            rowCells.push({ el: tile, action: action });
          })(items[i]);
        }
        grid.push(rowCells);
      }

      if (data.featured) {
        var hero = make('div');
        addClass(hero, 'row');
        hero.appendChild(make('h2', {}, 'Featured'));
        var play = make('button', { class: 'btn' }, '\u25B6 Play ' + (data.featured.title || ''));
        var playAction = function () { showTitle(data.featured.id || ''); };
        bindClick(play, playAction);
        hero.appendChild(play);
        box.appendChild(hero);
        grid.push([{ el: play, action: playAction }]);
      }

      if (data.continueWatching && data.continueWatching.length) addRow('Continue Watching', data.continueWatching);
      if (data.myList && data.myList.length) addRow('My List', data.myList);
      if (data.newReleases && data.newReleases.length) addRow('New on MovieFlix', data.newReleases);
      if (data.recentlyAdded && data.recentlyAdded.length) addRow('Recently Added', data.recentlyAdded);
      if (data.trending && data.trending.length) addRow('Trending Now', data.trending);
      if (data.genres) {
        var keys = [];
        for (var gn in data.genres) {
          if (Object.prototype.hasOwnProperty.call(data.genres, gn)) keys.push(gn);
        }
        keys.sort();
        for (var g = 0; g < keys.length; g++) {
          (function (gname) { addRow(gname, data.genres[gname]); })(keys[g]);
        }
      }

      var signRow = [];
      var settingsBtn = make('button', { class: 'btn ghost' }, 'Settings: Payment / Report / Feedback');
      bindClick(settingsBtn, showSettings);
      box.appendChild(settingsBtn);
      grid.push([{ el: settingsBtn, action: showSettings }]);

      var so2 = make('button', { class: 'btn ghost' }, 'Sign Out');
      bindClick(so2, doSignout);
      box.appendChild(so2);
      signRow.push({ el: so2, action: doSignout });
      grid.push(signRow);

      NAV.hydrate = hydrate;
      setGrid(grid);
      if (typeof NAV.hydrate === 'function' && NAV.rows > 0) {
        try { NAV.hydrate(NAV.ri); } catch (e) { /* ignore */ }
      }
      box.appendChild(make('div', { class: 'try' }, 'Browse with the arrow keys. Press OK to open a title. Back returns.'));
    });
  }

  /* helper so tiles carry their own action */
  function makeTile(item) {
    var tile = make('div', { class: 'tile' });
    var post = make('div', { class: 'poster' });
    var img = make('img', { alt: item.title || '', width: '190', height: '285' });
    img.setAttribute('data-src', posterUrl(item, item.id || ''));
    post.appendChild(img);
    tile.appendChild(post);
    var nameSpan = make('span', { class: 'name' }, item.title || '\u2014');
    if (item.progress && item.progress.percent) {
      nameSpan.appendChild(make('span', { class: 'pct' }, Math.round(item.progress.percent) + '%'));
    }
    tile.appendChild(nameSpan);
    return tile;
  }

  /* ------------------------------------------------------------------ *
   *  Title detail                                                        *
   * ------------------------------------------------------------------ */
  function showTitle(mediaId) {
    var view = stage();
    APP.screen = 'title';
    var box = banner('MOVIEFLIX', 'Loading\u2026');
    view.appendChild(box);

    http({ method: 'GET', url: '/api/media/' + encodeURIComponent(mediaId) }, function (res) {
      clear(box);
      banner('MOVIEFLIX', '');
      if (!res.ok || !res.data || !res.data.success) {
        box.appendChild(make('div', { class: 'err' }, 'Could not load this title.'));
        var br = make('button', { class: 'btn' }, '\u2190 Back');
        bindClick(br, bootLan);
        box.appendChild(br);
        return;
      }
      var m = res.data.data || {};
      box = banner('MOVIEFLIX', m.title || '');
      view.appendChild(box);

      var metaParts = [];
      if (m.year) metaParts.push(String(m.year));
      if (m.type) metaParts.push(m.type);
      if (m.rating) metaParts.push('Rating ' + m.rating);
      if (m.maturityRating) metaParts.push(m.maturityRating);
      if (m.durationMinutes) metaParts.push(m.durationMinutes + ' min');
      box.appendChild(make('div', { class: 'meta' }, metaParts.join('  \u00b7  ')));
      if (m.overview) box.appendChild(make('p', { class: 'desc' }, m.overview));

      var grid = [];

      var playRow = [];
      var play = make('button', { class: 'btn' }, '\u25B6 Play');
      bindClick(play, function () { playMedia(m, null); });
      box.appendChild(play);
      playRow.push({ el: play, action: function () { playMedia(m, null); } });

      var backRow = [];
      var back = make('button', { class: 'btn ghost' }, 'Back to Home');
      bindClick(back, bootLan);
      box.appendChild(back);
      backRow.push({ el: back, action: bootLan });

      if (m.type === 'series' && m.episodes && m.episodes.length) {
        box.appendChild(make('div', { class: 'row' }));
        var titleRow = make('div');
        addClass(titleRow, 'row');
        titleRow.appendChild(make('h2', {}, 'Episodes'));
        box.appendChild(titleRow);
        var epGrid = [];
        for (var i = 0; i < m.episodes.length; i++) {
          (function (ep) {
            var opt = make('button', { class: 'opt' },
              'S' + (ep.seasonNumber || '?') + ' \u00b7 E' + (ep.episodeNumber || '?') + ' \u2014 ' + (ep.title || 'Episode'));
            bindClick(opt, function () { playMedia(m, ep); });
            box.appendChild(opt);
            epGrid.push({ el: opt, action: function () { playMedia(m, ep); } });
          })(m.episodes[i]);
        }
        grid.push(epGrid);
      }

      grid.push(playRow, backRow);
      setGrid(grid);
      box.appendChild(make('div', { class: 'try' }, 'Press OK to play. Back returns to Home.'));
    });
  }

  function bootLan() { showHome(); }

  /* ------------------------------------------------------------------ *
   *  Player (MP4-first, HLS fallback, resume, progress save)             *
   * ------------------------------------------------------------------ */
  function playMedia(mediaItem, episode) {
    var mediaId = mediaItem.id;
    var episodeId = episode ? episode.id : null;

    // Wait — progress + a choice screen first if there is something to resume.
    var cancel = false;
    var q = episodeId ? '?episode=' + encodeURIComponent(episodeId) : '';
    http({ method: 'GET', url: '/api/media/' + encodeURIComponent(mediaId) + '/progress' + q, allowRefresh: true }, function (res) {
      if (cancel || !res.ok || !res.data || !res.data.success) { resumeFallback(0, 0); return; }
      var prog = res.data.data || {};
      var pos = Number(prog.positionSeconds) || 0;
      var dur = Number(prog.durationSeconds) || 0;
      var pct = Number(prog.percent) || 0;
      if (pos >= 30 && dur > 0 && pct > 0 && pct < 92 && !prog.completed) {
        showResumeChoice(mediaItem, episode, pos);
      } else {
        openPlayer(mediaItem, episode, 0);
      }
    });
  }

  function showResumeChoice(mediaItem, episode, pos) {
    var view = stage();
    APP.screen = 'resume';
    var box = banner('MOVIEFLIX', mediaItem.title || '');
    view.appendChild(box);
    var panel = make('div');
    addClass(panel, 'panel');
    box.appendChild(panel);
    panel.appendChild(make('h1', {}, 'Resume?'));
    panel.appendChild(make('p', { class: 'hint' }, 'You stopped at ' + formatTime(pos) + '.'));

    var resume = make('button', { class: 'btn' }, 'Resume from ' + formatTime(pos));
    bindClick(resume, function () { openPlayer(mediaItem, episode, pos); });
    panel.appendChild(resume);
    var fresh = make('button', { class: 'btn ghost' }, 'Play from the start');
    bindClick(fresh, function () { openPlayer(mediaItem, episode, 0); });
    panel.appendChild(fresh);
    var back = make('button', { class: 'btn ghost' }, '\u2190 Back');
    bindClick(back, function () { showTitle(mediaItem.id); });
    panel.appendChild(back);

    setGrid([
      [{ el: resume, action: function () { openPlayer(mediaItem, episode, pos); } }],
      [{ el: fresh, action: function () { openPlayer(mediaItem, episode, 0); } }],
      [{ el: back, action: function () { showTitle(mediaItem.id); } }]
    ]);
  }

  function openPlayer(mediaItem, episode, startPos) {
    var mediaId = mediaItem.id;
    var episodeId = episode ? episode.id : null;
    var view = stage();
    APP.screen = 'player';

    var mp4 = '/api/media/' + encodeURIComponent(mediaId) + '/stream' + (episodeId ? '?episode=' + encodeURIComponent(episodeId) : '');
    var hls = '/api/media/' + encodeURIComponent(mediaId) + '/transcode/720/index.m3u8' + (episodeId ? '?episode=' + encodeURIComponent(episodeId) : '');

    var cap = caps();
    var withoutMp4 = cap.mp4 === '' || cap.mp4 === 'no' ? false : true;
    // Prefer MP4 (range streaming) — the most compatible with old engines. If
    // the engine clearly cannot do MP4 but can do HLS, start at HLS directly.
    var primary;
    var fallback;
    if (!cap.mp4 && cap.hlsNative) { primary = hls; fallback = mp4; }
    else { primary = mp4; fallback = hls; }

    var box = banner('MOVIEFLIX', mediaItem.title || 'Play');
    view.appendChild(box);

    var video = DOC.createElement('video');
    video.setAttribute('class', 'video');
    video.setAttribute('controls', '');          // native controls where available
    video.setAttribute('autoplay', 'autoplay');  // most TV browsers autoplay server streams
    video.setAttribute('playsinline', '');
    box.appendChild(video);

    var progWrap = make('div');
    addClass(progWrap, 'prog');
    var progFill = make('div');
    progWrap.appendChild(progFill);
    box.appendChild(progWrap);
    var times = make('div', { class: 'times' }, '0:00 / 0:00');
    box.appendChild(times);

    var ctrlWrap = make('div');
    addClass(ctrlWrap, 'controls');
    var clearBtns = [];
    function ctrl(label, action) {
      var b = make('button', { class: 'ctrl' }, label);
      bindClick(b, action);
      ctrlWrap.appendChild(b);
      return b;
    }
    var btnPlay = ctrl('\u25B6 Play', togglePlay);
    var btnBack15 = ctrl('\u21A4 15s', function () { seekRel(-15); });
    var btnFwd15 = ctrl('15s \u21A6', function () { seekRel(15); });
    var btnStop = ctrl('\u2190 Exit', exit);
    box.appendChild(ctrlWrap);

    var statusLine = make('div', { class: 'status' }, 'Loading\u2026');
    box.appendChild(statusLine);

    var current = primary;
    var fallbackUsed = false;
    var lastSave = 0;
    var saved = false;

    var state = {
      mediaId: mediaId,
      episodeId: episodeId,
      mp4: mp4,
      hls: hls,
      primary: primary,
      fallback: fallback,
      fallbackUsed: false,
      current: current,
      firstFrame: false,
      playingSince: 0
    };
    APP.player = state;

    function setSource(url, markFallback) {
      current = url;
      state.current = url;
      if (markFallback) { state.fallbackUsed = true; fallbackUsed = true; }
      try { video.src = url; } catch (e) { try { video.setAttribute('src', url); } catch (e2) { /* ignore */ } }
      if (startPos > 0) {
        try { video.currentTime = startPos; } catch (e) { /* ignore */ }
      }
      video.load();
      playInternal();
    }

    function playInternal() {
      try {
        var p = video.play();
        if (p && typeof p.catch === 'function') p.catch(function () { /* autoplay may be blocked */ });
      } catch (e) { /* ignore */ }
    }

    function togglePlay() {
      try {
        if (video.paused) playInternal();
        else video.pause();
      } catch (e) { /* ignore */ }
    }
    video.addEventListener('playing', function () {
      btnPlay.textContent = '\u2759\u2759 Pause';
    });
    video.addEventListener('pause', function () {
      btnPlay.textContent = '\u25B6 Play';
    });
    video.addEventListener('ended', function () {
      btnPlay.textContent = '\u25B6 Replay';
    });
    function seekRel(d) {
      try {
        var t = Number(video.currentTime || 0) + d;
        if (Number.isFinite && !Number.isFinite(t)) return;
        var dur = Number(video.duration || 0);
        if (dur > 0) t = Math.max(0, Math.min(dur - 0.5, t));
        if (t >= 0) video.currentTime = t;
      } catch (e) { /* ignore */ }
    }

    function saveProgress() {
      if (saved) return;
      var pos = 0, dur = video.duration || 0;
      try { pos = video.currentTime || 0; } catch (e) { pos = 0; }
      if (isNaN(dur) || !isFinite(dur) || dur <= 0 || dur > 100000) dur = 0;
      if (pos < 0) pos = 0;
      http({ method: 'POST', url: '/api/media/' + encodeURIComponent(mediaId) + '/progress', body: {
        positionSeconds: Math.floor(pos),
        durationSeconds: Math.floor(dur),
        episodeId: episodeId
      }, allowRefresh: true }, function () { /* best effort */ });
    }

    function exit() {
      if (saved) { try { video.pause(); } catch (e) { /* ignore */ } showTitle(mediaId); return; }
      saved = true;
      saveProgress();
      try { video.pause(); } catch (e) { /* ignore */ }
      showTitle(mediaId);
    }

    video.addEventListener('timeupdate', function () {
      var pos = 0, dur = 0;
      try { pos = video.currentTime || 0; } catch (e) { pos = 0; }
      try { dur = video.duration || 0; } catch (e) { dur = 0; }
      if (isNaN(dur) || !isFinite(dur) || dur < 0) dur = 0;
      if (isNaN(pos) || pos < 0) pos = 0;
      var pct = dur > 0 ? Math.min(100, Math.round((pos / dur) * 100)) : 0;
      progFill.style.width = pct + '%';
      times.textContent = formatTime(pos) + ' / ' + formatTime(dur);
      statusLine.textContent = '';
      var now = Date.now();
      if (now - lastSave > 5000) { lastSave = now; saveProgress(); }
    });

    video.addEventListener('playing', function () {
      statusLine.textContent = '';
      if (!fallbackUsed) { state.firstFrame = true; }
      state.firstFrame = true;
      state.playingSince = Date.now();
    });

    video.addEventListener('error', function () {
      if (fallbackUsed) {
        statusLine.textContent = 'This video could not be played on this TV.';
        if (statusLine.className.indexOf('err') < 0) statusLine.className = 'status err';
        // offer to go back
        var again = make('button', { class: 'btn' }, '\u2190 Back');
        bindClick(again, function () { exit(); });
        ctrlWrap.appendChild(again);
        return;
      }
      fallbackUsed = true;
      state.fallbackUsed = true;
      statusLine.textContent = 'Trying the compatible stream\u2026';
      setSource(fallback, true);
    });

    video.addEventListener('ended', function () {
      // Native-HLS fast-fail: an old TV engine that can't follow the growing
      // event playlist reports a tiny duration and fires `ended` after only a
      // few seconds, with no frame ever decoded. If we were playing HLS and
      // this happened within a short window, don't treat the movie as watched —
      // fall back to the MP4 source stream (or surface the error).
      var playingSince = Number(state.playingSince || 0);
      var elapsed = playingSince ? Date.now() - playingSince : Infinity;
      var tinyDuration = Number(video.duration || 0) > 0 && Number(video.duration || 0) <= 15;
      var noFrame = !state.firstFrame;
      var usedHls = state.current === state.hls;
      if (usedHls && elapsed < 30000 && (noFrame || tinyDuration) && !state.fallbackUsed) {
        if (state.mp4) {
          statusLine.textContent = 'This TV did not like the stream; trying the compatible one\u2026';
          state.fallbackUsed = true;
          fallbackUsed = true;
          setSource(state.mp4, true);
          return;
        }
      }
      if (usedHls && elapsed < 30000 && (noFrame || tinyDuration) && state.fallbackUsed) {
        statusLine.textContent = 'Playback stopped early on this TV (native HLS failed).';
        if (statusLine.className.indexOf('err') < 0) statusLine.className = 'status err';
        return;
      }
      saved = true;
      http({ method: 'POST', url: '/api/media/' + encodeURIComponent(mediaId) + '/progress', body: {
        positionSeconds: Math.floor((video.duration || 0)),
        durationSeconds: Math.floor((video.duration || 0)),
        episodeId: episodeId
      }, allowRefresh: true }, function () {
        showTitle(mediaId);
      });
    });

    if (window.addEventListener) {
      window.addEventListener('beforeunload', function () { saveProgress(); }, false);
    }

    setSource(current, false);

    setGrid([
      [{ el: btnPlay, action: togglePlay }],
      [{ el: btnBack15, action: function () { seekRel(-15); } },
       { el: btnFwd15, action: function () { seekRel(15); } }],
      [{ el: btnStop, action: exit }]
    ]);
  }

  /* ------------------------------------------------------------------ *
   *  Diagnostics                                                        *
   * ------------------------------------------------------------------ */
  function showDiag() {
    var view = stage();
    APP.screen = 'diag';
    var box = banner('MOVIEFLIX', 'Engine capability report');
    view.appendChild(box);
    var c = caps();
    var rows = [
      ['User agent', c.ua],
      ['ES modules', String(c.modules)],
      ['Promise', String(c.promise)],
      ['fetch', String(c.fetch)],
      ['XMLHttpRequest', String(c.xhr)],
      ['JSON', String(c.json)],
      ['localStorage', String(c.localStorage)],
      ['QR library', String(c.qrcode)],
      ['MediaSource (MSE)', String(c.mse)],
      ['canPlayType video/mp4', c.mp4 || '(none)'],
      ['canPlayType H.264 baseline', c.h264 || '(none)'],
      ['canPlayType H.264 high', c.h264High || '(none)'],
      ['canPlayType HLS', c.hlsNative || '(none)'],
      ['canvas', String(c.canvas)],
      ['performance.now', String(c.performance)],
      ['matchMedia', String(c.matchMedia)],
      ['crypto.randomUUID', String(c.cryptoUuid)],
      ['Last error', APP.lastError || '(none)']
    ];
    var table = DOC.createElement('table');
    table.className = 'diag';
    var tbody = DOC.createElement('tbody');
    for (var i = 0; i < rows.length; i++) {
      var tr = DOC.createElement('tr');
      var th = DOC.createElement('th');
      th.textContent = rows[i][0];
      var td = DOC.createElement('td');
      td.textContent = rows[i][1];
      tr.appendChild(th);
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    box.appendChild(table);
    var cont = make('button', { class: 'btn' }, 'Continue anyway');
    bindClick(cont, function () {
      var q = String(window.location.search || '').replace(/[?&]diag=1/, '');
      window.location.search = q.replace(/^\?/, '');
    });
    box.appendChild(cont);
    setGrid([[{ el: cont, action: function () { window.location.href = '/legacy-tv.html'; } }]]);
  }

  /* ------------------------------------------------------------------ *
   *  Boot                                                               *
   * ------------------------------------------------------------------ */
  boot();
})();
