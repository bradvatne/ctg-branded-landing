/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — AI-agent bookings concept card (.cka)

   Illustrative, forward-looking visual for the Platform page. Renders a
   single clean card: a guest asks an AI assistant to book a spot, the
   assistant proposes a venue and completes the booking against Clubtech
   through a Model Context Protocol (MCP) tool call, and a compact
   confirmed-booking card appears.

   This is an EMERGING capability, not a shipped consumer feature — the
   card carries an "Emerging" tag and a "not yet available to guests"
   disclosure, and every venue/booking value is demo data only.

   Zero dependencies. No network. A subtle one-shot entrance animation
   settles to the completed state (screenshot-safe; disabled under
   prefers-reduced-motion). Companion to js/demo.js, js/operator.js and
   js/intel.js and shares their design language (see css/agentbook.css).

   Mount: <div class="cka" data-agentdemo="default">
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-agentdemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/agentbook.js';
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/agentbook\.js.*$/, 'brand/clubtech-mark-black-96.png');
  var MARK = '<img src="' + BRAND_MARK + '" alt="">';

  var I = {
    mcp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.3"/><circle cx="5" cy="18" r="2.3"/><circle cx="19" cy="18" r="2.3"/><path d="M12 7.3v3.4M12 10.7 6.7 15.9M12 10.7l5.3 5.2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>'
  };

  /* Demo data only — generic venue, no real client or person. */
  var BOOKING = {
    venue: 'Sunset Deck',
    geo: 'Pool Club · Canggu',
    spot: 'Poolside daybed',
    date: 'Sat 18 Jul',
    guests: '4',
    payment: 'Prepaid',
    ref: 'CTG-7F42K'
  };

  mounts.forEach(function (m) { build(m); });

  function build(root) {
    function track(n, p) {
      try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {}
    }
    function h(tag, cls, html) {
      var el = document.createElement(tag);
      if (cls) el.className = cls;
      if (html != null) el.innerHTML = html;
      return el;
    }

    root.innerHTML = '';
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label',
      'Illustration of an emerging capability: an AI assistant completes a demo booking on Clubtech. ' +
      'A guest asks to book a daybed at a beach club in Canggu for four this Saturday; the assistant ' +
      'confirms a prepaid poolside daybed at the demo venue Sunset Deck through the Clubtech booking MCP. ' +
      'Demo data — not yet available to guests.');

    /* header: assistant identity + Emerging tag */
    var top = h('div', 'cka-top');
    top.appendChild(h('div', 'cka-id',
      '<span class="cka-logo">' + MARK + '</span>' +
      '<span class="cka-idt"><b>AI assistant</b><small>Acting for a guest</small></span>'));
    top.appendChild(h('div', 'cka-tag', '<i></i>Emerging'));
    root.appendChild(top);

    /* conversation thread */
    var thread = h('div', 'cka-thread');

    thread.appendChild(h('div', 'cka-me',
      '<span class="cka-b">Book a daybed at a beach club in Canggu this Saturday for four.</span>'));

    var bot = h('div', 'cka-bot');
    bot.appendChild(h('span', 'cka-av', MARK));
    bot.appendChild(h('span', 'cka-b bot',
      'Sunset Deck has a poolside daybed open Saturday. Holding and prepaying it for four now.'));

    bot.appendChild(h('div', 'cka-tool',
      '<span class="cka-mcp">' + I.mcp + 'MCP</span>' +
      '<span class="cka-call">clubtech<b>.create_booking</b></span>' +
      '<span class="cka-done">' + I.check + 'completed</span>'));

    bot.appendChild(h('div', 'cka-conf',
      '<div class="cka-conf-h">' +
        '<span class="cka-vn"><b>' + BOOKING.venue + '</b><small>' + BOOKING.geo + '</small></span>' +
        '<span class="cka-ok">' + I.check + 'Confirmed</span>' +
      '</div>' +
      '<div class="cka-conf-g">' +
        '<span class="cka-f"><span>Spot</span><b>' + BOOKING.spot + '</b></span>' +
        '<span class="cka-f"><span>Date</span><b>' + BOOKING.date + '</b></span>' +
        '<span class="cka-f"><span>Guests</span><b>' + BOOKING.guests + '</b></span>' +
        '<span class="cka-f"><span>Payment</span><b>' + BOOKING.payment + '</b></span>' +
      '</div>' +
      '<div class="cka-conf-f">' +
        '<span class="cka-bt">' + MARK + 'Booked on Clubtech</span>' +
        '<span class="cka-ref">Ref ' + BOOKING.ref + '</span>' +
      '</div>'));

    thread.appendChild(bot);
    root.appendChild(thread);

    /* footer disclosure — emerging framing + demo-data honesty */
    root.appendChild(h('div', 'cka-foot',
      '<span><i></i>Emerging capability — not yet available to guests</span>' +
      '<span class="cka-demo">Demo data</span>'));

    /* responsive: collapse chrome on narrow frames */
    function sizeMode() { root.classList.toggle('tiny', root.clientWidth < 560); }
    sizeMode();
    if (window.ResizeObserver) {
      try { new ResizeObserver(sizeMode).observe(root); } catch (_) {}
    }

    track('agentdemo_view', { view: root.getAttribute('data-agentdemo') || 'default' });
  }
})();
