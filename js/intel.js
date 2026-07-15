/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — guest intelligence dashboard demo (.cki)

   Analytics companion to the guest booking demo (js/demo.js) and the
   operator console (js/operator.js): same design language, rebuilt from
   captures of the live intelligence dashboard. Structure mirrors it:

     sidebar filters (date range, zone, product, booking type)
       → stat cards (revenue, bookings, avg value, early-bird, lead time)
       → report tabs (product · lead time · value · origin · ads)
       → SVG trend chart w/ Daily/Weekly/Monthly binning
       → revenue-by-product bars + computed insight callout

   All data is deterministic and derived locally — filters really filter.
   Mount: <div class="cki" data-inteldemo="product|leadtime|value|origin|ads">
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-inteldemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/intel.js';
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/intel\.js.*$/, 'brand/clubtech-mark-black-96.png');

  mounts.forEach(function (m) { createDash(m); });

  function createDash(root) {
  var OPTS = {
    view: root.getAttribute('data-inteldemo') || 'product',
    badge: root.getAttribute('data-inteldemo-badge') || ''
  };

  /* ===== deterministic data =========================================== */

  /* 30 service days of bookings, June 15 – July 14 2026 */
  var BASE = [];
  for (var i = 0; i < 30; i++) {
    var wave = Math.sin(i / 2.4) * 6 + Math.sin(i / 6.8) * 4;
    var jitter = ((i * 37 + 11) % 13) - 6;
    var weekend = (i % 7 === 5 || i % 7 === 6) ? 8 : 0;
    BASE.push(Math.max(6, Math.round(17 + wave + jitter + weekend)));
  }
  var AVG_VALUE = 879;

  var ZONES = { 'All zones': 1, 'Pool Club': 0.52, 'VIP Cabanas': 0.27, 'Beachfront': 0.21 };
  var PRODUCTS = { 'All products': 1, 'Ultimate Experience': 0.33, 'Bed + Party Package': 0.41, 'Bed Only': 0.14, 'Add-ons': 0.12 };
  var TYPES = { 'All types': 1, 'Online': 0.82, 'Walk-in': 0.18 };
  var RANGES = { 'Last 30 days': 30, 'Last 14 days': 14, 'Last 7 days': 7 };

  var TABS = [
    { id: 'product', label: 'Product & Experience' },
    { id: 'leadtime', label: 'Booking Lead Time' },
    { id: 'value', label: 'Booking Value' },
    { id: 'origin', label: 'Origin Markets' },
    { id: 'ads', label: 'Ads & Attribution' }
  ];

  var LEAD = [['Same day', 14], ['1–3 days', 26], ['4–7 days', 22], ['8–14 days', 18], ['15–30 days', 12], ['30+ days', 8]];
  var VALUE = [['<$200', 12], ['$200–400', 24], ['$400–700', 27], ['$700–1k', 17], ['$1k–2k', 13], ['$2k+', 7]];
  var ORIGIN = [['Australia', 31], ['Indonesia', 22], ['Singapore', 13], ['United Kingdom', 11], ['Germany', 8], ['United States', 7], ['Other', 8]];
  var ADS = [['Meta Ads', 34], ['Google Ads', 27], ['Organic & GA4', 21], ['Direct', 12], ['Partners', 6]];
  var PRODMIX = [['Ultimate Experience', 0.33], ['Bed + Party Package', 0.41], ['Bed Only', 0.14], ['Add-ons & extras', 0.12]];

  var state = { tab: OPTS.view, gran: 'Daily', range: 'Last 30 days', zone: 'All zones', product: 'All products', type: 'All types' };
  if (!TABS.some(function (t) { return t.id === state.tab; })) state.tab = 'product';

  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || root).querySelectorAll(sel)); }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function track(n, p) { try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {} }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function moneyK(n) { return n >= 100000 ? '$' + (n / 1000).toFixed(0) + 'k' : money(n); }

  function factor() { return ZONES[state.zone] * PRODUCTS[state.product] * TYPES[state.type]; }
  function series() {
    var days = RANGES[state.range];
    return BASE.slice(30 - days).map(function (v) { return Math.max(1, Math.round(v * factor())); });
  }
  function bins(arr, size) {
    var out = [], counts = [];
    for (var i = 0; i < arr.length; i += size) {
      var chunk = arr.slice(i, i + size);
      out.push(chunk.reduce(function (a, b) { return a + b; }, 0));
      counts.push(chunk.length);
    }
    // fold a runt trailing bin into the previous one so no bar reads as a cliff
    if (out.length > 1 && counts[counts.length - 1] < size / 2) {
      out[out.length - 2] += out.pop();
    }
    return out;
  }
  function totals() {
    var s = series();
    var bookings = s.reduce(function (a, b) { return a + b; }, 0);
    var rev = bookings * AVG_VALUE * (state.product === 'Ultimate Experience' ? 2.1 : state.product === 'Bed Only' ? 0.62 : 1);
    return { bookings: bookings, rev: rev, avg: rev / bookings };
  }

  var I = {
    logo: '<img src="' + BRAND_MARK + '" alt="">',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 20V9M10 20V4M16 20v-8M21 20H3"/></svg>'
  };

  /* ===== shell ======================================================== */

  function build() {
    root.innerHTML = '';

    var side = h('div', 'cki-side');
    side.appendChild(h('div', 'cki-brand', '<span class="lg">' + I.logo + '</span><b>Guest Intelligence</b>'));
    side.appendChild(filterBlock('Date range', 'range', Object.keys(RANGES)));
    side.appendChild(filterBlock('Zone', 'zone', Object.keys(ZONES)));
    side.appendChild(filterBlock('Product / category', 'product', Object.keys(PRODUCTS)));
    side.appendChild(filterBlock('Booking type', 'type', Object.keys(TYPES)));
    side.appendChild(h('p', 'cki-foot', 'Limited demo — filters really filter. 20+ reports ship with the platform.'));
    root.appendChild(side);

    var main = h('div', 'cki-main');
    main.appendChild(h('div', 'cki-stats'));
    var tabrow = h('div', 'cki-tabrow');
    var tabs = h('div', 'cki-tabs', TABS.map(function (t) {
      return '<button type="button" data-tab="' + t.id + '">' + t.label + '</button>';
    }).join(''));
    tabrow.appendChild(tabs);
    tabrow.appendChild(h('div', 'cki-gran',
      ['Daily', 'Weekly', 'Monthly'].map(function (g) {
        return '<button type="button" data-gran="' + g + '">' + g + '</button>';
      }).join('')));
    main.appendChild(tabrow);
    main.appendChild(h('div', 'cki-chartcard'));
    var split = h('div', 'cki-split');
    split.appendChild(h('div', 'cki-prodcard'));
    split.appendChild(h('div', 'cki-insight'));
    main.appendChild(split);
    root.appendChild(main);

    if (OPTS.badge) {
      var bhost = h('div', 'demo-badge-host');
      root.parentNode.insertBefore(bhost, root);
      bhost.appendChild(root);
      bhost.appendChild(h('div', 'cki-badge right', '<i></i>' + OPTS.badge));
    }

    $$('[data-tab]', tabs).forEach(function (b) {
      b.addEventListener('click', function () { state.tab = b.getAttribute('data-tab'); paint(); track('inteldemo_tab', { tab: state.tab }); });
    });
    $$('[data-gran]').forEach(function (b) {
      b.addEventListener('click', function () { state.gran = b.getAttribute('data-gran'); paint(); });
    });

    function sizeMode() { root.classList.toggle('tiny', root.clientWidth < 640); }
    sizeMode();
    if (window.ResizeObserver) new ResizeObserver(sizeMode).observe(root);
    paint();
  }

  function filterBlock(label, key, opts) {
    var w = h('label', 'cki-filter', label + '<select>' + opts.map(function (o) {
      return '<option' + (state[key] === o ? ' selected' : '') + '>' + o + '</option>';
    }).join('') + '</select>');
    $('select', w).addEventListener('change', function (e) {
      state[key] = e.target.value;
      paint();
      track('inteldemo_filter', { filter: key, value: e.target.value });
    });
    return w;
  }

  /* ===== charts ======================================================= */

  function barChart(data, labels, line, fmt) {
    var W = 660, H = 240, PAD = 34, BW = (W - PAD - 10) / data.length;
    var max = Math.max.apply(null, data) * 1.15 || 1;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + (H + 34) + '" preserveAspectRatio="none" class="cki-svg">';
    [0.25, 0.5, 0.75, 1].forEach(function (g) {
      var y = H - H * g;
      svg += '<line x1="' + PAD + '" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="#ececec" stroke-width="1"/>';
      svg += '<text x="' + (PAD - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-size="9" fill="#9b9b9b">' + (fmt ? fmt(max * g) : Math.round(max * g)) + '</text>';
    });
    data.forEach(function (v, i) {
      var bh = v / max * H;
      var x = PAD + i * BW + BW * 0.14;
      svg += '<rect x="' + x + '" y="' + (H - bh) + '" width="' + BW * 0.72 + '" height="' + bh + '" rx="4" fill="#7b8ce8"/>';
    });
    if (line) {
      var pts = line.map(function (v, i) {
        return (PAD + i * BW + BW * 0.5) + ',' + (H - v / (Math.max.apply(null, line) * 1.15) * H);
      }).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="#14b8a6" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    var step = Math.ceil(labels.length / 10);
    labels.forEach(function (l, i) {
      if (i % step) return;
      svg += '<text x="' + (PAD + i * BW + BW * 0.5) + '" y="' + (H + 18) + '" text-anchor="middle" font-size="9.5" fill="#6e6e6e">' + l + '</text>';
    });
    svg += '</svg>';
    return svg;
  }

  function dayLabels(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var d = 14 - (n - 1 - i); // ends 14 July
      out.push(d > 0 ? d + ' Jul' : (30 + d) + ' Jun');
    }
    return out;
  }

  /* ===== paint ======================================================== */

  function paint() {
    var t = totals();
    var s = series();

    $('.cki-stats').innerHTML =
      stat('Total revenue', moneyK(t.rev)) +
      stat('Bookings', t.bookings.toLocaleString('en-US')) +
      stat('Avg booking value', money(t.avg)) +
      stat('Early-bird rate', '25.8%') +
      stat('Median lead time', '3.2 days');

    $$('.cki-tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-tab') === state.tab); });
    $$('[data-gran]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-gran') === state.gran); });
    $('.cki-gran').style.display = state.tab === 'product' ? '' : 'none';

    var card = $('.cki-chartcard');
    var chart = '', title = '';
    if (state.tab === 'product') {
      var data = s, labels = dayLabels(s.length);
      if (state.gran === 'Weekly') { data = bins(s, 7); labels = data.map(function (_, i) { return 'Wk ' + (i + 1); }); }
      if (state.gran === 'Monthly') { data = bins(s, 15); labels = data.map(function (_, i) { return i === 0 ? 'Jun' : 'Jul'; }); }
      title = state.gran + ' bookings trend';
      chart = barChart(data, labels, data.map(function (v) { return v * AVG_VALUE; }), null);
    }
    if (state.tab === 'leadtime') {
      title = 'How far ahead guests book';
      chart = barChart(LEAD.map(function (x) { return Math.round(x[1] * factor() * 10) / 10; }), LEAD.map(function (x) { return x[0]; }), null, function (v) { return Math.round(v) + '%'; });
    }
    if (state.tab === 'value') {
      title = 'Booking value distribution';
      chart = barChart(VALUE.map(function (x) { return Math.round(x[1] * factor() * 10) / 10; }), VALUE.map(function (x) { return x[0]; }), null, function (v) { return Math.round(v) + '%'; });
    }
    if (state.tab === 'origin') {
      title = 'Bookings by origin market';
      chart = barChart(ORIGIN.map(function (x) { return Math.round(x[1] * factor() * 10) / 10; }), ORIGIN.map(function (x) { return x[0]; }), null, function (v) { return Math.round(v) + '%'; });
    }
    if (state.tab === 'ads') {
      title = 'Attributed revenue by channel — conversions fired to Meta, Google Ads & GA4 with revenue attached';
      chart = barChart(ADS.map(function (x) { return x[1] * t.rev / 100; }), ADS.map(function (x) { return x[0]; }), null, moneyK);
    }
    card.innerHTML = '<h4 role="presentation">' + title + '</h4>' + chart +
      (state.tab === 'product' ? '<p class="cki-key"><i class="bar"></i>Bookings <i class="line"></i>Revenue</p>' : '');

    var mix = PRODMIX.map(function (p) { return [p[0], p[1] * t.rev]; });
    var maxMix = mix[1][1];
    $('.cki-prodcard').innerHTML = '<h4 role="presentation">Revenue by product</h4>' + mix.map(function (p) {
      return '<div class="cki-bar"><span>' + p[0] + '</span><i style="width:' + Math.round(p[1] / maxMix * 100) + '%"></i><b>' + moneyK(p[1]) + '</b></div>';
    }).join('');

    var insights = {
      product: 'The <b>Bed + Party Package</b> is the top revenue driver — <b>' + moneyK(t.rev * 0.41) + '</b> (41% of total) across ' + Math.round(t.bookings * 0.38) + ' bookings.',
      leadtime: '<b>62%</b> of bookings land 1–14 days out — enough lead time for pre-arrival upsells to convert.',
      value: 'The <b>$400–700</b> band is the fattest slice — the packages guests actually choose, prepaid.',
      origin: '<b>Australia + Indonesia</b> are ' + Math.round(53 * 1) + '% of demand — the markets your ads budget should follow.',
      ads: 'Every booking fires to <b>Meta, Google Ads & GA4</b> with revenue attached — campaigns optimize toward booked revenue, not clicks.'
    };
    $('.cki-insight').innerHTML = '<span class="ic">' + I.spark + '</span><p>' + insights[state.tab] + '</p>';
  }

  function stat(label, value) {
    return '<div class="cki-stat"><span>' + label + '</span><b>' + value + '</b></div>';
  }

  build();
  }
})();
