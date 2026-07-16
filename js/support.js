/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — support console demo (.cks)

   The in-suite support console for venue teams: a named support channel
   with ticket history, instead of a WhatsApp thread that scrolls away.
   Lighter companion to the operator console (js/operator.js) — same
   design language, mount/init pattern and code style. Structure:

     team-console header (brand · console name · signed-in team)
       → ticket list (filter tabs · search · rows: subject, status,
         channel tag, last-update)
       → thread detail (message thread · status control · ticket metadata
         · composer)

   Mount: <div class="cks" data-supportdemo="tickets|thread">.
   All state is local and deterministic — no network, no libraries.
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var mounts = [].slice.call(document.querySelectorAll('[data-supportdemo]'));
  if (!mounts.length) return;

  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || 'js/support.js';
  var BRAND_MARK = SCRIPT_SRC.replace(/js\/support\.js.*$/, 'brand/clubtech-mark-black-96.png');

  mounts.forEach(function (m) { createConsole(m); });

  function createConsole(root) {
  var OPTS = {
    view: root.getAttribute('data-supportdemo') || 'tickets',
    badge: root.getAttribute('data-supportdemo-badge') || ''
  };
  if (OPTS.view !== 'thread') OPTS.view = 'tickets';

  /* ===== console identity (demo data only) =========================== */

  var CONSOLE = 'Sunset Pavilion';   // fictional demo venue
  var SUPPORT = 'Clubtech Support';    // the named support channel

  var TEAM = [
    { name: 'Ava Santos', ini: 'AS', tone: 'a' },
    { name: 'Marco Reyes', ini: 'MR', tone: 'b' },
    { name: 'Priya Nair', ini: 'PN', tone: 'c' }
  ];
  var SIGNED_IN = { name: 'Ava Santos', role: 'Floor manager', tone: 'a' };

  var STATUSES = [
    { k: 'open', label: 'Open' },
    { k: 'progress', label: 'In progress' },
    { k: 'resolved', label: 'Resolved' }
  ];
  var FILTERS = [
    { k: 'all', label: 'All' },
    { k: 'open', label: 'Open' },
    { k: 'progress', label: 'In progress' },
    { k: 'resolved', label: 'Resolved' }
  ];

  /* ===== tickets (fictional demo threads) ============================ */

  var TICKETS = [
    {
      ref: 'CTG-2051', subject: 'Split payment on a group tab',
      status: 'open', channel: 'whatsapp', when: '6m', who: 'Ava Santos', tone: 'a', opened: 'Opened today',
      msgs: [
        { from: 'venue', text: 'A group on cabana 14 wants to split their tab across three cards at checkout tonight.', at: '6:28 PM' },
        { from: 'support', text: 'You can. Open the tab, tap Split, then choose evenly or by item. Each card runs as its own charge on the same tab.', at: '6:30 PM' },
        { from: 'venue', text: 'Found it. Do the receipts email to each guest separately?', at: '6:32 PM' },
        { from: 'support', text: 'Yes. Each split sends its own receipt to the email saved on that tab.', at: '6:33 PM' }
      ]
    },
    {
      ref: 'CTG-2049', subject: 'Cabana pricing not showing for Saturday',
      status: 'progress', channel: 'portal', when: '24m', who: 'Marco Reyes', tone: 'b', opened: 'Opened today',
      msgs: [
        { from: 'venue', text: 'Saturday cabanas show no price on the booking page. Beds are fine.', at: '5:58 PM' },
        { from: 'support', text: 'That zone had no Saturday rate set. I mirrored the Friday rate across, so pricing shows now.', at: '6:05 PM' },
        { from: 'venue', text: 'Confirmed, prices are back. Can we set a higher weekend rate later this week?', at: '6:11 PM' },
        { from: 'support', text: 'Yes. You can set day-specific rates per zone under Pricing, and the team can walk you through it.', at: '6:14 PM' }
      ]
    },
    {
      ref: 'CTG-2047', subject: 'Add a second host-stand device',
      status: 'open', channel: 'portal', when: '1h', who: 'Ava Santos', tone: 'a', opened: 'Opened today',
      msgs: [
        { from: 'venue', text: 'We want a second tablet at the host stand for check-ins. How do we add it?', at: '4:40 PM' },
        { from: 'support', text: 'Add it under Devices, then sign in with the same 6-digit code flow. Both stands share one live floor plan.', at: '4:52 PM' }
      ]
    },
    {
      ref: 'CTG-2044', subject: 'Refund a duplicate booking charge',
      status: 'resolved', channel: 'whatsapp', when: '3h', who: 'Priya Nair', tone: 'c', opened: 'Opened today',
      msgs: [
        { from: 'venue', text: 'A guest was charged twice for one bed booking. Can we refund one of them?', at: '2:15 PM' },
        { from: 'support', text: 'Refunded the duplicate to the original card. It will show in Payments within a few days.', at: '2:29 PM' },
        { from: 'venue', text: 'Thanks, all sorted.', at: '2:34 PM' }
      ]
    },
    {
      ref: 'CTG-2039', subject: 'Export the guest list for tonight',
      status: 'resolved', channel: 'portal', when: 'Yesterday', who: 'Marco Reyes', tone: 'b', opened: 'Opened yesterday',
      msgs: [
        { from: 'venue', text: 'Can I export tonight’s guest list for the door team?', at: 'Tue 7:10 PM' },
        { from: 'support', text: 'Open Guest list, then Export. It downloads as a CSV with names, party size and status.', at: 'Tue 7:18 PM' }
      ]
    },
    {
      ref: 'CTG-2032', subject: 'QR menu link points to the old page',
      status: 'progress', channel: 'whatsapp', when: 'Yesterday', who: 'Priya Nair', tone: 'c', opened: 'Opened yesterday',
      msgs: [
        { from: 'venue', text: 'The table QR still opens last season’s menu.', at: 'Tue 3:02 PM' },
        { from: 'support', text: 'I pointed the QR to the current menu. No reprint needed, the link stays the same.', at: 'Tue 3:20 PM' }
      ]
    }
  ];

  /* ===== state ======================================================= */

  var state = {
    view: OPTS.view,     // 'tickets' | 'thread'
    active: null,        // ticket ref
    filter: 'all',
    query: ''
  };
  state.active = (OPTS.view === 'thread' ? TICKETS[1] : TICKETS[0]).ref;

  /* ===== helpers ===================================================== */

  function $(sel, el) { return (el || root).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || root).querySelectorAll(sel)); }
  function h(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function track(n, p) { try { if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(n, p || {}); } catch (_) {} }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ticket(ref) { return TICKETS.filter(function (t) { return t.ref === ref; })[0]; }
  function statusLabel(k) { return STATUSES.filter(function (s) { return s.k === k; })[0].label; }
  function initials(name) { return name.split(' ').slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }
  function channelMeta(ch) { return ch === 'whatsapp' ? { label: 'WhatsApp', icon: I.chat } : { label: 'Portal', icon: I.portal }; }

  var I = {
    logo: '<img src="' + BRAND_MARK + '" alt="">',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4.5 6.8A2.3 2.3 0 0 1 6.8 4.5h10.4a2.3 2.3 0 0 1 2.3 2.3v6.4a2.3 2.3 0 0 1-2.3 2.3H10l-4 3.3v-3.3H6.8a2.3 2.3 0 0 1-2.3-2.3Z"/></svg>',
    portal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M8.5 20h7M12 16.5V20"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 6 8.5 12l6 6"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10.5" width="14" height="9" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>'
  };

  /* ===== shell ======================================================= */

  function setView(v) {
    state.view = v;
    root.classList.toggle('v-thread', v === 'thread');
    root.classList.toggle('v-tickets', v !== 'thread');
  }

  function build() {
    root.innerHTML = '';
    root.classList.add('cks');

    /* team-console header */
    var top = h('div', 'cks-top');
    top.appendChild(h('div', 'cks-brand',
      '<span class="cks-logo">' + I.logo + '</span>' +
      '<span class="cks-brandtxt"><b>Support</b><span>' + CONSOLE + ' · team console</span></span>'));
    var stack = TEAM.map(function (t) { return '<i class="cks-av sm ' + t.tone + '">' + t.ini + '</i>'; }).join('') +
      '<i class="cks-av sm more">+2</i>';
    top.appendChild(h('div', 'cks-who',
      '<span class="cks-stack" aria-label="Your team">' + stack + '</span>' +
      '<span class="cks-me"><span class="cks-av ' + SIGNED_IN.tone + '">' + initials(SIGNED_IN.name) + '</span>' +
      '<span class="cks-metxt"><b>' + SIGNED_IN.name + '</b><span>' + SIGNED_IN.role + '</span></span></span>'));
    root.appendChild(top);

    /* body split */
    var body = h('div', 'cks-body');
    var list = h('div', 'cks-list');
    list.innerHTML =
      '<div class="cks-listhead">' +
        '<div class="cks-tabs">' +
          FILTERS.map(function (f) { return '<button type="button" data-flt="' + f.k + '">' + f.label + '</button>'; }).join('') +
        '</div>' +
        '<label class="cks-search">' + I.search + '<input type="text" placeholder="Search tickets" aria-label="Search tickets"></label>' +
      '</div>' +
      '<div class="cks-scroll"></div>' +
      '<div class="cks-foot">' + I.lock +
        '<span>Signed in with a 6-digit code sent to your team email. Everyone on the team sees the same tickets and history.</span></div>';
    body.appendChild(list);
    body.appendChild(h('div', 'cks-detail'));
    root.appendChild(body);

    /* toast */
    var toastEl = h('div', 'cks-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    root.appendChild(toastEl);

    /* pinned demo badge (optional) */
    if (OPTS.badge) {
      var bhost = h('div', 'demo-badge-host');
      root.parentNode.insertBefore(bhost, root);
      bhost.appendChild(root);
      bhost.appendChild(h('div', 'cks-badge right', '<i></i>' + OPTS.badge));
    }

    /* wiring: filter tabs + search */
    $$('[data-flt]', list).forEach(function (b) {
      b.addEventListener('click', function () {
        state.filter = b.getAttribute('data-flt');
        renderRows();
        track('supportdemo_filter', { filter: state.filter });
      });
    });
    var inp = $('.cks-search input', list);
    inp.addEventListener('input', function () { state.query = inp.value.trim().toLowerCase(); renderRows(); });

    setView(state.view);
    renderRows();
    renderThread();

    sizeMode();
    if (window.ResizeObserver) new ResizeObserver(sizeMode).observe(root);
    window.addEventListener('load', sizeMode);
    [300, 1200].forEach(function (t) { setTimeout(sizeMode, t); });
  }

  function sizeMode() { root.classList.toggle('tiny', root.clientWidth < 640); }

  /* ===== ticket list ================================================= */

  function filtered() {
    return TICKETS.filter(function (t) {
      if (state.filter !== 'all' && t.status !== state.filter) return false;
      if (state.query && (t.subject + ' ' + t.who + ' ' + t.ref).toLowerCase().indexOf(state.query) === -1) return false;
      return true;
    });
  }

  function renderRows() {
    $$('[data-flt]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-flt') === state.filter); });
    var box = $('.cks-scroll');
    var rows = filtered();
    if (!rows.length) {
      box.innerHTML = '<p class="cks-empty">No tickets match. Try another search or filter.</p>';
      return;
    }
    box.innerHTML = rows.map(function (t) {
      var ch = channelMeta(t.channel);
      var last = t.msgs[t.msgs.length - 1];
      var prev = (last.from === 'support' ? SUPPORT + ': ' : '') + last.text;
      return '<button type="button" class="cks-tk' + (t.ref === state.active ? ' on' : '') + '" data-ref="' + t.ref + '">' +
        '<span class="cks-tk-top"><span class="cks-tk-subj">' + esc(t.subject) + '</span>' +
          '<span class="cks-st ' + t.status + '">' + statusLabel(t.status) + '</span></span>' +
        '<span class="cks-tk-prev">' + esc(prev) + '</span>' +
        '<span class="cks-tk-meta"><span class="cks-chan ' + t.channel + '">' + ch.icon + ch.label + '</span>' +
          '<span class="cks-dot"></span><span class="cks-when">' + t.when + '</span></span>' +
      '</button>';
    }).join('');
    $$('[data-ref]', box).forEach(function (b) {
      b.addEventListener('click', function () { openTicket(b.getAttribute('data-ref')); });
    });
  }

  function openTicket(ref) {
    state.active = ref;
    setView('thread');
    renderRows();
    renderThread();
    track('supportdemo_open', { ref: ref });
  }

  /* ===== thread detail =============================================== */

  function renderThread() {
    var t = ticket(state.active);
    var d = $('.cks-detail');
    var ch = channelMeta(t.channel);
    var day = t.opened.indexOf('yesterday') !== -1 ? 'Yesterday' : 'Today';

    var msgs = t.msgs.map(function (m) {
      var support = m.from === 'support';
      var name = support ? SUPPORT : t.who;
      var av = support
        ? '<span class="cks-av brand">' + I.logo + '</span>'
        : '<span class="cks-av ' + t.tone + '">' + initials(t.who) + '</span>';
      return '<div class="cks-msg ' + (support ? 'in' : 'out') + '">' + av +
        '<div class="cks-mwrap"><div class="cks-mtop"><b>' + name + '</b><span>' + m.at + '</span></div>' +
        '<div class="cks-bub">' + esc(m.text) + '</div></div></div>';
    }).join('');

    d.innerHTML =
      '<div class="cks-th-top">' +
        '<div class="cks-th-head">' +
          '<button type="button" class="cks-back" aria-label="Back to tickets">' + I.back + '</button>' +
          '<h3 class="cks-th-subj">' + esc(t.subject) + '</h3>' +
        '</div>' +
        '<div class="cks-th-sub">' +
          '<div class="cks-th-meta"><span class="cks-chan ' + t.channel + '">' + ch.icon + ch.label + '</span>' +
            '<span class="cks-dot"></span><span>' + t.ref + '</span>' +
            '<span class="cks-dot"></span><span>' + t.opened + ' by ' + esc(t.who) + '</span></div>' +
          '<div class="cks-seg" role="group" aria-label="Ticket status">' +
            STATUSES.map(function (s) {
              return '<button type="button" data-st="' + s.k + '" class="' + (t.status === s.k ? 'on' : '') + '">' + s.label + '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="cks-thread"><span class="cks-day">' + day + '</span>' + msgs + '</div>' +
      '<div class="cks-compose">' +
        '<input type="text" placeholder="Message ' + SUPPORT + '" aria-label="Write a reply">' +
        '<button type="button" class="cks-send" aria-label="Send reply">' + I.send + '</button>' +
      '</div>';

    $('.cks-back', d).addEventListener('click', function () { setView('tickets'); });
    $$('[data-st]', d).forEach(function (b) {
      b.addEventListener('click', function () { setStatus(b.getAttribute('data-st')); });
    });
    $('.cks-send', d).addEventListener('click', send);
    $('.cks-compose input', d).addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); send(); }
    });

    var thread = $('.cks-thread', d);
    thread.scrollTop = thread.scrollHeight;
  }

  function setStatus(k) {
    var t = ticket(state.active);
    if (t.status === k) return;
    t.status = k;
    renderThread();
    renderRows();
    toast('Ticket ' + t.ref + ' marked ' + statusLabel(k).toLowerCase());
    track('supportdemo_status', { ref: t.ref, status: k });
  }

  function send() {
    var inp = $('.cks-compose input');
    var v = (inp.value || '').trim();
    if (!v) return;
    var t = ticket(state.active);
    t.msgs.push({ from: 'venue', text: v, at: 'Now' });
    t.when = 'now';
    renderThread();
    renderRows();
    var ni = $('.cks-compose input');
    if (ni) ni.focus();
    track('supportdemo_reply', { ref: t.ref });
  }

  /* ===== toast ======================================================= */

  var toastId = null;
  function toast(msg) {
    var el = $('.cks-toast');
    el.textContent = msg;
    el.classList.add('show');
    if (toastId) clearTimeout(toastId);
    toastId = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('tiny') && state.view === 'thread') setView('tickets');
  });

  build();
  }
})();
