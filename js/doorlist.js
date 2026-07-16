/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — door list & VMS check-in demo (.ckdl)

   Front-of-house companion to the operator console (js/operator.js): same
   design language, same generic demo venue, viewed from the host stand at
   the door. One reconciled door list — reservations, event tickets,
   promoter lists and priority/free-entry registrations folded into a single
   screen (not five separate lists), with whole-party capture, QR check-in
   and a live arrived count that matches the count sold.

   Mount: <div class="ckdl" data-doordemo="list|checkin|soldout">.
   All state is local and deterministic — no payment, no network.
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-doordemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/doorlist.js';
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/doorlist\.js.*$/, 'brand/clubtech-mark-black-96.png');

  mounts.forEach(function (m) { createDoor(m); });

  function createDoor(root) {
  var OPTS = {
    view: root.getAttribute('data-doordemo') || 'list',
    badge: root.getAttribute('data-doordemo-badge') || ''
  };

  /* ===== source metadata ============================================== */

  var SOURCES = {
    reservation: { label: 'Reservation', short: 'Reservations', cls: 'res', dot: '#415ee2' },
    ticket:      { label: 'Event ticket', short: 'Tickets', cls: 'tkt', dot: '#7c3aed' },
    promoter:    { label: 'Promoter list', short: 'Promoters', cls: 'pro', dot: '#e0951f' },
    priority:    { label: 'Priority', short: 'Priority', cls: 'pri', dot: '#22c55e' }
  };
  var FILTERS = ['all', 'reservation', 'ticket', 'promoter', 'priority'];
  var DAYS = [16, 17, 18, 19, 20];
  var CAPACITY = 80;

  /* ===== deterministic party data ===================================== */

  var seq = 20;

  function party(id, source, dest, sub, ref, names, inCount) {
    var members = names.map(function (n, i) {
      return { name: n, in: i < inCount, pending: false };
    });
    return { id: id, source: source, dest: dest, sub: sub, ref: ref, members: members };
  }

  /* Interleaved so every source and status is visible in one screen —
     the whole point is one list, not five. */
  var state = {
    day: 18,
    filter: 'all',
    query: '',
    panel: null,
    activeId: null,
    soldout: false,
    parties: [
      party('p1', 'reservation', 'VIP Cabana #12', 'Prepaid $680', 'CT-4021',
        ['Maya Chen', 'Theo Park', 'Isla Reed', 'Ben Costa', 'Nadia Idris', 'Sam Voss'], 4),
      party('p2', 'ticket', 'General admission', 'GA ticket', 'TX-2207',
        ['Lucas Ferreira', 'Bianca Alves'], 2),
      party('p3', 'promoter', 'Guest list', 'Promoter · House', 'PL-118',
        ['Elena Rossi', 'Gio Bruno', 'Vera Neri', 'Luca Ferri'], 4),
      party('p4', 'priority', 'Priority entry', 'Free entry', 'PR-061',
        ['Omar Haddad', 'Layla Nasser', 'Sami Khoury', 'Dana Aziz'], 0),
      party('p5', 'reservation', 'VIP Cabana #14', 'Prepaid $680', 'CT-4150',
        ['Hannah Weiss', 'Jonas Kraus', 'Lea Fischer', 'Max Vogel', 'Emma Roth', 'Finn Weber', 'Clara Hahn', 'Paul Braun'], 3),
      party('p6', 'ticket', 'General admission', 'GA ticket', 'TX-2231',
        ['Priya Anand', 'Ravi Menon', 'Anita Pillai'], 0),
      party('p7', 'promoter', 'Guest list', 'Promoter · Neon', 'PL-132',
        ['Marcus Cole', 'Zara Blake', 'Devon Pryce', 'Aria Quinn', 'Toby Frost'], 2),
      party('p8', 'priority', 'Priority entry', 'Free entry', 'PR-057',
        ['Yuki Tanaka', 'Ren Sato'], 2),
      party('p9', 'reservation', 'Pool Club Bed #652', 'Prepaid $250', 'CT-4098',
        ['Daniel Okafor', 'Ruth Adeyemi', 'Kofi Mensah', 'Lena Bauer'], 4),
      party('p10', 'ticket', 'General admission', 'GA ticket', 'TX-2244',
        ['Noah Bennett', 'Chloe Hart'], 0),
      party('p11', 'reservation', 'Beachfront Bale #22', 'Prepaid $250', 'CT-4110',
        ['Sofia Marino', 'Marco Ricci', 'Elsa Lund', 'Pia Conti', 'Nils Berg', 'Tomas Vidal'], 0),
      party('p12', 'reservation', 'Sunset Deck #05', 'Prepaid $520', 'CT-4133',
        ['Arjun Nair', 'Divya Rao', 'Kiran Shah', 'Meera Iyer', 'Rohan Das'], 5),
      party('p13', 'priority', 'Priority entry', 'Free entry', 'PR-063',
        ['Grace Lim', 'Wei Ong'], 0)
    ]
  };

  /* A few guests still supplying their own details from the booker's
     invite — the whole-party capture flow in progress. */
  state.parties[4].members[6].pending = true;
  state.parties[4].members[7].pending = true;
  state.parties[10].members[5].pending = true;

  /* ===== helpers ====================================================== */

  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || root).querySelectorAll(sel)); }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function track(n, p) { try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {} }

  function partyById(id) { return state.parties.filter(function (p) { return p.id === id; })[0]; }
  function metaPair(p) {
    if (p.source === 'reservation') return { label: 'Payment', value: p.sub };
    if (p.source === 'ticket') return { label: 'Admission', value: p.sub };
    if (p.source === 'promoter') return { label: 'Via promoter', value: p.sub.replace('Promoter · ', '') };
    return { label: 'Entry', value: p.sub };
  }
  function lead(p) { return p.members[0].name; }
  function pax(p) { return p.members.length; }
  function arrivedOf(p) { var n = 0; p.members.forEach(function (m) { if (m.in) n++; }); return n; }
  function statusOf(p) { var a = arrivedOf(p); if (a === 0) return 'expected'; if (a >= pax(p)) return 'arrived'; return 'partial'; }
  function initials(name) { var w = name.split(' '); return (w[0].charAt(0) + (w[1] ? w[1].charAt(0) : '')).toUpperCase(); }

  function totals() {
    var onList = 0, arrived = 0;
    state.parties.forEach(function (p) { onList += pax(p); arrived += arrivedOf(p); });
    return { onList: onList, arrived: arrived };
  }
  function sourceGuests(src) {
    var g = 0;
    state.parties.forEach(function (p) { if (src === 'all' || p.source === src) g += pax(p); });
    return g;
  }

  var I = {
    logo: '<img src="' + BRAND_MARK + '" alt="">',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c1-3 3.1-4.5 5.5-4.5s4.5 1.5 5.5 4.5M15.5 6a3 3 0 0 1 0 5.4M17 15.4c1.8.6 3 2 3.7 4.1"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><path d="M13.5 13.5h3v3M20.5 16.5v4M16.5 20.5h4"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* Deterministic QR-style block (decorative — not a scannable code). */
  function qrSvg(seedRef) {
    var N = 25, unit = 8, pad = 0, size = N * unit;
    var seed = 0, i;
    for (i = 0; i < seedRef.length; i++) seed = (seed * 31 + seedRef.charCodeAt(i)) & 0x7fffffff;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed >>> 9) / 4194304 % 1; }
    function finder(x, y) {
      return (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
    }
    var r = '';
    for (var yy = 0; yy < N; yy++) for (var xx = 0; xx < N; xx++) {
      if (finder(xx, yy)) continue;
      if (rnd() > 0.55) r += '<rect x="' + (pad + xx * unit) + '" y="' + (pad + yy * unit) + '" width="' + unit + '" height="' + unit + '"/>';
    }
    function eye(ox, oy) {
      var s = '';
      s += '<rect x="' + (ox * unit) + '" y="' + (oy * unit) + '" width="' + (7 * unit) + '" height="' + (7 * unit) + '" rx="' + (unit) + '"/>';
      s += '<rect x="' + ((ox + 1) * unit) + '" y="' + ((oy + 1) * unit) + '" width="' + (5 * unit) + '" height="' + (5 * unit) + '" rx="' + (unit * 0.6) + '" fill="#fff"/>';
      s += '<rect x="' + ((ox + 2) * unit) + '" y="' + ((oy + 2) * unit) + '" width="' + (3 * unit) + '" height="' + (3 * unit) + '" rx="' + (unit * 0.4) + '"/>';
      return s;
    }
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" fill="#0f172a">' +
      r + eye(0, 0) + eye(N - 7, 0) + eye(0, N - 7) + '</svg>';
  }

  /* ===== shell ======================================================== */

  function build() {
    root.innerHTML = '';

    /* toolbar */
    var bar = h('div', 'ckdl-bar');
    bar.appendChild(h('span', 'ckdl-logo', I.logo));
    bar.appendChild(h('div', 'ckdl-title', '<b>Door list</b><span>Guest lists &amp; VMS</span>'));
    var dp = h('button', 'ckdl-datepill', I.cal + '<span data-doordate>' + state.day + ' July 2026</span>');
    dp.type = 'button';
    dp.setAttribute('aria-label', 'Choose service date');
    bar.appendChild(dp);
    var search = h('div', 'ckdl-search', I.search + '<input type="text" placeholder="Guest, party or booking ref" aria-label="Search the door list">');
    bar.appendChild(search);
    bar.appendChild(h('span', 'ckdl-livepill', '<i class="live"></i>In house <b data-doorlive>0</b><em data-doorlivetot>/ 0</em>'));
    root.appendChild(bar);

    /* day-strip popover */
    var daypop = h('div', 'ckdl-daypop',
      DAYS.map(function (d) {
        return '<button type="button" data-doorday="' + d + '" class="' + (d === state.day ? 'sel' : '') + '"><b>' + d + '</b><span>Jul</span></button>';
      }).join(''));
    root.appendChild(daypop);
    dp.addEventListener('click', function (e) { e.stopPropagation(); daypop.classList.toggle('open'); });
    $$('[data-doorday]', daypop).forEach(function (b) {
      b.addEventListener('click', function () {
        state.day = +b.getAttribute('data-doorday');
        $$('[data-doorday]', daypop).forEach(function (x) { x.classList.toggle('sel', x === b); });
        $$('[data-doordate]').forEach(function (x) { x.textContent = state.day + ' July 2026'; });
        daypop.classList.remove('open');
        toast('Showing door list for ' + state.day + ' July 2026');
      });
    });
    root.addEventListener('click', function () { daypop.classList.remove('open'); });

    /* reconciliation strip — sources folded into one list + capacity meter */
    var recon = h('div', 'ckdl-recon');
    recon.appendChild(h('span', 'ckdl-recon-h', 'One reconciled list'));
    var fc = h('div', 'ckdl-srcfilter');
    FILTERS.forEach(function (f) {
      var meta = SOURCES[f];
      var b = h('button', 'ckdl-fc');
      b.type = 'button';
      b.setAttribute('data-doorfilter', f);
      b.innerHTML = (meta ? '<i class="dot" style="background:' + meta.dot + '"></i>' : '') +
        (f === 'all' ? 'All' : meta.short) + ' <b data-doorcount="' + f + '">0</b>';
      b.addEventListener('click', function () {
        state.filter = f;
        paint();
        track('doordemo_filter', { source: f });
      });
      fc.appendChild(b);
    });
    recon.appendChild(fc);
    recon.appendChild(h('div', 'ckdl-cap',
      '<div class="ckdl-cap-top"><span>Capacity</span><b data-doorcap>0 / ' + CAPACITY + ' sold</b></div>' +
      '<div class="ckdl-meter"><span class="sold" data-doormeter-sold></span><span class="in" data-doormeter-in></span></div>' +
      '<div class="ckdl-cap-key"><span><i class="in"></i>in house</span><span><i class="sold"></i>sold</span></div>'));
    root.appendChild(recon);

    /* list surface: sticky column header + rows */
    var list = h('div', 'ckdl-list');
    list.appendChild(h('div', 'ckdl-hrow',
      '<span></span><span>Guest &amp; party</span><span>Source</span><span>Destination</span><span>Arrived</span>'));
    list.appendChild(h('div', 'ckdl-rows'));
    root.appendChild(list);

    /* party panel, check-in modal, toast */
    root.appendChild(h('div', 'ckdl-panel'));
    var scrim = h('div', 'ckdl-scrim');
    scrim.addEventListener('click', function (e) { if (e.target === scrim) closeModal(); });
    var modal = h('div', 'ckdl-modal');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Door check-in');
    scrim.appendChild(modal);
    root.appendChild(scrim);
    var toastEl = h('div', 'ckdl-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    root.appendChild(toastEl);

    if (OPTS.badge) {
      var bhost = h('div', 'demo-badge-host');
      root.parentNode.insertBefore(bhost, root);
      bhost.appendChild(root);
      bhost.appendChild(h('div', 'ckdl-badge right', '<i></i>' + esc(OPTS.badge)));
    }

    var inp = $('input', search);
    inp.addEventListener('input', function () {
      state.query = inp.value.trim().toLowerCase();
      paint();
    });

    function sizeMode() { root.classList.toggle('tiny', root.clientWidth < 520); }
    sizeMode();
    if (window.ResizeObserver) new ResizeObserver(sizeMode).observe(root);

    paint();
  }

  /* ===== paint ======================================================== */

  function paint() {
    var t = totals();

    $$('[data-doorlive]').forEach(function (x) { x.textContent = t.arrived; });
    $$('[data-doorlivetot]').forEach(function (x) { x.textContent = '/ ' + t.onList; });

    FILTERS.forEach(function (f) {
      var el = $('[data-doorcount="' + f + '"]');
      if (el) el.textContent = sourceGuests(f);
      var btn = $('[data-doorfilter="' + f + '"]');
      if (btn) btn.classList.toggle('on', state.filter === f);
    });

    var soldPct = Math.min(100, Math.round(t.onList / CAPACITY * 100));
    var inPct = Math.min(100, Math.round(t.arrived / CAPACITY * 100));
    var mSold = $('[data-doormeter-sold]'); if (mSold) mSold.style.width = soldPct + '%';
    var mIn = $('[data-doormeter-in]'); if (mIn) mIn.style.width = inPct + '%';
    var cap = $('[data-doorcap]'); if (cap) cap.textContent = t.onList + ' / ' + CAPACITY + ' sold';

    var rowsHost = $('.ckdl-rows');
    rowsHost.innerHTML = '';

    if (state.soldout) rowsHost.appendChild(soldoutBlock());

    var rows = state.parties.filter(function (p) {
      if (state.filter !== 'all' && p.source !== state.filter) return false;
      if (!state.query) return true;
      var hay = (p.members.map(function (m) { return m.name; }).join(' ') + ' ' + p.dest + ' ' + p.ref + ' ' + SOURCES[p.source].label).toLowerCase();
      return hay.indexOf(state.query) !== -1;
    });

    if (!rows.length) {
      rowsHost.appendChild(h('p', 'ckdl-empty', 'Nothing matches — try another name, party or booking ref.'));
    }

    rows.forEach(function (p) {
      var st = statusOf(p), a = arrivedOf(p), n = pax(p), src = SOURCES[p.source];
      var row = h('div', 'ckdl-row ' + st);
      row.setAttribute('data-doorrow', p.id);
      var extra = n > 1 ? '<em>+' + (n - 1) + '</em>' : '';
      row.innerHTML =
        '<button type="button" class="ckdl-check" data-doorcheck="' + p.id + '" aria-label="Check in ' + esc(lead(p)) + '">' + (st === 'arrived' ? I.check : '') + '</button>' +
        '<div class="ckdl-guest"><span class="ckdl-ava">' + esc(initials(lead(p))) + '</span>' +
          '<div><h5>' + esc(lead(p)) + ' ' + extra + '</h5><p>Party of ' + n + ' · ref ' + esc(p.ref) + '</p></div></div>' +
        '<span class="ckdl-src ' + src.cls + '">' + src.label + '</span>' +
        '<div class="ckdl-dest"><b>' + esc(p.dest) + '</b><span>' + esc(p.sub) + '</span></div>' +
        arrivedCell(st, a, n);
      rowsHost.appendChild(row);

      $('[data-doorcheck]', row).addEventListener('click', function (e) {
        e.stopPropagation();
        toggleParty(p);
      });
      row.addEventListener('click', function () { openParty(p.id); });
    });
  }

  function statusChip(st, a, n) {
    if (st === 'arrived') return '<span class="ckdl-chip arrived">All in</span>';
    if (st === 'partial') return '<span class="ckdl-chip partial">' + a + ' of ' + n + ' in</span>';
    return '<span class="ckdl-chip expected">Expected</span>';
  }

  function arrivedCell(st, a, n) {
    var word = st === 'arrived' ? 'All in' : st === 'partial' ? 'Partly in' : 'Expected';
    return '<div class="ckdl-arr ' + st + '">' +
      '<div class="ckdl-arr-top"><b>' + a + ' / ' + n + '</b><span>' + word + '</span></div>' +
      '<i><b style="width:' + Math.round(a / n * 100) + '%"></b></i></div>';
  }

  /* ===== live toast =================================================== */

  var toastId = null;
  function toast(msg) {
    var el = $('.ckdl-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if (toastId) clearTimeout(toastId);
    toastId = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  /* ===== check-in actions ============================================= */

  function toggleParty(p) {
    var full = statusOf(p) === 'arrived';
    p.members.forEach(function (m) { m.in = !full; if (!full && m.pending) { m.pending = false; } });
    paint();
    if (state.panel === 'party' && state.activeId === p.id) openParty(p.id);
    toast(full ? 'Check-in undone for ' + lead(p) : lead(p) + ' — whole party checked in (' + pax(p) + ')');
    track('doordemo_check', { party: p.id, to: full ? 'out' : 'in' });
  }

  function setMember(p, idx, on) {
    p.members[idx].in = on;
    if (on) p.members[idx].pending = false;
    paint();
  }

  /* ===== party panel (whole-party capture) ============================ */

  function openParty(id) {
    var p = partyById(id);
    if (!p) return;
    state.panel = 'party';
    state.activeId = id;
    var st = statusOf(p), a = arrivedOf(p), n = pax(p), src = SOURCES[p.source];
    var awaiting = p.members.filter(function (m) { return m.pending; }).length;
    var pnl = $('.ckdl-panel');

    var roster = p.members.map(function (m, i) {
      return '<div class="ckdl-mem' + (m.in ? ' in' : '') + '" data-doormem="' + i + '">' +
        '<button type="button" class="ckdl-memtoggle" data-doormemtog="' + i + '" aria-label="Toggle ' + esc(m.name) + '">' + (m.in ? I.check : '') + '</button>' +
        '<span class="ckdl-ava sm">' + esc(initials(m.name)) + '</span>' +
        '<div class="mx"><h6>' + esc(m.name) + (i === 0 ? ' <em>Lead</em>' : '') + '</h6>' +
        '<p class="' + (m.pending ? 'wait' : 'ok') + '">' + (m.pending ? 'Awaiting their details' : 'Details on file') + '</p></div>' +
        '<span class="ckdl-memstate">' + (m.in ? 'In' : '') + '</span>' +
      '</div>';
    }).join('');

    pnl.innerHTML =
      '<button type="button" class="ckdl-x" aria-label="Close">✕</button>' +
      '<h3>' + esc(lead(p)) + (n > 1 ? ' <em>+' + (n - 1) + '</em>' : '') + '</h3>' +
      '<p class="ckdl-psub"><span class="ckdl-src ' + src.cls + '">' + src.label + '</span> ' + statusChip(st, a, n) + '</p>' +
      '<div class="ckdl-pmeta"><div><span>Destination</span><b>' + esc(p.dest) + '</b></div>' +
        '<div><span>' + esc(metaPair(p).label) + '</span><b>' + esc(metaPair(p).value) + '</b></div>' +
        '<div><span>Booking ref</span><b>' + esc(p.ref) + '</b></div></div>' +
      '<div class="ckdl-rosterhead"><b>Whole party</b><span>' + a + ' of ' + n + ' in' + (awaiting ? ' · ' + awaiting + ' awaiting details' : '') + '</span></div>' +
      '<p class="ckdl-rosternote">The booker invited their group — each guest supplies their own details, so you capture the whole party, not just the payer.</p>' +
      '<div class="ckdl-roster">' + roster + '</div>' +
      '<div class="ckdl-pfoot">' +
        (st === 'arrived'
          ? '<button type="button" class="ckdl-btn line" data-doorundo>Undo check-in</button>'
          : '<button type="button" class="ckdl-btn dark" data-doorall>' + I.check + ' Check in whole party</button>') +
      '</div>';

    pnl.classList.add('open');
    $('.ckdl-x', pnl).addEventListener('click', closePanel);
    $$('[data-doormemtog]', pnl).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = +btn.getAttribute('data-doormemtog');
        setMember(p, i, !p.members[i].in);
        openParty(id);
      });
    });
    var allBtn = $('[data-doorall]', pnl);
    if (allBtn) allBtn.addEventListener('click', function () { toggleParty(p); });
    var undoBtn = $('[data-doorundo]', pnl);
    if (undoBtn) undoBtn.addEventListener('click', function () { toggleParty(p); });
    track('doordemo_party', { party: id, status: st });
  }

  function closePanel() {
    state.panel = null;
    state.activeId = null;
    $('.ckdl-panel').classList.remove('open');
  }

  /* ===== QR check-in modal ============================================ */

  function openCheckin(id) {
    var p = partyById(id);
    if (!p) return;
    var m = $('.ckdl-modal');
    var st = statusOf(p), a = arrivedOf(p), n = pax(p), src = SOURCES[p.source];
    var t = totals();

    var roster = p.members.map(function (mm, i) {
      return '<span class="ckdl-qmem' + (mm.in ? ' in' : '') + '">' +
        '<i>' + (mm.in ? I.check : '') + '</i>' + esc(mm.name.split(' ')[0]) + '</span>';
    }).join('');

    m.innerHTML =
      '<div class="ckdl-modal-head"><h3>Door check-in</h3>' +
        '<button type="button" class="ckdl-x" aria-label="Close">✕</button></div>' +
      '<div class="ckdl-modal-body">' +
        '<div class="ckdl-qrwrap"><div class="ckdl-qr">' + qrSvg(p.ref) + '</div>' +
          '<span class="ckdl-qrtag">' + I.qr + ' Scanned at door · ' + esc(p.ref) + '</span></div>' +
        '<div class="ckdl-qmatch">' +
          '<span class="ckdl-ava lg">' + esc(initials(lead(p))) + '</span>' +
          '<div><h4>' + esc(lead(p)) + (n > 1 ? ' <em>+' + (n - 1) + '</em>' : '') + '</h4>' +
          '<p><span class="ckdl-src ' + src.cls + '">' + src.label + '</span> · ' + esc(p.dest) + '</p></div>' +
          '<span class="ckdl-chip ' + st + '">' + (st === 'arrived' ? 'All in' : st === 'partial' ? a + ' of ' + n + ' in' : 'Party of ' + n) + '</span>' +
        '</div>' +
        '<p class="ckdl-qroster-h">Whole party on this pass</p>' +
        '<div class="ckdl-qroster">' + roster + '</div>' +
        '<div class="ckdl-qcount"><span>In house now</span><b data-doorlive>' + t.arrived + '</b><em data-doorlivetot>/ ' + t.onList + '</em></div>' +
      '</div>' +
      '<div class="ckdl-modal-foot">' +
        (st === 'arrived'
          ? '<button type="button" class="ckdl-btn line" data-close>Close</button>' +
            '<button type="button" class="ckdl-btn done" disabled>' + I.check + ' Checked in</button>'
          : '<button type="button" class="ckdl-btn line" data-close>Close</button>' +
            '<button type="button" class="ckdl-btn dark" data-doorscan>' + I.check + ' Check in whole party</button>') +
      '</div>';

    $('.ckdl-scrim').classList.add('open');
    $('.ckdl-x', m).addEventListener('click', closeModal);
    $('[data-close]', m).addEventListener('click', closeModal);
    var scan = $('[data-doorscan]', m);
    if (scan) scan.addEventListener('click', function () {
      p.members.forEach(function (mm) { mm.in = true; mm.pending = false; });
      paint();
      openCheckin(id);
      toast(lead(p) + ' — whole party checked in (' + n + ')');
      track('doordemo_scan', { party: id });
    });
    track('doordemo_checkin_open', { party: id });
  }

  function closeModal() { $('.ckdl-scrim').classList.remove('open'); }

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if ($('.ckdl-scrim.open')) closeModal();
    else if ($('.ckdl-panel.open')) closePanel();
  });

  /* ===== sold-out priority capture ==================================== */

  function soldoutBlock() {
    var wrap = h('div', 'ckdl-soldwrap');
    wrap.appendChild(h('div', 'ckdl-sold',
      '<span class="ic">' + I.bolt + '</span>' +
      '<div><h4>VIP Cabanas · Pool Club · Beachfront — sold out</h4>' +
      '<p>Furniture is off sale. Guests still register for priority and free entry — every registration lands on this same door list. Sold out is a list, not a dead end.</p></div>'));

    var cap = h('div', 'ckdl-capture');
    cap.innerHTML =
      '<label class="ckdl-cfield grow">Guest name<input type="text" value="Amara Diallo" data-doorcapname></label>' +
      '<label class="ckdl-cfield">Party<select data-doorcapsize>' +
        '<option>1</option><option selected>2</option><option>3</option><option>4</option><option>5</option><option>6</option></select></label>' +
      '<label class="ckdl-cfield">Mobile<input type="text" value="+61 400 118 220" data-doorcapphone></label>' +
      '<button type="button" class="ckdl-btn dark sm" data-doorcapadd>' + I.plus + ' Add to priority list</button>';
    wrap.appendChild(cap);

    $('[data-doorcapadd]', cap).addEventListener('click', function () {
      var name = ($('[data-doorcapname]', cap).value || '').trim() || 'Priority guest';
      var size = +$('[data-doorcapsize]', cap).value || 1;
      seq++;
      var names = [name];
      for (var i = 1; i < size; i++) names.push('Guest ' + i);
      var np = party('p' + seq, 'priority', 'Priority entry', 'Free entry', 'PR-0' + (60 + seq), names, 0);
      for (var j = 1; j < np.members.length; j++) np.members[j].pending = true;
      state.parties.push(np);
      state.filter = 'priority';
      paint();
      toast(name + ' added to the priority list — party of ' + size);
      track('doordemo_priority_add', { size: size });
    });
    return wrap;
  }

  build();

  /* ===== initial state per mount ====================================== */

  (function init() {
    if (OPTS.view === 'checkin') {
      openCheckin('p6');
    }
    if (OPTS.view === 'soldout') {
      state.soldout = true;
      state.filter = 'priority';
      paint();
    }
  })();
  }
})();
