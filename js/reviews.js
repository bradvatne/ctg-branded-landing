/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — guest reviews console demo (.ckr)

   Operator-facing feedback console. Companion to the guest booking demo
   (js/demo.js), the operator console (js/operator.js) and the guest
   intelligence dashboard (js/intel.js): same design language, same demo
   venue vocabulary (VIP Cabanas · Pool Club · Beachfront), viewed from the
   feedback desk. Structure is deliberately lighter than the full intel
   dashboard:

     sidebar (average rating + star distribution + private-first callout)
       → main (response-rate stats · All / Needs attention filter)
       → feed of post-visit responses, each tied to a real booking
       → low scores raise a private alert, not a public review
       → click a response → slide-in detail w/ linked booking + resolve

   Every response ties to a real booking. A low score is heard privately by
   the team before the guest posts to a public review site. All data is
   local and deterministic — no network, no libraries.

   Mount: <div class="ckr" data-reviewdemo="dashboard|detail">
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-reviewdemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/reviews.js';
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/reviews\.js.*$/, 'brand/clubtech-mark-black-96.png');

  mounts.forEach(function (m) { createReviews(m); });

  function createReviews(root) {
  var OPTS = {
    view: root.getAttribute('data-reviewdemo') || 'dashboard',
    badge: root.getAttribute('data-reviewdemo-badge') || ''
  };

  /* ===== deterministic data =========================================== */

  var SUMMARY = { avg: 4.6, total: 128, rate: 71 };
  var DIST = [[5, 96], [4, 20], [3, 6], [2, 4], [1, 2]]; // [stars, count] → 588/128 = 4.6

  var REVIEWS = [
    { id: 'r1', name: 'Maya Chen', rating: 5, when: '2h ago',
      quote: 'The cabana service was flawless from arrival to sunset. Our host remembered the whole group by name.',
      booking: { ref: 'TB-4821', date: '12 Jul', party: 8, zone: 'VIP Cabanas', pkg: 'Ultimate Experience', paid: 680 } },
    { id: 'r2', name: 'Sofia Marino', rating: 5, when: '5h ago',
      quote: 'Booking was effortless and the bed was ready the moment we walked in. Worth every dollar.',
      booking: { ref: 'TB-4790', date: '11 Jul', party: 4, zone: 'Pool Club', pkg: 'Bed + Party Package', paid: 250 } },
    { id: 'r3', name: 'Liam O’Connor', rating: 4, when: 'Yesterday',
      quote: 'Great afternoon overall. Drinks took a little while at peak but the team sorted it quickly.',
      booking: { ref: 'TB-4788', date: '11 Jul', party: 4, zone: 'Pool Club', pkg: 'Bed + Party Package', paid: 250 } },
    { id: 'r4', name: 'Jack Wilson', rating: 2, when: 'Yesterday',
      quote: 'Our bed was not ready at the booked time and we waited close to thirty minutes with no update.',
      booking: { ref: 'TB-4763', date: '10 Jul', party: 2, zone: 'Pool Club', pkg: 'Bed Only', paid: 180 } },
    { id: 'r5', name: 'Aisha Rahman', rating: 4, when: '2 days ago',
      quote: 'Lovely spot by the water and easy check-in. Music was a touch loud for our table.',
      booking: { ref: 'TB-4759', date: '10 Jul', party: 6, zone: 'Beachfront', pkg: 'Bed + Party Package', paid: 250 } },
    { id: 'r6', name: 'Tom Becker', rating: 5, when: '3 days ago',
      quote: 'Second time booking through the platform and it keeps getting smoother. The party package delivered.',
      booking: { ref: 'TB-4741', date: '9 Jul', party: 5, zone: 'Beachfront', pkg: 'Ultimate Experience', paid: 680 } },
    { id: 'r7', name: 'Ava Nguyen', rating: 3, when: '3 days ago',
      quote: 'Good value and a nice setup, though the app took a moment to confirm our arrival.',
      booking: { ref: 'TB-4736', date: '9 Jul', party: 6, zone: 'VIP Cabanas', pkg: 'Bed + Party Package', paid: 250 } },
    { id: 'r8', name: 'Noah Peterson', rating: 2, when: '4 days ago',
      quote: 'The booking went through twice on my card and it took a few messages to get the second hold released.',
      booking: { ref: 'TB-4712', date: '8 Jul', party: 4, zone: 'Pool Club', pkg: 'Bed + Party Package', paid: 250 } }
  ];

  var state = {
    view: OPTS.view === 'detail' ? 'detail' : 'dashboard',
    filter: 'all',
    openId: null,
    detailId: 'r4' // the flagged low score
  };

  /* ===== helpers ====================================================== */

  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || root).querySelectorAll(sel)); }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function track(n, p) { try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {} }
  function money(n) { return '$' + n.toLocaleString('en-US'); }
  function byId(id) { return REVIEWS.filter(function (r) { return r.id === id; })[0]; }
  function alertLevel(r) { return r.rating <= 2; }
  function initials(name) { var p = name.split(' '); return (p[0].charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }

  var STAR = '<svg class="ckr-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.1l2.65 6.05 6.6.55-5.02 4.32 1.53 6.42L12 16.9l-5.76 3.53 1.53-6.42L2.75 8.7l6.6-.55z"/></svg>';
  var STARS5 = STAR + STAR + STAR + STAR + STAR;

  function stars(rating, cls) {
    var w = Math.max(0, Math.min(5, rating)) / 5 * 100;
    return '<span class="ckr-stars ' + (cls || '') + '">' +
      '<span class="ckr-srow">' + STARS5 + '</span>' +
      '<span class="ckr-sfill" style="width:' + w + '%"><span class="ckr-srow">' + STARS5 + '</span></span>' +
      '</span>';
  }

  var I = {
    logo: '<img src="' + BRAND_MARK + '" alt="">',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
    pax: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c1-3 3.1-4.5 5.5-4.5s4.5 1.5 5.5 4.5M15.5 6a3 3 0 0 1 0 5.4M17 15.4c1.8.6 3 2 3.7 4.1"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s6.5-5.5 6.5-10.5A6.5 6.5 0 0 0 5.5 10.5C5.5 15.5 12 21 12 21Z"/><circle cx="12" cy="10.5" r="2.3"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.2l7 2.6v5.1c0 4.4-3 7.4-7 8.9-4-1.5-7-4.5-7-8.9V5.8z"/><path d="M9.2 11.9l1.9 1.9 3.7-3.9"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7"/></svg>',
    note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 20V9M10 20V4M16 20v-8M21 20H3"/></svg>'
  };

  /* ===== render dispatch ============================================== */

  function render() {
    root.innerHTML = '';
    root.classList.toggle('detail', state.view === 'detail');
    if (state.view === 'detail') buildDetail(); else buildDashboard();
    var t = h('div', 'ckr-toast');
    t.setAttribute('role', 'status');
    t.setAttribute('aria-live', 'polite');
    root.appendChild(t);
  }

  /* ===== dashboard ==================================================== */

  function buildDashboard() {
    var side = h('div', 'ckr-side');
    side.appendChild(h('div', 'ckr-brand', '<span class="lg">' + I.logo + '</span><b>Guest Reviews</b>'));

    var maxc = Math.max.apply(null, DIST.map(function (d) { return d[1]; }));
    side.appendChild(h('div', 'ckr-summary',
      '<span class="ckr-slabel">Average guest rating</span>' +
      '<div class="ckr-avg"><b>' + SUMMARY.avg.toFixed(1) + '</b>' +
        '<div class="ckr-avgmeta">' + stars(SUMMARY.avg, 'md') +
          '<span class="ckr-count">' + SUMMARY.total + ' responses</span></div>' +
      '</div>' +
      '<div class="ckr-dist">' + DIST.map(function (d) {
        return '<div class="ckr-distrow"><span class="ckr-distk">' + d[0] + STAR + '</span>' +
          '<i class="ckr-track"><b style="width:' + Math.max(3, Math.round(d[1] / maxc * 100)) + '%"></b></i>' +
          '<span class="ckr-distn">' + d[1] + '</span></div>';
      }).join('') + '</div>'));

    side.appendChild(h('div', 'ckr-callout',
      '<span class="ic">' + I.shield + '</span>' +
      '<p>A low score raises a private alert for your team — not a public review. Guests are heard before they post to a public review site.</p>'));
    side.appendChild(h('p', 'ckr-foot', 'Demo data — every response ties to a real booking.'));
    root.appendChild(side);

    var main = h('div', 'ckr-main');
    main.appendChild(h('div', 'ckr-stats'));
    var head = h('div', 'ckr-head');
    head.appendChild(h('h4', null, 'Recent responses'));
    var seg = h('div', 'ckr-seg',
      '<button type="button" data-filter="all" class="on">All</button>' +
      '<button type="button" data-filter="alert">Needs attention</button>');
    head.appendChild(seg);
    main.appendChild(head);
    main.appendChild(h('div', 'ckr-feed'));
    root.appendChild(main);

    root.appendChild(h('div', 'ckr-panel'));

    $$('[data-filter]', seg).forEach(function (b) {
      b.addEventListener('click', function () {
        state.filter = b.getAttribute('data-filter');
        $$('[data-filter]', seg).forEach(function (x) { x.classList.toggle('on', x === b); });
        paintDashboard();
        track('reviewdemo_filter', { filter: state.filter });
      });
    });

    paintDashboard();
  }

  function paintDashboard() {
    var open = REVIEWS.filter(function (r) { return alertLevel(r) && !r.resolved; }).length;
    $('.ckr-stats').innerHTML =
      stat('Response rate', SUMMARY.rate + '%') +
      stat('Responses · 30d', String(SUMMARY.total)) +
      stat('Private alerts', String(open));

    var list = REVIEWS.filter(function (r) { return state.filter === 'alert' ? alertLevel(r) : true; });
    var feed = $('.ckr-feed');
    feed.innerHTML = list.length
      ? list.map(itemHTML).join('')
      : '<p class="ckr-empty">No responses match this view.</p>';

    $$('.ckr-item', feed).forEach(function (el) {
      var r = byId(el.getAttribute('data-rid'));
      el.addEventListener('click', function () { openPanel(r); });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(r); }
      });
    });
  }

  function stat(label, value) {
    return '<div class="ckr-stat"><span>' + label + '</span><b>' + value + '</b></div>';
  }

  function chip(r) {
    if (alertLevel(r)) return '<span class="ckr-chip ' + (r.resolved ? 'resolved' : 'alert') + '">' + (r.resolved ? 'Resolved' : 'Private alert') + '</span>';
    return '<span class="ckr-chip logged">Logged</span>';
  }

  function bookingRow(b) {
    return '<div class="ckr-booking">' +
      '<span>' + I.cal + b.date + '</span>' +
      '<span>' + I.pax + b.party + ' guests</span>' +
      '<span>' + I.pin + b.zone + '</span>' +
      '<span class="ckr-pkg">' + b.pkg + '</span>' +
      '</div>';
  }

  function itemHTML(r) {
    var al = alertLevel(r);
    var cls = 'ckr-item' + (al ? ' alert' : '') + (r.resolved ? ' resolved' : '');
    return '<div class="' + cls + '" data-rid="' + r.id + '" role="button" tabindex="0" aria-label="Response from ' + r.name + ', ' + r.rating + ' of 5">' +
      '<div class="ckr-item-top">' +
        '<span class="ckr-ava">' + initials(r.name) + '</span>' +
        '<div class="ckr-who"><h5 role="presentation">' + r.name + '</h5><span>' + r.when + '</span></div>' +
        chip(r) +
      '</div>' +
      '<div class="ckr-rate">' + stars(r.rating) + '</div>' +
      '<p class="ckr-quote">' + r.quote + '</p>' +
      bookingRow(r.booking) +
      (al ? '<p class="ckr-flag">' + I.shield + (r.resolved ? 'Resolved privately — kept off public review sites.' : 'Flagged to your team — kept off public review sites.') + '</p>' : '') +
      '</div>';
  }

  /* ===== detail (shared body for panel + standalone) ================== */

  function brow(k, v) { return '<div class="ckr-brow"><span>' + k + '</span><b>' + v + '</b></div>'; }

  function detailBody(r) {
    var al = alertLevel(r);
    var b = r.booking;
    var banner = al
      ? '<div class="ckr-banner"><span class="ic">' + I.shield + '</span><p>' +
          (r.resolved
            ? 'Resolved privately by your team — this response was kept off public review sites.'
            : 'Kept private. A low score raises an internal alert for your team, not a public review — so this guest is heard before they post to a public review site.') +
        '</p></div>'
      : '<div class="ckr-banner soft"><span class="ic">' + I.check + '</span><p>Logged to your guest feedback. Every response ties to a real booking.</p></div>';

    var actions = (al && !r.resolved)
      ? '<button type="button" class="ckr-btn dark" data-act="resolve">' + I.check + ' Resolve internally</button>' +
        '<button type="button" class="ckr-btn line" data-act="note">' + I.note + ' Add internal note</button>'
      : '<button type="button" class="ckr-btn line" data-act="note">' + I.note + ' Add internal note</button>';

    return '<div class="ckr-dhead">' +
        '<span class="ckr-ava lg">' + initials(r.name) + '</span>' +
        '<div class="ckr-who"><h5 role="presentation">' + r.name + '</h5><span>Responded ' + r.when + '</span></div>' +
        chip(r) +
      '</div>' +
      '<div class="ckr-drate">' + stars(r.rating, 'lg') + '<b>' + r.rating.toFixed(1) + '</b><span>of 5</span></div>' +
      banner +
      '<p class="ckr-dquote">' + r.quote + '</p>' +
      '<div class="ckr-bcard">' +
        '<h6 role="presentation">Linked booking</h6>' +
        brow('Booking ref', b.ref) +
        brow('Service date', b.date + ' 2026') +
        brow('Party', b.party + ' guests') +
        brow('Zone', b.zone) +
        brow('Package', b.pkg) +
        brow('Prepaid', money(b.paid)) +
        '<p class="ckr-bnote">Every response ties to a real booking.</p>' +
      '</div>' +
      '<div class="ckr-tags"><span class="ckr-tag">' + I.chart + 'Added to guest intelligence</span></div>' +
      '<div class="ckr-actions">' + actions + '</div>';
  }

  function wireDetail(scope, r) {
    $$('[data-act]', scope).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var act = btn.getAttribute('data-act');
        if (act === 'resolve') {
          r.resolved = true;
          track('reviewdemo_resolve', { id: r.id });
          toast('Resolved privately — kept off public review sites');
          if (state.view === 'detail') render();
          else { paintDashboard(); refillPanel(r); }
        }
        if (act === 'note') { toast('Internal note saved to this booking'); }
      });
    });
  }

  /* ===== slide-in panel (dashboard) =================================== */

  function openPanel(r) {
    state.openId = r.id;
    refillPanel(r);
    $('.ckr-panel').classList.add('open');
    track('reviewdemo_open', { id: r.id });
  }

  function refillPanel(r) {
    var p = $('.ckr-panel');
    if (!p) return;
    p.innerHTML = '<button type="button" class="ckr-x" aria-label="Close">✕</button>' +
      '<h3 role="presentation">Response detail</h3>' + detailBody(r);
    $('.ckr-x', p).addEventListener('click', closePanel);
    wireDetail(p, r);
  }

  function closePanel() { state.openId = null; $('.ckr-panel').classList.remove('open'); }

  /* ===== standalone detail view ======================================= */

  function buildDetail() {
    var r = byId(state.detailId) || REVIEWS[0];
    var d = h('div', 'ckr-detail');
    d.innerHTML =
      '<button type="button" class="ckr-back" data-back>' + I.back + ' Back to responses</button>' +
      '<div class="ckr-dcard">' + detailBody(r) + '</div>';
    root.appendChild(d);
    $('[data-back]', d).addEventListener('click', function () {
      state.view = 'dashboard';
      render();
      track('reviewdemo_back', {});
    });
    wireDetail(d, r);
  }

  /* ===== toast ======================================================== */

  var toastId = null;
  function toast(msg) {
    var t = $('.ckr-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    if (toastId) clearTimeout(toastId);
    toastId = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  /* ===== badge + resize + keyboard ==================================== */

  if (OPTS.badge) {
    var bhost = h('div', 'demo-badge-host');
    root.parentNode.insertBefore(bhost, root);
    bhost.appendChild(root);
    bhost.appendChild(h('div', 'ckr-badge right', '<i></i>' + OPTS.badge));
  }

  function sizeMode() { root.classList.toggle('tiny', root.clientWidth < 640); }
  sizeMode();
  if (window.ResizeObserver) new ResizeObserver(sizeMode).observe(root);

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('.ckr-panel.open')) closePanel();
  });

  render();
  }
})();
