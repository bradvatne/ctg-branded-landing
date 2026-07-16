/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — Events & Ticketing demo (.cke)

   Guest-facing companion to the reservations booking demo (js/demo.js) and
   the operator console (js/operator.js): same design language, same generic
   demo venue (Pool Club / VIP Cabana / Sunset Deck), viewed as an event
   ticketing page. Native events + ticketing on the platform that already
   runs reservations:

     tickets  → event page: tiered ticket cards, date + lineup, quantity
                steppers, and priority-list capture on a sold-out tier
     upgrade  → the ticket→table upgrade step, inside the same checkout
     checkout → order review: tickets + optional table, tax/fee summary,
                QR check-in, shared guest database
     (confirm → deterministic QR success; reached only by interaction)

   Mount: <div class="cke" data-eventdemo="tickets|upgrade|checkout">.
   All state is LOCAL and deterministic — no payment, no network, no libs.
   Analytics delegated to window.CTGTrack when present.
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-eventdemo]'));
  if (!mounts.length) return;

  /* asset paths relative to this script, so mounts work from any page depth */
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/events.js';
  var ASSET_BASE = SCRIPT_SRC.replace(/js\/events\.js.*$/, 'assets/demo/');
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/events\.js.*$/, 'brand/clubtech-mark-black-96.png');
  var POSTER = ASSET_BASE + 'promo-vip.jpg';

  mounts.forEach(function (m) { createEventDemo(m); });

  function createEventDemo(root) {
  var OPTS = {
    view: root.getAttribute('data-eventdemo') || 'tickets',
    badge: root.getAttribute('data-eventdemo-badge') || ''
  };

  /* ===== event + ticket data (demo only) ============================== */

  var EVENT = {
    name: 'Neon Horizon',
    tagline: 'Sunset Session',
    date: 'Saturday 18 July 2026',
    doors: 'Doors 4 PM until late',
    venue: 'Pool Club · Sunset Deck',
    age: 'Adults only, 18 and over'
  };

  var LINEUP = [
    { time: '4 PM', act: 'Sunset session' },
    { time: '7 PM', act: 'Live percussion' },
    { time: '10 PM', act: 'Headline set' }
  ];

  /* tiered tickets — early-bird sold out (drives the priority-list capture),
     general admission + VIP on sale; the table tier is the upgrade path */
  var TIERS = [
    { id: 'early', name: 'Early Bird', price: 30, note: 'Venue entry from 4 PM', tag: 'Sold out', soldout: true },
    { id: 'ga', name: 'General Admission', price: 45, note: 'Venue entry, party zones and dance floor' },
    { id: 'vip', name: 'VIP Entry', price: 90, note: 'Fast-track entry, welcome cocktail, VIP deck access', tag: '12 remaining', best: true }
  ];

  var TABLES = [
    { id: 'cabana', name: 'VIP Cabana', price: 650, cap: 8, credit: 200, note: 'Private cabana, bottle service, priority entry' },
    { id: 'bed', name: 'Pool Club Bed', price: 420, cap: 4, credit: 120, note: 'Reserved daybed with poolside service' },
    { id: 'deck', name: 'Sunset Deck Table', price: 900, cap: 10, credit: 300, note: 'Deck-front table, dedicated host, best views' }
  ];

  var TAX = 0.1, FEE = 9;

  /* ===== state ======================================================== */

  var state = {
    view: OPTS.view,
    qty: { ga: 0, vip: 0 },
    table: null,       // table id, or null for tickets only
    priority: false    // joined the sold-out priority list
  };

  /* ===== helpers ====================================================== */

  function track(n, p) { try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {} }
  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || root).querySelectorAll(sel)); }
  function money(n) { return '$' + n.toLocaleString('en-US'); }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }

  function tier(id) { return TIERS.filter(function (t) { return t.id === id; })[0]; }
  function tableById(id) { return TABLES.filter(function (t) { return t.id === id; })[0]; }
  function ticketCount() { return state.qty.ga + state.qty.vip; }
  function ticketSubtotal() { return state.qty.ga * tier('ga').price + state.qty.vip * tier('vip').price; }
  function tablePrice() { return state.table ? tableById(state.table).price : 0; }
  function subtotal() { return ticketSubtotal() + tablePrice(); }
  function tax() { return Math.round(subtotal() * TAX); }
  function fee() { return subtotal() ? FEE : 0; }
  function grand() { return subtotal() + tax() + fee(); }

  function ticketLabel() {
    var parts = [];
    if (state.qty.ga) parts.push(state.qty.ga + ' General Admission');
    if (state.qty.vip) parts.push(state.qty.vip + ' VIP');
    if (!parts.length) return 'tickets';
    return parts.join(' and ') + ' ticket' + (ticketCount() > 1 ? 's' : '');
  }
  function summaryLabel() {
    var n = ticketCount(), bits = [];
    if (n) bits.push(n + ' ticket' + (n > 1 ? 's' : ''));
    if (state.table) bits.push(tableById(state.table).name);
    return bits.length ? bits.join(' + ') : 'No tickets yet';
  }

  /* ===== icons ======================================================== */

  var I = {
    logo: '<img src="' + BRAND_MARK + '" alt="">',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s6.5-5.6 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.4 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.4"/></svg>',
    pax: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c1-3 3.1-4.5 5.5-4.5s4.5 1.5 5.5 4.5M15.5 6a3 3 0 0 1 0 5.4M17 15.4c1.8.6 3 2 3.7 4.1"/></svg>',
    ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3.5 9V7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5V9a2 2 0 0 0 0 4v1.5A1.5 1.5 0 0 1 19 16H5a1.5 1.5 0 0 1-1.5-1.5V13a2 2 0 0 0 0-4Z"/><path d="M14 6v10" stroke-dasharray="1.6 2.2"/></svg>',
    bed: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M5 10V7a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 19 7v3"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/></svg>',
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="m8 12 2.5 2.5L16.5 9"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 6v12M6 12h12"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M6 12h12"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 9.5a6 6 0 0 1 12 0c0 4.3 1.7 5.5 1.7 5.5H4.3S6 13.8 6 9.5Z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="m5 12.5 4.5 4.5L19 7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>',
    chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11.5v4.5"/><circle cx="12" cy="7.9" r="1.05" fill="currentColor" stroke="none"/></svg>',
    cup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 8h10v4a5 5 0 0 1-10 0V8Z"/><path d="M16 9h2.3a1.5 1.5 0 0 1 0 3H16"/><path d="M6.5 20.5h9"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 3h7v7H3V3Zm2 2v3h3V5H5Zm9-2h7v7h-7V3Zm2 2v3h3V5h-3ZM3 14h7v7H3v-7Zm2 2v3h3v-3H5Zm11-2h2v2h-2v-2Zm3 0h2v2h-2v-2Zm-3 3h2v2h-2v-2Zm0 3h2v2h-2v-2Zm3-3h2v5h-2v-5Z"/></svg>'
  };

  /* decorative, deterministic QR — not scannable, demo only */
  function bigQR() {
    var n = 25, m = [], x, y, seed = 987654321;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    for (y = 0; y < n; y++) { m[y] = []; for (x = 0; x < n; x++) m[y][x] = 0; }
    function inFinder(px, py) {
      function box(bx, by) { return px >= bx && px < bx + 7 && py >= by && py < by + 7; }
      return box(0, 0) || box(n - 7, 0) || box(0, n - 7);
    }
    for (y = 1; y < n - 1; y++) for (x = 1; x < n - 1; x++) { if (!inFinder(x, y) && rnd() > 0.5) m[y][x] = 1; }
    function finder(ox, oy) {
      for (var i = 0; i < 7; i++) for (var j = 0; j < 7; j++) {
        var edge = i === 0 || i === 6 || j === 0 || j === 6;
        var core = i >= 2 && i <= 4 && j >= 2 && j <= 4;
        m[oy + i][ox + j] = (edge || core) ? 1 : 0;
      }
    }
    finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
    var r = '';
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (m[y][x]) r += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    return '<svg viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" fill="#0f172a">' + r + '</svg>';
  }

  /* ===== chrome ======================================================= */

  function stepper(active) {
    var steps = [['Tickets', 'ticket'], ['Table upgrade', 'bed'], ['Checkout', 'doc'], ['Confirm', 'tick']];
    return steps.map(function (s, i) {
      return '<span class="' + (i === active ? 'on' : '') + '">' + I[s[1]] + '<u>' + s[0] + '</u></span>' + (i < 3 ? '<i></i>' : '');
    }).join('');
  }

  function appbar(step) {
    return '<div class="cke-appbar">' +
      '<button type="button" class="cke-logo" data-home aria-label="Back to event tickets">' + I.logo + '</button>' +
      '<div class="cke-datepill">' + I.cal + '<span>' + EVENT.date + '</span></div>' +
      '<div class="cke-stepper">' + stepper(step) + '</div>' +
      '<div class="cke-cluster"><span class="cke-count" aria-label="Tickets selected">' + I.ticket + '<b>' + ticketCount() + '</b></span></div>' +
    '</div>';
  }

  function bar(o) {
    return '<div class="cke-bar">' +
      (o.back ? '<button type="button" class="cke-back" data-back="' + o.back + '">' + I.chevL + 'Back</button>' : '') +
      '<div class="cke-bar-tot"><span>' + summaryLabel() + '</span><b>' + money(grand()) + '</b></div>' +
      '<button type="button" class="cke-cta" data-cta="' + o.action + '">' + o.label + '</button>' +
    '</div>';
  }

  /* ===== render dispatch ============================================== */

  function render() {
    root.innerHTML = '';
    var surf = h('div', 'cke-surface');
    root.appendChild(surf);
    if (state.view === 'upgrade') renderUpgrade(surf);
    else if (state.view === 'checkout') renderCheckout(surf);
    else if (state.view === 'confirm') renderConfirm(surf);
    else renderTickets(surf);
    wireHome(surf);
    wireBar(surf);
    sizeMode();
  }

  function go(view) { state.view = view; render(); track('eventdemo_view', { view: view }); }

  function wireHome(surf) {
    var hm = $('[data-home]', surf);
    if (hm) hm.addEventListener('click', function () { go('tickets'); });
  }
  function wireBar(surf) {
    var b = $('[data-back]', surf);
    if (b) b.addEventListener('click', function () { go(b.getAttribute('data-back')); });
    var c = $('[data-cta]', surf);
    if (c) c.addEventListener('click', function () {
      var a = c.getAttribute('data-cta');
      if (a === 'pay') { track('eventdemo_pay', { total: grand(), table: state.table || '' }); go('confirm'); }
      else go(a);
    });
  }

  /* ===== view: tickets (default, screenshot-ready) ==================== */

  function posterHtml() {
    return '<aside class="cke-poster" style="background-image:linear-gradient(180deg,rgba(2,6,23,.12),rgba(2,6,23,.86)),url(' + POSTER + ')">' +
      '<div class="cke-poster-in">' +
        '<span class="cke-eyebrow">Ticketed event</span>' +
        '<h2 class="cke-title">' + EVENT.name + '<span>' + EVENT.tagline + '</span></h2>' +
        '<div class="cke-meta">' +
          '<p>' + I.cal + EVENT.date + '</p>' +
          '<p>' + I.clock + EVENT.doors + '</p>' +
          '<p>' + I.pin + EVENT.venue + '</p>' +
        '</div>' +
        '<div class="cke-lineup">' +
          LINEUP.map(function (l) { return '<span><b>' + l.time + '</b>' + l.act + '</span>'; }).join('') +
        '</div>' +
        '<p class="cke-syncnote">' + I.info + 'One inventory and one guest database, shared with reservations.</p>' +
      '</div>' +
    '</aside>';
  }

  function tierCardHtml(t) {
    var q = state.qty[t.id] || 0;
    var side;
    if (t.soldout) {
      side = '<button type="button" class="cke-priority' + (state.priority ? ' on' : '') + '" data-priority>' +
        (state.priority ? I.check + 'On the list' : I.bell + 'Priority list') + '</button>';
    } else {
      side = '<div class="cke-qty">' +
        '<button type="button" class="cke-step" data-dec="' + t.id + '" aria-label="Remove one ' + t.name + '"' + (q ? '' : ' disabled') + '>' + I.minus + '</button>' +
        '<b data-qty="' + t.id + '">' + q + '</b>' +
        '<button type="button" class="cke-step" data-inc="' + t.id + '" aria-label="Add one ' + t.name + '">' + I.plus + '</button>' +
      '</div>';
    }
    return '<div class="cke-tier' + (t.best ? ' best' : '') + (t.soldout ? ' soldout' : '') + (q ? ' active' : '') + '">' +
      '<div class="cke-tier-main">' +
        '<div class="cke-tier-head"><h4>' + t.name + '</h4>' +
          (t.tag ? '<span class="cke-tag ' + (t.soldout ? 'sold' : t.best ? 'hot' : '') + '">' + t.tag + '</span>' : '') +
        '</div>' +
        '<p class="cke-tier-note">' + t.note + '</p>' +
      '</div>' +
      '<div class="cke-tier-side"><span class="cke-price">' + money(t.price) + '</span>' + side + '</div>' +
    '</div>';
  }

  function renderTickets(surf) {
    surf.innerHTML = appbar(0) +
      '<div class="cke-event">' +
        posterHtml() +
        '<section class="cke-tickets">' +
          '<div class="cke-tickets-scroll">' +
            '<h3 class="cke-h3">Select tickets</h3>' +
            '<p class="cke-sub">Sold through the venue&rsquo;s own branded flow.</p>' +
            TIERS.map(tierCardHtml).join('') +
            '<button type="button" class="cke-table-teaser" data-cta="upgrade">' +
              '<span class="cke-teaser-ic">' + I.bed + '</span>' +
              '<div class="cke-teaser-txt"><b>Turn tickets into a table</b>' +
              '<p>Upgrade to a reserved cabana or daybed inside the same checkout.</p></div>' +
              '<span class="cke-from">from ' + money(TABLES[0].price) + I.chev + '</span>' +
            '</button>' +
          '</div>' +
        '</section>' +
      '</div>' +
      bar({ label: 'Continue', action: 'upgrade' });

    $$('[data-inc]', surf).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-inc');
        state.qty[id] = Math.min(20, (state.qty[id] || 0) + 1);
        track('eventdemo_qty', { tier: id, qty: state.qty[id] });
        renderTickets(surf); wireHome(surf); wireBar(surf);
      });
    });
    $$('[data-dec]', surf).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-dec');
        state.qty[id] = Math.max(0, (state.qty[id] || 0) - 1);
        renderTickets(surf); wireHome(surf); wireBar(surf);
      });
    });
    var pr = $('[data-priority]', surf);
    if (pr) pr.addEventListener('click', function () {
      state.priority = !state.priority;
      track('eventdemo_priority', { on: state.priority });
      renderTickets(surf); wireHome(surf); wireBar(surf);
    });
  }

  /* ===== view: upgrade (ticket → table, same checkout) ================ */

  function tableCardHtml(t) {
    var on = state.table === t.id;
    return '<div class="cke-tablecard' + (on ? ' on' : '') + '" data-table="' + t.id + '" role="button" tabindex="0" aria-pressed="' + on + '">' +
      '<div class="cke-tablecard-top">' +
        '<span class="cke-tablecard-ic">' + I.bed + '</span>' +
        '<div class="cke-tablecard-name"><h4>' + t.name + '</h4><p>' + t.note + '</p></div>' +
        '<span class="cke-radio">' + (on ? I.check : '') + '</span>' +
      '</div>' +
      '<ul class="cke-incl">' +
        '<li>' + I.pax + 'Entry for up to ' + t.cap + ' guests</li>' +
        '<li>' + I.cup + money(t.credit) + ' food and beverage credit</li>' +
        '<li>' + I.qr + 'One QR check-in for the whole table</li>' +
      '</ul>' +
      '<div class="cke-tablecard-foot"><span class="cke-price">' + money(t.price) + '</span>' +
        '<span class="cke-select">' + (on ? 'Selected' : 'Select table') + '</span></div>' +
    '</div>';
  }

  function renderUpgrade(surf) {
    surf.innerHTML = appbar(1) +
      '<div class="cke-body cke-upgrade">' +
        '<div class="cke-upgrade-head">' +
          '<h2 class="cke-h2">Upgrade to a table</h2>' +
          '<p class="cke-sub">Your ' + ticketLabel() + ' convert into table entry. Same order, same checkout, no second payment step.</p>' +
        '</div>' +
        '<div class="cke-tables">' + TABLES.map(tableCardHtml).join('') + '</div>' +
        '<button type="button" class="cke-keep' + (state.table ? '' : ' on') + '" data-keep>' +
          (state.table ? 'Continue with tickets only' : I.check + 'Tickets only, no table') +
        '</button>' +
      '</div>' +
      bar({ back: 'tickets', label: 'Continue', action: 'checkout' });

    function selectTable(id) {
      state.table = (state.table === id) ? null : id;
      track('eventdemo_table', { table: state.table || '' });
      renderUpgrade(surf); wireHome(surf); wireBar(surf);
    }
    $$('[data-table]', surf).forEach(function (c) {
      c.addEventListener('click', function () { selectTable(c.getAttribute('data-table')); });
      c.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTable(c.getAttribute('data-table')); }
      });
    });
    $('[data-keep]', surf).addEventListener('click', function () {
      state.table = null;
      renderUpgrade(surf); wireHome(surf); wireBar(surf);
    });
  }

  /* ===== view: checkout (order review) ================================ */

  function lineHtml(name, sub, qty, price) {
    return '<div class="cke-line">' +
      '<div class="cke-line-txt"><b>' + name + (qty > 1 ? ' <em>&times; ' + qty + '</em>' : '') + '</b><span>' + sub + '</span></div>' +
      '<span class="cke-line-pr">' + money(price) + '</span></div>';
  }
  function sumrow(label, val, cls) {
    return '<div class="cke-sumrow' + (cls ? ' ' + cls : '') + '"><span>' + label + '</span><b>' + money(val) + '</b></div>';
  }

  function renderCheckout(surf) {
    var lines = '';
    if (state.qty.ga) lines += lineHtml('General Admission', 'Venue entry from 4 PM', state.qty.ga, tier('ga').price * state.qty.ga);
    if (state.qty.vip) lines += lineHtml('VIP Entry', 'Fast-track, welcome cocktail', state.qty.vip, tier('vip').price * state.qty.vip);
    if (!lines) lines = '<p class="cke-empty">No tickets selected.</p>';
    var tbl = state.table ? tableById(state.table) : null;

    surf.innerHTML = appbar(2) +
      '<div class="cke-body cke-checkout">' +
        '<div class="cke-checkout-cols">' +
          '<div class="cke-order">' +
            '<div class="cke-order-ev">' + I.cal +
              '<div><b>' + EVENT.name + ' &mdash; ' + EVENT.tagline + '</b><span>' + EVENT.date + ' · ' + EVENT.venue + '</span></div></div>' +
            '<h4 class="cke-lbl">Tickets</h4>' + lines +
            (tbl ? '<h4 class="cke-lbl">Table</h4>' +
              '<div class="cke-line cke-line-table">' +
                '<div class="cke-line-txt"><b>' + tbl.name + '</b><span>Reserved table, entry for up to ' + tbl.cap + ', ' + money(tbl.credit) + ' credit</span></div>' +
                '<span class="cke-line-pr">' + money(tbl.price) + '</span></div>' : '') +
            '<div class="cke-sums">' +
              sumrow('Subtotal', subtotal()) +
              sumrow('Booking fee', fee()) +
              sumrow('Tax (10%)', tax()) +
              '<div class="cke-sumrow grand"><span>Total</span><b>' + money(grand()) + '</b></div>' +
            '</div>' +
          '</div>' +
          '<aside class="cke-next">' +
            '<div class="cke-guest">' +
              '<h4 class="cke-lbl">Guest details</h4>' +
              '<div class="cke-frow">' +
                '<label class="cke-field"><span>First name</span><input placeholder="First name" autocomplete="off"></label>' +
                '<label class="cke-field"><span>Last name</span><input placeholder="Last name" autocomplete="off"></label>' +
              '</div>' +
              '<label class="cke-field"><span>Email</span><input placeholder="Email for tickets" autocomplete="off"></label>' +
            '</div>' +
            '<div class="cke-next-card">' + I.qr + '<div><b>QR check-in at the door</b><p>Each guest gets a scannable ticket. The team checks them in on the same live floor plan.</p></div></div>' +
            '<div class="cke-next-card">' + I.doc + '<div><b>Saved to the guest database</b><p>Every buyer joins the venue CRM, ready for the next event.</p></div></div>' +
          '</aside>' +
        '</div>' +
      '</div>' +
      bar({ back: 'upgrade', label: 'Pay ' + money(grand()), action: 'pay' });
  }

  /* ===== view: confirm (deterministic QR success) ===================== */

  function renderConfirm(surf) {
    var tbl = state.table ? tableById(state.table) : null;
    surf.innerHTML = appbar(3) +
      '<div class="cke-body cke-confirm">' +
        '<div class="cke-confirm-in">' +
          '<div class="cke-qrbox">' + bigQR() + '</div>' +
          '<h2 class="cke-h2">Tickets confirmed</h2>' +
          '<p>' + ticketLabel() + (tbl ? ' plus your ' + tbl.name : '') + ' for ' + EVENT.name + ' on ' + EVENT.date + '. Show this code at the door to check in.</p>' +
          '<span class="cke-tagline">Interactive demo · no payment taken</span>' +
          '<button type="button" class="cke-ghost" data-restart>Start over</button>' +
        '</div>' +
      '</div>';
    $('[data-restart]', surf).addEventListener('click', function () {
      state.qty = { ga: 2, vip: 0 }; state.table = null; state.priority = false;
      track('eventdemo_restart', {});
      go('tickets');
    });
  }

  /* ===== responsive container mode ==================================== */

  function sizeMode() {
    root.classList.toggle('cke-narrow', root.clientWidth < 720);
    root.classList.toggle('cke-tiny', root.clientWidth < 480);
  }

  /* ===== init per mount =============================================== */

  (function init() {
    var v = OPTS.view;
    if (v === 'tickets') { state.qty.ga = 2; }
    else if (v === 'upgrade') { state.qty.ga = 2; state.table = 'cabana'; }
    else if (v === 'checkout') { state.qty.ga = 2; state.table = 'cabana'; }
    else if (v === 'confirm') { state.qty.ga = 2; state.table = 'cabana'; }
    else { state.view = 'tickets'; state.qty.ga = 2; }

    render();

    if (OPTS.badge) {
      var bhost = h('div', 'demo-badge-host');
      root.parentNode.insertBefore(bhost, root);
      bhost.appendChild(root);
      bhost.appendChild(h('div', 'cke-badge' + (v !== 'tickets' ? ' right' : ''), '<i></i>' + OPTS.badge));
    }

    if (window.ResizeObserver) new ResizeObserver(sizeMode).observe(root);
    window.addEventListener('load', sizeMode);
    [300, 1200].forEach(function (t) { setTimeout(sizeMode, t); });
  })();
  }
})();
