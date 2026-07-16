/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — dynamic pricing demo (.ckp)

   Operator-facing pricing control, built in the same design language as the
   guest booking demo (js/demo.js), operator console (js/operator.js) and
   guest intelligence dashboard (js/intel.js): Albert Sans, white cards on a
   soft canvas, #1c1c1c headers, indigo accents, lavender insight callout.

   Two views on the same deterministic pricing model:
     calendar — the same furniture priced as a different product across the
                week × daypart grid, with a demand pip, a delta vs base rate
                and a remaining-inventory bar. "Book Online & Save" toggles
                door rates to early-commitment rates.
     rules    — a pricing-rule editor: zone + furniture (from the sidebar)
                × daypart × demand tier → applied rate, with a minimum-spend
                field and the "Book Online & Save" discount.

   All prices are derived locally and deterministically — the filters, the
   rate toggle and the rule editor all really compute. No network, no libs.
   Mount: <div class="ckp" data-pricedemo="calendar|rules">.
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-pricedemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/pricing.js';
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/pricing\.js.*$/, 'brand/clubtech-mark-black-96.png');

  mounts.forEach(function (m) { createDemo(m); });

  function createDemo(root) {
  var OPTS = {
    view: root.getAttribute('data-pricedemo') || 'calendar',
    badge: root.getAttribute('data-pricedemo-badge') || ''
  };

  /* ===== deterministic data =========================================== */

  /* Same furniture is a different product by day and daypart. Base rate is
     the flat reference; the model flexes it on demand, daypart and how much
     of that furniture is left. */
  var FURNITURE = [
    { id: 'front',  name: 'Front Row Daybed',   zone: 'Pool Club',   base: 320, units: 12 },
    { id: 'sunset', name: 'Sunset Deck Bed',    zone: 'Sunset Deck', base: 420, units: 10 },
    { id: 'cabana', name: 'VIP Cabana',         zone: 'VIP Cabana',  base: 680, units: 6  },
    { id: 'shade',  name: 'Shade Line Lounger', zone: 'Pool Club',   base: 180, units: 16 }
  ];

  var ZONES = ['All zones'];
  FURNITURE.forEach(function (f) { if (ZONES.indexOf(f.zone) === -1) ZONES.push(f.zone); });

  var DAYS = [
    { k: 'Mon', n: 'Monday',    w: 0.82 },
    { k: 'Tue', n: 'Tuesday',   w: 0.80 },
    { k: 'Wed', n: 'Wednesday', w: 0.86 },
    { k: 'Thu', n: 'Thursday',  w: 0.94 },
    { k: 'Fri', n: 'Friday',    w: 1.14 },
    { k: 'Sat', n: 'Saturday',  w: 1.32 },
    { k: 'Sun', n: 'Sunday',    w: 1.06 }
  ];

  var DAYPARTS = [
    { k: 'Midday',    t: '12–3pm', w: 0.90 },
    { k: 'Afternoon', t: '3–6pm',  w: 1.00 },
    { k: 'Sunset',    t: '6–9pm',  w: 1.20 }
  ];

  var TIERS = ['High', 'Medium', 'Low'];
  var TIER_MULT = { High: 1.30, Medium: 1.00, Low: 0.82 };
  var ONLINE_SAVE = 12; // "Book Online & Save" early-commitment discount, %

  /* preset rules shown in the "rules in effect" list — deterministic */
  var PRESETS = [
    { furn: 'cabana', dp: 'Sunset',    tier: 'High'   },
    { furn: 'front',  dp: 'Sunset',    tier: 'High'   },
    { furn: 'sunset', dp: 'Afternoon', tier: 'Medium' },
    { furn: 'front',  dp: 'Midday',    tier: 'Low'    },
    { furn: 'shade',  dp: 'Midday',    tier: 'Low'    }
  ];

  var state = {
    view: OPTS.view,       // calendar | rules
    zone: 'All zones',
    furn: 'front',
    mode: 'door',          // door | online (calendar rate mode)
    rDaypart: 'Sunset',    // rule editor
    rTier: 'High',
    rMin: null,            // null = follow computed default
    rSave: ONLINE_SAVE
  };
  if (state.view !== 'calendar' && state.view !== 'rules') state.view = 'calendar';

  /* ===== helpers ====================================================== */

  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || root).querySelectorAll(sel)); }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function track(n, p) { try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {} }
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function furnObj(id) { return FURNITURE.filter(function (f) { return f.id === id; })[0]; }
  function furnInZone() { return FURNITURE.filter(function (f) { return state.zone === 'All zones' || f.zone === state.zone; }); }
  function daypart(k) { return DAYPARTS.filter(function (d) { return d.k === k; })[0]; }
  function stepOf(base) { return base >= 500 ? 10 : 5; }
  function roundTo(v, s) { return Math.round(v / s) * s; }

  /* the pricing model — same math feeds the calendar and the rule editor */
  function cellPrice(furn, di, pi) {
    var raw = furn.base * DAYS[di].w * DAYPARTS[pi].w;
    var jit = (((di * 7 + pi * 13 + 3) % 9) - 4) / 100; // -0.04 .. +0.04, deterministic
    return roundTo(raw * (1 + jit), stepOf(furn.base));
  }
  function priceAt(furn, di, pi) {
    var p = cellPrice(furn, di, pi);
    return state.mode === 'online' ? roundTo(p * (1 - ONLINE_SAVE / 100), 5) : p;
  }
  function demandVal(di, pi) { return DAYS[di].w * DAYPARTS[pi].w; }
  function tierOf(d) { return d >= 1.20 ? 'High' : d >= 0.95 ? 'Medium' : 'Low'; }
  function dayTier(w) { return w >= 1.10 ? 'high' : w >= 0.90 ? 'med' : 'low'; }
  function remaining(furn, di, pi) {
    var d = demandVal(di, pi), lo = 0.72, hi = 1.585;
    var frac = 1 - (d - lo) / (hi - lo) * 0.82; // hotter demand -> fewer seats left
    return Math.round(furn.units * Math.max(0.12, Math.min(1, frac)));
  }
  function ruleRate(furn, dpKey, tier) {
    return roundTo(furn.base * daypart(dpKey).w * TIER_MULT[tier], stepOf(furn.base));
  }
  function onlineRate(rate, savePct) { return roundTo(rate * (1 - savePct / 100), 5); }
  function minDefault(rate) { return Math.ceil(rate / 50) * 50; }

  function extremes(furn, pf) {
    var pk = { v: -1, di: 0, pi: 0 }, fl = { v: 1e9, di: 0, pi: 0 };
    for (var di = 0; di < DAYS.length; di++) for (var pi = 0; pi < DAYPARTS.length; pi++) {
      var p = pf(furn, di, pi);
      if (p > pk.v) pk = { v: p, di: di, pi: pi };
      if (p < fl.v) fl = { v: p, di: di, pi: pi };
    }
    return { peak: pk, floor: fl };
  }

  var I = {
    logo: '<img src="' + BRAND_MARK + '" alt="">',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9L19 16Z"/></svg>',
    tune: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 8h9M17 8h3M4 16h3M11 16h9"/><circle cx="15" cy="8" r="2.3"/><circle cx="9" cy="16" r="2.3"/></svg>'
  };

  /* ===== shell ======================================================== */

  var furnSelect;

  function build() {
    root.innerHTML = '';

    var side = h('div', 'ckp-side');
    side.appendChild(h('div', 'ckp-brand', '<span class="lg">' + I.logo + '</span><b>Dynamic Pricing</b>'));
    side.appendChild(filterBlock('Zone', 'zone', ZONES));

    var fWrap = h('label', 'ckp-filter', 'Furniture<select></select>');
    furnSelect = $('select', fWrap);
    fillFurnOptions();
    furnSelect.addEventListener('change', function () {
      state.furn = furnSelect.value;
      if (!state.rMinTouched) state.rMin = null;
      paint();
      track('pricedemo_furn', { furn: state.furn });
    });
    side.appendChild(fWrap);

    side.appendChild(h('div', 'ckp-baseref'));
    side.appendChild(h('p', 'ckp-foot', 'Limited demo — the grid and the rule editor really compute. Rates flex on demand, daypart and remaining inventory.'));
    root.appendChild(side);

    var main = h('div', 'ckp-main');
    main.appendChild(h('div', 'ckp-stats'));

    var tabrow = h('div', 'ckp-tabrow');
    var tabs = h('div', 'ckp-tabs',
      '<button type="button" data-view="calendar">Rate calendar</button>' +
      '<button type="button" data-view="rules">Pricing rules</button>');
    tabrow.appendChild(tabs);
    var mode = h('div', 'ckp-mode',
      '<button type="button" data-mode="door">Door rate</button>' +
      '<button type="button" data-mode="online">Book online</button>');
    tabrow.appendChild(mode);
    main.appendChild(tabrow);

    main.appendChild(h('div', 'ckp-stage'));
    main.appendChild(h('div', 'ckp-insight'));
    root.appendChild(main);

    if (OPTS.badge) {
      var bhost = h('div', 'demo-badge-host');
      root.parentNode.insertBefore(bhost, root);
      bhost.appendChild(root);
      bhost.appendChild(h('div', 'ckp-badge right', '<i></i>' + OPTS.badge));
    }

    $$('[data-view]', tabs).forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); paint(); track('pricedemo_view', { view: state.view }); });
    });
    $$('[data-mode]', mode).forEach(function (b) {
      b.addEventListener('click', function () { state.mode = b.getAttribute('data-mode'); paint(); track('pricedemo_mode', { mode: state.mode }); });
    });

    function sizeMode() { root.classList.toggle('tiny', root.clientWidth < 640); }
    sizeMode();
    if (window.ResizeObserver) new ResizeObserver(sizeMode).observe(root);
    paint();
  }

  function fillFurnOptions() {
    var list = furnInZone();
    if (!list.some(function (f) { return f.id === state.furn; })) state.furn = list[0].id;
    furnSelect.innerHTML = list.map(function (f) {
      return '<option value="' + f.id + '"' + (state.furn === f.id ? ' selected' : '') + '>' + f.name + '</option>';
    }).join('');
  }

  function filterBlock(label, key, opts) {
    var w = h('label', 'ckp-filter', label + '<select>' + opts.map(function (o) {
      return '<option' + (state[key] === o ? ' selected' : '') + '>' + o + '</option>';
    }).join('') + '</select>');
    $('select', w).addEventListener('change', function (e) {
      state[key] = e.target.value;
      if (key === 'zone') fillFurnOptions();
      paint();
      track('pricedemo_filter', { filter: key, value: e.target.value });
    });
    return w;
  }

  /* ===== paint ======================================================== */

  function paint() {
    var furn = furnObj(state.furn);

    $$('[data-view]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === state.view); });
    $$('[data-mode]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === state.mode); });
    $('.ckp-mode').style.display = state.view === 'calendar' ? '' : 'none';
    $('.ckp-baseref').innerHTML = '<span>Base rate — ' + furn.zone + '</span><b>' + money(furn.base) + '</b><em>flat reference for ' + furn.name + '</em>';

    if (state.view === 'calendar') paintCalendar(furn);
    else paintRules(furn);
  }

  function stat(label, value, sub) {
    return '<div class="ckp-stat"><span>' + label + '</span><b>' + value + '</b>' + (sub ? '<em>' + sub + '</em>' : '') + '</div>';
  }

  /* ===== calendar view ================================================ */

  function paintCalendar(furn) {
    var ext = extremes(furn, priceAt);
    var doorExt = extremes(furn, cellPrice);
    var pk = ext.peak, fl = ext.floor;

    $('.ckp-stats').innerHTML =
      stat('Base rate', money(furn.base), 'flat reference') +
      stat('Peak — ' + DAYS[pk.di].k + ' ' + DAYPARTS[pk.pi].k.toLowerCase(), money(pk.v), '+' + Math.round(pk.v / furn.base * 100 - 100) + '% vs base') +
      stat('Weekday floor', money(fl.v), DAYS[fl.di].k + ' ' + DAYPARTS[fl.pi].k.toLowerCase()) +
      stat('Book Online &amp; Save', '−' + ONLINE_SAVE + '%', 'early commitment');

    var head = '<span class="ckp-corner"></span>';
    DAYS.forEach(function (d) {
      head += '<span class="ckp-dcol"><b>' + d.k + '</b><i class="ckp-pip ' + dayTier(d.w) + '"></i></span>';
    });

    var rows = '';
    DAYPARTS.forEach(function (dp, pi) {
      rows += '<span class="ckp-dplabel"><b>' + dp.k + '</b><span>' + dp.t + '</span></span>';
      DAYS.forEach(function (d, di) {
        var price = priceAt(furn, di, pi);
        var tier = tierOf(demandVal(di, pi));
        var delta = Math.round(price / furn.base * 100 - 100);
        var dcls = delta > 3 ? 'up' : delta < -3 ? 'down' : 'flat';
        var dtxt = delta > 0 ? '+' + delta + '%' : delta < 0 ? delta + '%' : 'base';
        var rem = remaining(furn, di, pi);
        var remPct = Math.round(rem / furn.units * 100);
        rows += '<div class="ckp-cell t-' + tier.toLowerCase() + '">' +
          '<b>' + money(price) + '</b>' +
          '<span class="ckp-delta ' + dcls + '">' + dtxt + '</span>' +
          '<span class="ckp-rem" aria-hidden="true"><i style="width:' + remPct + '%"></i></span>' +
        '</div>';
      });
    });

    var modeChip = state.mode === 'online'
      ? '<span class="ckp-chip online">Book Online &amp; Save · −' + ONLINE_SAVE + '%</span>'
      : '<span class="ckp-chip door">Door rate</span>';

    $('.ckp-stage').innerHTML =
      '<div class="ckp-gridcard">' +
        '<div class="ckp-cardhead"><h4 role="presentation">' + furn.name + ' — priced by day and daypart</h4>' + modeChip + '</div>' +
        '<div class="ckp-gridwrap"><div class="ckp-grid">' + head + rows + '</div></div>' +
        '<div class="ckp-legend">' +
          '<span class="ckp-lg"><i class="ckp-pip high"></i>High demand</span>' +
          '<span class="ckp-lg"><i class="ckp-pip med"></i>Medium</span>' +
          '<span class="ckp-lg"><i class="ckp-pip low"></i>Low</span>' +
          '<span class="ckp-lg rem"><i></i>Seats remaining</span>' +
        '</div>' +
      '</div>';

    $('.ckp-insight').innerHTML = '<span class="ic">' + I.spark + '</span><p>' +
      'The same <b>' + furn.name + '</b> trades as a different product all week — a ' + DAYS[doorExt.peak.di].n +
      ' ' + DAYPARTS[doorExt.peak.pi].k.toLowerCase() + ' seat lists at <b>' + money(doorExt.peak.v) + '</b>, the quiet ' +
      DAYS[doorExt.floor.di].n + ' ' + DAYPARTS[doorExt.floor.pi].k.toLowerCase() + ' at <b>' + money(doorExt.floor.v) + '</b>. ' +
      'Rates flex on demand, daypart and remaining inventory, and Book Online &amp; Save rewards early commitment at −' + ONLINE_SAVE + '%.' +
    '</p>';
  }

  /* ===== rules view =================================================== */

  function paintRules(furn) {
    var rate = ruleRate(furn, state.rDaypart, state.rTier);
    var minSpend = state.rMin != null ? state.rMin : minDefault(rate);
    var online = onlineRate(rate, state.rSave);
    var deltaVsBase = Math.round(rate / furn.base * 100 - 100);

    $('.ckp-stats').innerHTML =
      stat('Applied rate', money(rate), (deltaVsBase >= 0 ? '+' : '') + deltaVsBase + '% vs base') +
      stat('Demand tier', state.rTier, state.rDaypart + ' daypart') +
      stat('Minimum spend', money(minSpend), 'set at booking') +
      stat('Book online rate', money(online), '−' + state.rSave + '% early');

    var dpOpts = DAYPARTS.map(function (d) {
      return '<option value="' + d.k + '"' + (state.rDaypart === d.k ? ' selected' : '') + '>' + d.k + ' · ' + d.t + '</option>';
    }).join('');
    var tierOpts = TIERS.map(function (t) {
      return '<option value="' + t + '"' + (state.rTier === t ? ' selected' : '') + '>' + t + ' demand</option>';
    }).join('');

    var listRows = PRESETS.map(function (r) {
      var f = furnObj(r.furn);
      var rr = ruleRate(f, r.dp, r.tier);
      var mn = minDefault(rr);
      var active = f.id === state.furn && r.dp === state.rDaypart && r.tier === state.rTier;
      return '<div class="ckp-rule' + (active ? ' active' : '') + '">' +
        '<div class="ckp-rule-main"><b>' + f.name + '</b><span>' + f.zone + ' · ' + r.dp + '</span></div>' +
        '<span class="ckp-tier t-' + r.tier.toLowerCase() + '">' + r.tier + '</span>' +
        '<div class="ckp-rule-num"><b>' + money(rr) + '</b><span>min ' + money(mn) + '</span></div>' +
      '</div>';
    }).join('');

    $('.ckp-stage').innerHTML =
      '<div class="ckp-rules">' +
        '<div class="ckp-editor">' +
          '<div class="ckp-cardhead"><h4 role="presentation"><span class="ic">' + I.tune + '</span>Pricing rule</h4></div>' +
          '<p class="ckp-ctx">' + furn.zone + ' · <b>' + furn.name + '</b></p>' +
          '<div class="ckp-frow">' +
            '<label class="ckp-field">Daypart<select data-r="rDaypart">' + dpOpts + '</select></label>' +
            '<label class="ckp-field">Demand tier<select data-r="rTier">' + tierOpts + '</select></label>' +
          '</div>' +
          '<div class="ckp-frow">' +
            '<label class="ckp-field">Minimum spend<span class="ckp-money"><i>$</i><input type="number" min="0" step="50" data-r="rMin" value="' + minSpend + '"></span></label>' +
            '<label class="ckp-field">Book Online &amp; Save<span class="ckp-pct"><input type="number" min="0" max="40" step="1" data-r="rSave" value="' + state.rSave + '"><i>%</i></span></label>' +
          '</div>' +
          '<div class="ckp-applied">' +
            '<div class="hero"><span>Applied rate</span><b>' + money(rate) + '</b></div>' +
            '<div><span>Book online</span><b>' + money(online) + '</b></div>' +
            '<div><span>Minimum spend</span><b>' + money(minSpend) + '</b></div>' +
          '</div>' +
        '</div>' +
        '<div class="ckp-rulelist">' +
          '<div class="ckp-cardhead"><h4 role="presentation">Rules in effect</h4></div>' +
          listRows +
        '</div>' +
      '</div>';

    $$('[data-r]', $('.ckp-stage')).forEach(function (el) {
      var key = el.getAttribute('data-r');
      var evt = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(evt, function () {
        if (key === 'rMin') { state.rMin = el.value === '' ? null : +el.value; state.rMinTouched = el.value !== ''; }
        else if (key === 'rSave') { state.rSave = Math.max(0, Math.min(40, +el.value || 0)); }
        else {
          state[key] = el.value;
          if (!state.rMinTouched) state.rMin = null; // recompute default when the rate changes
        }
        paint();
        track('pricedemo_rule', { field: key, value: el.value });
      });
    });

    $('.ckp-insight').innerHTML = '<span class="ic">' + I.spark + '</span><p>' +
      'One rule sets rate and minimum spend for a zone, daypart and demand tier — so a ' +
      state.rTier.toLowerCase() + '-demand ' + state.rDaypart.toLowerCase() + ' ' + furn.name.toLowerCase() +
      ' at <b>' + money(rate) + '</b> and a quiet midday lounger are priced as the different products they are. ' +
      'Book Online &amp; Save takes the online rate to <b>' + money(online) + '</b>.' +
    '</p>';
  }

  build();
  }
})();
