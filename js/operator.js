/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — operator console demo (.cko)

   Operator-side companion to the guest booking demo (js/demo.js): same
   venue map, same furniture coordinates, same design language — viewed
   from the host stand. Structure mirrors the live operator floor plan:

     toolbar (views, service date, search, live stats)
       → mode row (multi-select, block/release, block-by-area, legend)
       → live floor plan (click a bed → walk in / create booking / block)
       → bed panel · reservations panel → Form Confirm Booking modal

   Mount: <div class="cko" data-opdemo="map|bookings|select|walkin">.
   All state is local — no payment, no network.
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-opdemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/operator.js';
  var MAP_URL = SCRIPT_SRC.replace(/js\/operator\.js.*$/, 'assets/demo/venue-real.webp');
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/operator\.js.*$/, 'brand/clubtech-mark-black-96.png');
  var MAP_AR = 1536 / 1152;

  mounts.forEach(function (m) { createConsole(m); });

  function createConsole(root) {
  var OPTS = {
    view: root.getAttribute('data-opdemo') || 'map',
    badge: root.getAttribute('data-opdemo-badge') || ''
  };

  /* ===== venue data (same furniture as the guest demo) ================ */

  var SPOTS = [
    { id: 'cab1', name: 'VIP Cabana', num: 12, zone: 'VIP Cabanas', x: 9.3, y: 13.3, w: 12.6, h: 13.8, cap: 8 },
    { id: 'cab2', name: 'VIP Cabana', num: 14, zone: 'VIP Cabanas', x: 9.3, y: 30.3, w: 12.6, h: 13.8, cap: 8 },
    { id: 'cab3', name: 'VIP Cabana', num: 16, zone: 'VIP Cabanas', x: 9.3, y: 47.3, w: 12.6, h: 13.8, cap: 8 },
    { id: 'cab4', name: 'VIP Cabana', num: 18, zone: 'VIP Cabanas', x: 9.3, y: 64.3, w: 12.6, h: 13.8, cap: 8 },
    { id: 'db1', name: 'Pool Club Bed', num: 651, zone: 'Pool Club', x: 37.5, y: 21.6, w: 4.0, h: 7.2, cap: 4 },
    { id: 'db2', name: 'Pool Club Bed', num: 652, zone: 'Pool Club', x: 43.9, y: 21.6, w: 4.0, h: 7.2, cap: 4 },
    { id: 'db3', name: 'Pool Club Bed', num: 653, zone: 'Pool Club', x: 50.3, y: 21.6, w: 4.0, h: 7.2, cap: 4 },
    { id: 'db4', name: 'Pool Club Bed', num: 654, zone: 'Pool Club', x: 56.7, y: 21.6, w: 4.0, h: 7.2, cap: 4 },
    { id: 'db5', name: 'Pool Club Bed', num: 655, zone: 'Pool Club', x: 62.2, y: 21.6, w: 4.0, h: 7.2, cap: 4 },
    { id: 'db6', name: 'Pool Club Bed', num: 656, zone: 'Pool Club', x: 36.2, y: 49.6, w: 3.9, h: 6.9, cap: 4 },
    { id: 'db7', name: 'Pool Club Bed', num: 657, zone: 'Pool Club', x: 42.7, y: 49.6, w: 3.9, h: 6.9, cap: 4 },
    { id: 'db8', name: 'Pool Club Bed', num: 658, zone: 'Pool Club', x: 49.9, y: 49.6, w: 3.9, h: 6.9, cap: 4 },
    { id: 'db9', name: 'Pool Club Bed', num: 659, zone: 'Pool Club', x: 56.6, y: 49.6, w: 3.9, h: 6.9, cap: 4 },
    { id: 'db10', name: 'Pool Club Bed', num: 660, zone: 'Pool Club', x: 63.6, y: 49.6, w: 3.9, h: 6.9, cap: 4 },
    { id: 'db11', name: 'Pool Club Bed', num: 661, zone: 'Pool Club', x: 26.6, y: 30.0, w: 4.6, h: 6.4, cap: 4 },
    { id: 'db12', name: 'Pool Club Bed', num: 662, zone: 'Pool Club', x: 26.6, y: 37.7, w: 4.6, h: 6.4, cap: 4 },
    { id: 'bb1', name: 'Beachfront Bale', num: 21, zone: 'Beachfront', x: 36.2, y: 61.0, w: 7.8, h: 10.4, cap: 6 },
    { id: 'bb2', name: 'Beachfront Bale', num: 22, zone: 'Beachfront', x: 44.9, y: 61.0, w: 7.8, h: 10.4, cap: 6 },
    { id: 'bb3', name: 'Beachfront Bale', num: 23, zone: 'Beachfront', x: 53.4, y: 61.0, w: 7.8, h: 10.4, cap: 6 },
    { id: 'bb4', name: 'Beachfront Bale', num: 24, zone: 'Beachfront', x: 64.1, y: 61.0, w: 7.8, h: 10.4, cap: 6 }
  ];

  var ZONES = ['VIP Cabanas', 'Pool Club', 'Beachfront'];
  var DAYS = [13, 14, 15, 16, 17];

  /* ===== state ======================================================== */

  var state = {
    day: 14,
    status: {},        // spot id -> free | booked | checked | blocked
    bookings: [],      // { spot, guest, pax, pkg, paid, status: booked|checked, type }
    multi: false,
    selected: {},      // spot id -> true
    panel: null,       // 'bed' | 'list'
    listFilter: 'all', // all | checked
    query: ''
  };

  SPOTS.forEach(function (s) { state.status[s.id] = 'free'; });

  [
    { spot: 'cab2', guest: 'Maya Chen', pax: 8, pkg: 'Ultimate Experience', paid: 680, status: 'booked', type: 'Online' },
    { spot: 'db2', guest: 'Liam O’Connor', pax: 4, pkg: 'Bed + Party Package', paid: 250, status: 'checked', type: 'Online' },
    { spot: 'db4', guest: 'Sofia Marino', pax: 4, pkg: 'Bed + Party Package', paid: 250, status: 'booked', type: 'Online' },
    { spot: 'db6', guest: 'Jack Wilson', pax: 2, pkg: 'Bed Only', paid: 180, status: 'booked', type: 'Online' },
    { spot: 'bb1', guest: 'Aisha Rahman', pax: 6, pkg: 'Bed + Party Package', paid: 250, status: 'checked', type: 'Online' },
    { spot: 'bb3', guest: 'Tom Becker', pax: 5, pkg: 'Ultimate Experience', paid: 680, status: 'booked', type: 'Online' }
  ].forEach(function (b) {
    state.bookings.push(b);
    state.status[b.spot] = b.status;
  });
  state.status.db9 = 'blocked';
  state.status.bb4 = 'blocked';

  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || root).querySelectorAll(sel)); }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function money(n) { return '$' + n.toLocaleString('en-US'); }
  function spot(id) { return SPOTS.filter(function (s) { return s.id === id; })[0]; }
  function bookingFor(id) { return state.bookings.filter(function (b) { return b.spot === id; })[0]; }
  function track(n, p) { try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {} }

  function stats() {
    var checked = 0, booked = 0, blocked = 0, pax = 0;
    SPOTS.forEach(function (s) {
      var st = state.status[s.id];
      if (st === 'checked') checked++;
      if (st === 'booked') booked++;
      if (st === 'blocked') blocked++;
    });
    state.bookings.forEach(function (b) { if (b.status === 'checked') pax += b.pax; });
    return { checked: checked, booked: booked, blocked: blocked, pax: pax };
  }

  var I = {
    logo: '<img src="' + BRAND_MARK + '" alt="">',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    pax: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c1-3 3.1-4.5 5.5-4.5s4.5 1.5 5.5 4.5M15.5 6a3 3 0 0 1 0 5.4M17 15.4c1.8.6 3 2 3.7 4.1"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="13" cy="4.5" r="1.9"/><path d="M10 20.5 12 15l-2-1.5.5-5 3 .5 1.5 3 3 1M8 12.5l1-4M14.5 20.5 13 16"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>',
    block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>'
  };

  /* ===== shell ======================================================== */

  var world;

  function build() {
    root.innerHTML = '';

    /* toolbar */
    var bar = h('div', 'cko-bar');
    bar.appendChild(h('span', 'cko-logo', I.logo));
    var seg = h('div', 'cko-seg',
      '<button type="button" data-seg="map" class="on">Floor plan</button>' +
      '<button type="button" data-seg="all">Reservations</button>' +
      '<button type="button" data-seg="checked">Guest list</button>');
    bar.appendChild(seg);
    var dp = h('button', 'cko-datepill', I.cal + '<span data-opdate>' + state.day + ' July 2026</span>');
    dp.type = 'button';
    dp.setAttribute('aria-label', 'Choose service date');
    bar.appendChild(dp);
    var search = h('div', 'cko-search', I.search + '<input type="text" placeholder="Guest, bed # or booking" aria-label="Search bookings">');
    bar.appendChild(search);
    bar.appendChild(h('div', 'cko-stats', ''));
    root.appendChild(bar);

    /* day strip popover */
    var daypop = h('div', 'cko-daypop',
      DAYS.map(function (d) {
        return '<button type="button" data-opday="' + d + '" class="' + (d === state.day ? 'sel' : '') + '"><b>' + d + '</b><span>Jul</span></button>';
      }).join(''));
    root.appendChild(daypop);
    dp.addEventListener('click', function (e) { e.stopPropagation(); daypop.classList.toggle('open'); });
    $$('[data-opday]', daypop).forEach(function (b) {
      b.addEventListener('click', function () {
        state.day = +b.getAttribute('data-opday');
        $$('[data-opday]', daypop).forEach(function (x) { x.classList.toggle('sel', x === b); });
        $$('[data-opdate]').forEach(function (x) { x.textContent = state.day + ' July 2026'; });
        daypop.classList.remove('open');
        toast('Showing service day ' + state.day + ' July 2026');
      });
    });
    root.addEventListener('click', function () { daypop.classList.remove('open'); });

    /* mode row */
    var modes = h('div', 'cko-modes');
    var ms = h('button', 'cko-mode', '☐ Multiple selection');
    ms.type = 'button';
    ms.addEventListener('click', toggleMulti);
    ms.setAttribute('data-multibtn', '');
    modes.appendChild(ms);
    var blockSel = h('button', 'cko-mode dark', I.block + ' Block selected');
    blockSel.type = 'button';
    blockSel.setAttribute('data-blocksel', '');
    blockSel.hidden = true;
    blockSel.addEventListener('click', function () { bulk('blocked'); });
    modes.appendChild(blockSel);
    var relSel = h('button', 'cko-mode line', 'Release selected');
    relSel.type = 'button';
    relSel.setAttribute('data-relsel', '');
    relSel.hidden = true;
    relSel.addEventListener('click', function () { bulk('free'); });
    modes.appendChild(relSel);

    var za = h('div', 'cko-zonemenu');
    var zb = h('button', 'cko-mode', 'Block by area ▾');
    zb.type = 'button';
    zb.addEventListener('click', function (e) { e.stopPropagation(); za.classList.toggle('open'); });
    za.appendChild(zb);
    var zlist = h('div', 'cko-zonelist',
      ZONES.map(function (z) { return '<button type="button" data-opzone="' + z + '">' + z + '</button>'; }).join(''));
    za.appendChild(zlist);
    $$('[data-opzone]', zlist).forEach(function (b) {
      b.addEventListener('click', function () { toggleZone(b.getAttribute('data-opzone')); za.classList.remove('open'); });
    });
    modes.appendChild(za);
    root.addEventListener('click', function () { za.classList.remove('open'); });

    modes.appendChild(h('div', 'cko-legend',
      '<span><i class="free"></i>Available</span>' +
      '<span><i class="booked"></i>Booked</span>' +
      '<span><i class="checked"></i>Checked-in</span>' +
      '<span><i class="blocked"></i>Blocked</span>'));
    root.appendChild(modes);

    /* map */
    var stage = h('div', 'cko-stage');
    world = h('div', 'cko-world');
    var wimg = world.appendChild(h('img'));
    wimg.alt = '';
    wimg.src = MAP_URL;
    SPOTS.forEach(function (s) {
      var b = h('button', 'cko-spot');
      b.type = 'button';
      b.style.cssText = 'left:' + s.x + '%;top:' + s.y + '%;width:' + s.w + '%;height:' + s.h + '%';
      b.setAttribute('data-opid', s.id);
      b.addEventListener('click', function (e) { e.stopPropagation(); onSpot(s); });
      world.appendChild(b);
    });
    stage.appendChild(world);
    root.appendChild(stage);

    /* panel, modal shell, toast */
    root.appendChild(h('div', 'cko-panel'));
    var scrim = h('div', 'cko-scrim');
    scrim.addEventListener('click', function (e) { if (e.target === scrim) closeModal(); });
    var modal = h('div', 'cko-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Form Confirm Booking');
    scrim.appendChild(modal);
    root.appendChild(scrim);
        var toastEl = h('div', 'cko-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    root.appendChild(toastEl);

    if (OPTS.badge) {
      var bhost = h('div', 'demo-badge-host');
      root.parentNode.insertBefore(bhost, root);
      bhost.appendChild(root);
      bhost.appendChild(h('div', 'cko-badge right', '<i></i>' + OPTS.badge));
    }

    /* wiring */
    $$('[data-seg]', seg).forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-seg');
        $$('[data-seg]', seg).forEach(function (x) { x.classList.toggle('on', x === b); });
        if (v === 'map') closePanel();
        else { state.listFilter = v; openList(); }
      });
    });
    var inp = $('input', search);
    inp.addEventListener('input', function () {
      state.query = inp.value.trim().toLowerCase();
      if (state.query) { state.listFilter = 'all'; openList(); }
      else if (state.panel === 'list') openList();
    });

    sizeWorld();
    if (window.ResizeObserver) new ResizeObserver(sizeWorld).observe(stage);
    window.addEventListener('load', sizeWorld);
    [300, 1200, 3000].forEach(function (t) { setTimeout(sizeWorld, t); });

    function sizeWorld() {
      var W = stage.clientWidth, H = stage.clientHeight;
      if (!W || !H) return;
      var w = Math.max(W, H * MAP_AR), hh = w / MAP_AR;
      if (hh < H) { hh = H; w = hh * MAP_AR; }
      world.style.width = w + 'px';
      world.style.height = hh + 'px';
      world.style.left = (W - w) / 2 + 'px';
      world.style.top = (H - hh) / 2 + 'px';
      root.classList.toggle('tiny', root.clientWidth < 520);
    }

    paint();
  }

  /* ===== paint / stats ================================================ */

  function paint() {
    var LBL = { free: 'available', booked: 'booked', checked: 'checked in', blocked: 'blocked' };
    SPOTS.forEach(function (s) {
      var el = $('[data-opid="' + s.id + '"]');
      el.className = 'cko-spot ' + state.status[s.id] + (state.selected[s.id] ? ' sel' : '');
      el.setAttribute('aria-label', s.name + ' #' + s.num + ' — ' + LBL[state.status[s.id]]);
    });
    var st = stats();
    $('.cko-stats').innerHTML =
      '<span><b>' + st.checked + '</b>Checked-in</span>' +
      '<span><b>' + st.booked + '</b>Booked</span>' +
      '<span><b>' + st.blocked + '</b>Blocked</span>' +
      '<span><b>' + st.pax + '</b>Pax in house</span>';
  }

  var toastId = null;
  function toast(msg) {
    var t = $('.cko-toast');
    t.textContent = msg;
    t.classList.add('show');
    if (toastId) clearTimeout(toastId);
    toastId = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ===== selection & blocking ======================================== */

  function toggleMulti() {
    state.multi = !state.multi;
    if (!state.multi) state.selected = {};
    var mb = $('[data-multibtn]');
    mb.classList.toggle('on', state.multi);
    mb.innerHTML = (state.multi ? '☑' : '☐') + ' Multiple selection';
    $('[data-blocksel]').hidden = !state.multi;
    $('[data-relsel]').hidden = !state.multi;
    paint();
  }

  function bulk(to) {
    var ids = Object.keys(state.selected);
    if (!ids.length) { toast('Tap furniture on the map to select it first'); return; }
    var n = 0;
    ids.forEach(function (id) {
      if (to === 'blocked' && state.status[id] === 'free') { state.status[id] = 'blocked'; n++; }
      if (to === 'free' && state.status[id] === 'blocked') { state.status[id] = 'free'; n++; }
    });
    state.selected = {};
    paint();
    toast(to === 'blocked' ? 'Blocked ' + n + ' spots' : 'Released ' + n + ' spots');
    track('opdemo_bulk', { to: to, n: n });
  }

  function toggleZone(zone) {
    var free = SPOTS.filter(function (s) { return s.zone === zone && state.status[s.id] === 'free'; });
    if (free.length) {
      free.forEach(function (s) { state.status[s.id] = 'blocked'; });
      toast(zone + ' blocked — ' + free.length + ' spots off sale');
    } else {
      var n = 0;
      SPOTS.forEach(function (s) { if (s.zone === zone && state.status[s.id] === 'blocked') { state.status[s.id] = 'free'; n++; } });
      toast(zone + ' released — ' + n + ' spots back on sale');
    }
    paint();
    track('opdemo_zone_block', { zone: zone });
  }

  /* ===== bed panel ==================================================== */

  function onSpot(s) {
    if (state.multi) {
      if (state.status[s.id] === 'free' || state.status[s.id] === 'blocked') {
        if (state.selected[s.id]) delete state.selected[s.id]; else state.selected[s.id] = true;
        paint();
      } else toast('Only available or blocked furniture can be bulk-edited');
      return;
    }
    openBed(s);
  }

  function statusChip(st) {
    var lbl = { free: 'Available', booked: 'Booked', checked: 'Checked-in', blocked: 'Blocked' };
    return '<span class="cko-chip ' + st + '">' + lbl[st] + '</span>';
  }

  function openBed(s) {
    state.panel = 'bed';
    var st = state.status[s.id];
    var b = bookingFor(s.id);
    var p = $('.cko-panel');
    var html =
      '<button type="button" class="cko-x" aria-label="Close">✕</button>' +
      '<h3 role="presentation">' + s.name + ' – #' + s.num + '</h3>' +
      '<p class="cko-sub">' + s.zone + ' · ' + I.pax + ' up to ' + s.cap + ' guests · ' + statusChip(st) + '</p>' +
      '<span class="cko-thumb" style="background-image:url(' + MAP_URL + ');background-position:' + s.x + '% ' + s.y + '%"></span>';

    if (st === 'free') {
      html += '<p class="cko-note">This spot is on sale online and at the host stand.</p>' +
        '<div class="cko-actions">' +
          '<button type="button" class="cko-btn dark" data-act="walkin">' + I.walk + ' Walk in</button>' +
          '<button type="button" class="cko-btn line" data-act="booking">' + I.doc + ' Create booking</button>' +
          '<button type="button" class="cko-btn line" data-act="block">' + I.block + ' Block</button>' +
        '</div>';
    }
    if (st === 'blocked') {
      html += '<p class="cko-note">Blocked — hidden from online sale and the host stand.</p>' +
        '<div class="cko-actions"><button type="button" class="cko-btn dark" data-act="release">Release</button></div>';
    }
    if ((st === 'booked' || st === 'checked') && b) {
      html += '<div class="cko-guest">' +
        '<h4 role="presentation">' + b.guest + '</h4>' +
        '<p>' + b.pkg + ' · ' + b.pax + ' pax · ' + b.type + '</p>' +
        '<p class="paid">Prepaid ' + money(b.paid) + '</p></div>';
      html += '<div class="cko-actions">' +
        (st === 'booked'
          ? '<button type="button" class="cko-btn dark" data-act="checkin">Check in</button>' +
            '<button type="button" class="cko-btn line" data-act="cancel">Cancel booking</button>'
          : '<button type="button" class="cko-btn line" data-act="undo">Undo check-in</button>') +
        '</div>';
    }
    p.innerHTML = html;
    p.classList.add('open');
    $('.cko-x', p).addEventListener('click', closePanel);
    $$('[data-act]', p).forEach(function (btn) {
      btn.addEventListener('click', function () { bedAction(btn.getAttribute('data-act'), s); });
    });
    track('opdemo_bed', { spot: s.id, status: st });
  }

  function bedAction(act, s) {
    var b = bookingFor(s.id);
    if (act === 'walkin') { openModal(s, 'WALK-IN'); return; }
    if (act === 'booking') { openModal(s, 'ADVANCE'); return; }
    if (act === 'block') { state.status[s.id] = 'blocked'; toast(s.name + ' #' + s.num + ' blocked'); }
    if (act === 'release') { state.status[s.id] = 'free'; toast(s.name + ' #' + s.num + ' back on sale'); }
    if (act === 'checkin' && b) { b.status = 'checked'; state.status[s.id] = 'checked'; toast(b.guest + ' checked in — ' + b.pax + ' pax'); }
    if (act === 'undo' && b) { b.status = 'booked'; state.status[s.id] = 'booked'; toast('Check-in undone for ' + b.guest); }
    if (act === 'cancel' && b) {
      state.bookings.splice(state.bookings.indexOf(b), 1);
      state.status[s.id] = 'free';
      toast('Booking cancelled — #' + s.num + ' back on sale');
    }
    track('opdemo_action', { spot: s.id, act: act, status: state.status[s.id] });
    paint();
    openBed(s);
  }

  /* ===== reservations / guest list panel ============================= */

  function openList() {
    state.panel = 'list';
    var p = $('.cko-panel');
    var rows = state.bookings.filter(function (b) {
      if (state.listFilter === 'checked' && b.status !== 'checked') return false;
      if (!state.query) return true;
      var s = spot(b.spot);
      return (b.guest + ' ' + s.name + ' ' + s.num + ' ' + b.pkg).toLowerCase().indexOf(state.query) !== -1;
    });
    var title = state.listFilter === 'checked' ? 'Guest list — in house' : 'Reservations — ' + state.day + ' July';
    p.innerHTML =
      '<button type="button" class="cko-x" aria-label="Close">✕</button>' +
      '<h3 role="presentation">' + title + '</h3>' +
      (state.query ? '<p class="cko-sub">Matching “' + state.query + '”</p>' : '') +
      (rows.length ? rows.map(function (b) {
        var s = spot(b.spot);
        return '<div class="cko-row" data-oprow="' + b.spot + '">' +
          '<span class="cko-thumb sm" style="background-image:url(' + MAP_URL + ');background-position:' + s.x + '% ' + s.y + '%"></span>' +
          '<div><h5 role="presentation">' + b.guest + '</h5><p>' + s.name + ' #' + s.num + ' · ' + b.pax + ' pax</p>' +
          '<p>' + b.pkg + ' · prepaid ' + money(b.paid) + '</p></div>' +
          (b.status === 'checked'
            ? '<span class="cko-chip checked">In house</span>'
            : '<button type="button" class="cko-btn dark sm" data-opcheck="' + b.spot + '">Check in</button>') +
        '</div>';
      }).join('') : '<p class="cko-empty">Nothing matches — try another name or bed number.</p>');
    p.classList.add('open');
    $('.cko-x', p).addEventListener('click', closePanel);
    $$('[data-opcheck]', p).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var b = bookingFor(btn.getAttribute('data-opcheck'));
        b.status = 'checked'; state.status[b.spot] = 'checked';
        track('opdemo_quickcheck', { spot: b.spot });
        paint(); openList();
        toast(b.guest + ' checked in — ' + b.pax + ' pax');
      });
    });
    $$('[data-oprow]', p).forEach(function (row) {
      row.addEventListener('click', function () {
        var s = spot(row.getAttribute('data-oprow'));
        var el = $('[data-opid="' + s.id + '"]');
        el.classList.add('pulse');
        setTimeout(function () { el.classList.remove('pulse'); }, 1600);
      });
    });
  }

  function closePanel() {
    state.panel = null;
    $('.cko-panel').classList.remove('open');
    $$('.cko-seg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-seg') === 'map'); });
  }

  /* ===== Form Confirm Booking (walk-in / advance) ===================== */

  function openModal(s, type) {
    var m = $('.cko-modal');
    var walkin = type === 'WALK-IN';
    m.innerHTML =
      '<div class="cko-modal-head"><h3 role="presentation">Form Confirm Booking</h3>' +
      '<button type="button" class="cko-x" aria-label="Close">✕</button></div>' +
      '<div class="cko-modal-body">' +
      '<p class="cko-modal-sub">' + (walkin ? 'Walk-in Booking' : 'Advance Booking') + '<br><b>' + s.name + ' #' + s.num + '</b></p>' +
      '<label class="cko-field wide">Email <i>*</i><input type="email" value="guest@demo.club"></label>' +
      '<div class="cko-frow">' +
        '<label class="cko-field">TAB Number <i>*</i><input value="0' + s.num + '"></label>' +
        '<label class="cko-field">First Name <i>*</i><input data-fname value="Ayu"></label>' +
        '<label class="cko-field">Last Name<input value="Prasetyo"></label>' +
      '</div>' +
      '<div class="cko-frow">' +
        '<label class="cko-field">Gender <i>*</i><select><option>Female</option><option>Male</option><option>Prefer not to say</option></select></label>' +
        '<label class="cko-field">Date of Birth <i>*</i><input value="1997-04-12"></label>' +
      '</div>' +
      '<div class="cko-frow">' +
        '<label class="cko-field">Nationality <i>*</i><select><option>Indonesia</option><option>Australia</option><option>Singapore</option><option>United Kingdom</option><option>Other</option></select></label>' +
        '<label class="cko-field">Phone<input value="0812-345-678"></label>' +
      '</div>' +
      '<div class="cko-frow">' +
        '<label class="cko-field">Party size<select>' +
          Array.apply(null, Array(s.cap)).map(function (_, i) { return '<option' + (i + 1 === Math.min(2, s.cap) ? ' selected' : '') + '>' + (i + 1) + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="cko-field">Booking Type <i>*</i><select>' +
          '<option' + (walkin ? ' selected' : '') + '>WALK-IN</option>' +
          '<option' + (walkin ? '' : ' selected') + '>ADVANCE</option>' +
        '</select></label>' +
      '</div>' +
      '<label class="cko-field wide">Notes<textarea rows="2" placeholder="Allergies, occasion, host notes…"></textarea></label>' +
      '<div class="cko-agree">' +
        '<label><input type="checkbox" checked> I (and my group if any) agree to the general terms and conditions of Clubtech Beach Club</label>' +
        '<label><input type="checkbox" checked> I acknowledge and consent to be charged for all purchases placed on my Clubtech tab</label>' +
        '<label><input type="checkbox" checked> I (and my group if any) agree to the zero tolerance policy of Clubtech Beach Club</label>' +
        '<label><input type="checkbox" checked> Send mail &amp; receipt</label>' +
      '</div>' +
      '</div>' +
      '<div class="cko-modal-foot">' +
        '<button type="button" class="cko-btn line" data-close>✕ Close</button>' +
        '<button type="button" class="cko-btn dark" data-confirm>' + I.walk + ' ' + (walkin ? 'Walk In Booking' : 'Confirm Booking') + '</button>' +
      '</div>';
    $('.cko-scrim').classList.add('open');
    $('.cko-x', m).addEventListener('click', closeModal);
    $('[data-close]', m).addEventListener('click', closeModal);
    $('[data-confirm]', m).addEventListener('click', function () {
      var guest = ($('[data-fname]', m).value || 'Walk-in guest') + ' ' + (m.querySelectorAll('input')[3].value || '');
      var pax = +$$('select', m)[2].value || 2;
      var b = { spot: s.id, guest: guest.trim(), pax: pax, pkg: walkin ? 'Walk-in · Bed Only' : 'Bed + Party Package', paid: walkin ? 180 : 250, status: walkin ? 'checked' : 'booked', type: walkin ? 'Walk-in' : 'Host stand' };
      state.bookings.push(b);
      state.status[s.id] = b.status;
      closeModal();
      paint();
      openBed(s);
      toast(walkin ? guest + ' walked in — #' + s.num + ' · ' + pax + ' pax' : 'Booking confirmed for ' + guest + ' — #' + s.num);
      track('opdemo_confirm', { spot: s.id, type: type });
    });
    track('opdemo_form', { spot: s.id, type: type });
  }

  function closeModal() { $('.cko-scrim').classList.remove('open'); }

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('.cko-scrim.open')) closeModal();
    else if ($('.cko-panel.open')) closePanel();
  });

  build();

  /* ===== initial state per mount ===================================== */

  (function init() {
    if (OPTS.view === 'bookings') {
      state.listFilter = 'all';
      openList();
      $$('.cko-seg button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-seg') === 'all'); });
    }
    if (OPTS.view === 'select') {
      toggleMulti();
      state.selected.db3 = true;
      state.selected.db5 = true;
      paint();
    }
    if (OPTS.view === 'walkin') {
      openBed(spot('db8'));
      openModal(spot('db8'), 'WALK-IN');
    }
  })();
  }
})();
