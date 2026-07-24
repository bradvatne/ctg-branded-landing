/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — booking experience

   Replicates the ctg-landingpage booking flow for a static host. The
   primary site's flow talks to a same-origin HubSpot proxy (/api/*);
   that proxy is not reachable cross-origin from this mirror, so this
   version uses the flow's own documented degradation path:

     1. Branded lead form (name, company, email, phone, notes) — pure
        Clubtech UI, no HubSpot chrome. The single Name field is split
        into firstname/lastname for HubSpot on submit.
     2. HubSpot meetings scheduler embed (Gus's personal link),
        prefilled from step 1. Booking a slot creates the contact in
        HubSpot — the same guarantee the primary flow relies on when
        its lead write fails.
     3. If the embed can't load, a direct link to the scheduler.

   The scheduler iframe loads ONLY after the visitor submits the form
   (explicit intent) — nothing HubSpot-hosted loads on page view.
   Identity/events are delegated to window.CTGHubSpot (consent-gated
   pixel) and window.CTGTrack when present.

   One mount mode:
     • Inline — any element with [data-demo-inline] renders the two-step
                flow directly on the page. All "Book a Demo" CTAs are
                plain links to /book-a-demo/ (no modal — every path lands
                on the direct-linkable page: ads, emails, nav).
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var SCHEDULER = 'https://meetings-na2.hubspot.com/gus-murray';
  var LEAD_ENDPOINT = '/api/lead'; // same-origin Cloudflare Worker — server-side capture (consent-independent)
  var demoBookedTracked = false;

  function track(name, props) {
    try {
      if (window.CTGHubSpot && window.CTGHubSpot.trackEvent) window.CTGHubSpot.trackEvent(name, props || {});
    } catch (_) {}
    try {
      if (window.CTGTrack && window.CTGTrack.event) window.CTGTrack.event(name, props || {});
    } catch (_) {}
  }

  function identify(traits) {
    try { if (window.CTGHubSpot && window.CTGHubSpot.identify) window.CTGHubSpot.identify(traits); } catch (_) {}
  }

  /* Enhanced Conversions: push a SHA-256 hash of the normalized email onto the
     dataLayer so GTM's Google Ads user-provided-data tag ("Ads - EC user_data")
     can attach it to the demo conversions. The RAW email never enters the
     dataLayer — only the hash. Async; fired at form submit so it is present
     before the later demo_booked conversion. */
  function pushEmailHash(email) {
    try {
      var norm = String(email || '').trim().toLowerCase();
      if (!norm || !window.crypto || !window.crypto.subtle) return;
      window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm)).then(function (buf) {
        var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) {
          return b.toString(16).padStart(2, '0');
        }).join('');
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ em_sha256: hex });
      }).catch(function () {});
    } catch (_) {}
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  /* ===== shared step markup (used by both modal + inline) ============= */

  function stepsHTML() {
    return '' +
      '  <div class="bk-step" data-step="lead">' +
      '    <span class="bk-kicker">Book a demo</span>' +
      '    <h2 class="bk-h">Your venue, <span class="mint-text">doing more.</span></h2>' +
      '    <p class="bk-sub">Find out how you can bring in more bookings, more revenue per bed, and unlock powerful marketing under your own brand.</p>' +
      '    <form class="bk-form" novalidate>' +
      '      <label class="bk-field"><span>Name</span><input name="name" autocomplete="name" required></label>' +
      '      <label class="bk-field"><span>Venue or company</span><input name="company" autocomplete="organization" required placeholder="e.g. Finns Beach Club"></label>' +
      '      <label class="bk-field"><span>Work email</span><input name="email" type="email" autocomplete="email" required></label>' +
      '      <label class="bk-field"><span>Phone <em>(optional)</em></span><input name="phone" type="tel" autocomplete="tel" placeholder="+62 812 …"></label>' +
      '      <label class="bk-field"><span>What should we prepare? <em>(optional)</em></span><textarea name="description" rows="2"></textarea></label>' +
      // Honeypot: hidden from humans, tempting to bots. A filled value is dropped server-side.
      '      <div class="bk-hp" aria-hidden="true"><label>Company website<input type="text" name="company_url" tabindex="-1" autocomplete="off"></label></div>' +
      '      <p class="bk-error" role="alert" hidden>Please fill in your name, venue, and a valid email.</p>' +
      '      <button type="submit" class="button button-mint bk-submit">Pick a Time</button>' +
      '    </form>' +
      '  </div>' +
      '  <div class="bk-step" data-step="schedule" hidden>' +
      '    <span class="bk-kicker">Book a demo</span>' +
      '    <h2 class="bk-h" tabindex="-1">Pick a time <span class="mint-text">that suits you.</span></h2>' +
      '    <div class="bk-cal" aria-live="polite"><p class="bk-cal-status">Loading the scheduler…</p></div>' +
      '    <p class="bk-alt">Trouble with the calendar? <a href="' + SCHEDULER + '" target="_blank" rel="noopener">Open the scheduler in a new tab</a>.</p>' +
      '  </div>';
  }

  /* ===== lead read + flow wiring (scoped to a root element) =========== */

  function readLead(formEl) {
    var get = function (name) {
      var f = formEl.querySelector('[name="' + name + '"]');
      return f ? String(f.value || '').trim() : '';
    };
    // Single Name field, split for HubSpot: first word → firstname,
    // the rest → lastname (may be empty — the worker treats it as optional).
    var name = get('name');
    var parts = name.split(/\s+/);
    return {
      name: name,
      firstname: parts[0] || '',
      lastname: parts.slice(1).join(' '),
      company: get('company'),
      phone: get('phone'),
      email: get('email'),
      description: get('description'),
    };
  }

  /* First-touch attribution captured (functionally, no consent) by consent.js. */
  function attribution() {
    var out = {};
    try {
      var a = window.CTGAttribution && window.CTGAttribution.get && window.CTGAttribution.get();
      if (a) {
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
          'gclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id'].forEach(function (k) {
          if (a[k]) out[k] = a[k];
        });
      }
    } catch (_) {}
    return out;
  }

  /* HubSpot pixel cookie — present only if marketing consent was granted. */
  function hubspotutk() {
    try {
      var m = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : '';
    } catch (_) { return ''; }
  }

  /* PRIMARY capture: server-side write to HubSpot via the same-origin /api/lead
     Worker. Fire-and-forget — records a success/fail state (for analytics) but
     never blocks the UI, so a lead lands even when cookies are rejected and the
     visitor never books. keepalive lets it finish if the tab closes on submit. */
  function sendLead(form, lead) {
    var hp = form.querySelector('[name="company_url"]');
    var payload = {
      firstname: lead.firstname,
      lastname: lead.lastname,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      description: lead.description,
      company_url: hp ? String(hp.value || '') : '', // honeypot — must stay empty
      page: location.pathname,
      pageName: document.title,
      hutk: hubspotutk()
    };
    var utm = attribution();
    for (var k in utm) if (Object.prototype.hasOwnProperty.call(utm, k)) payload[k] = utm[k];

    try {
      fetch(LEAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
        credentials: 'omit'
      }).then(function (r) {
        track(r && r.ok ? 'lead_captured' : 'lead_capture_failed', { status: r ? r.status : 0 });
      }).catch(function () {
        track('lead_capture_failed', { status: 0 });
      });
    } catch (_) {
      track('lead_capture_failed', { status: 0 });
    }
  }

  /* root = the element that contains the two .bk-step blocks. */
  function wireFlow(root) {
    var form = root.querySelector('.bk-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lead = readLead(form);
      var err = root.querySelector('.bk-error');
      var required = [
        form.querySelector('[name="name"]'),
        form.querySelector('[name="company"]'),
        form.querySelector('[name="email"]')
      ];
      for (var i = 0; i < required.length; i++) {
        if (required[i]) required[i].removeAttribute('aria-invalid');
      }
      if (!lead.name || !lead.company || !validEmail(lead.email)) {
        if (err) err.hidden = false;
        var invalid = !lead.name ? required[0]
          : !lead.company ? required[1]
          : required[2];
        if (invalid) {
          invalid.setAttribute('aria-invalid', 'true');
          invalid.focus();
        }
        return;
      }
      if (err) err.hidden = true;

      // PRIMARY: server-side capture. Consent-independent, survives no-booking,
      // and runs first so the lead is on its way before anything else.
      sendLead(form, lead);

      // Enhanced Conversions: hash the email onto the dataLayer now so it is
      // available before the demo_booked conversion fires (raw email is never pushed).
      pushEmailHash(lead.email);

      // SECONDARY: stitch identity onto the consent-gated pixel and log the
      // funnel step (both no-op without marketing consent).
      identify({
        email: lead.email,
        firstname: lead.firstname,
        lastname: lead.lastname,
        company: lead.company,
        phone: lead.phone,
      });
      track('demo_submit', { has_phone: !!lead.phone, has_notes: !!lead.description });

      showScheduler(root, lead);
    });
  }

  function showScheduler(root, lead) {
    var leadStep = root.querySelector('[data-step="lead"]');
    var schedStep = root.querySelector('[data-step="schedule"]');
    var cal = schedStep.querySelector('.bk-cal');

    // The embed is created only now — HubSpot assets load on explicit
    // intent, never on page view.
    if (!cal.querySelector('iframe')) {
      var qs = new URLSearchParams({
        embed: 'true',
        firstName: lead.firstname,
        lastName: lead.lastname,
        email: lead.email,
      });
      var iframe = document.createElement('iframe');
      iframe.src = SCHEDULER + '?' + qs.toString();
      iframe.title = 'Book a demo — pick a time';
      iframe.loading = 'eager';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.addEventListener('load', function () {
        var status = cal.querySelector('.bk-cal-status');
        if (status) status.remove();
      });
      iframe.addEventListener('error', function () {
        var status = cal.querySelector('.bk-cal-status');
        if (status) status.textContent = 'The embedded calendar could not load. Use the direct scheduler link below.';
      });
      cal.appendChild(iframe);
    }

    leadStep.hidden = true;
    schedStep.hidden = false;
    root.classList.add('bk-wide'); // widen the inline container for the calendar
    track('scheduler_shown');
    var heading = schedStep.querySelector('.bk-h');
    if (heading) heading.focus();
  }

  /* ===== inline mount(s) ============================================== */

  function initInline() {
    var nodes = document.querySelectorAll('[data-demo-inline]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute('data-bk-mounted')) continue;
      el.setAttribute('data-bk-mounted', '1');
      el.classList.add('bk-inline');
      el.innerHTML = stepsHTML();
      wireFlow(el);
      track('demo_open', { trigger: 'inline' });
    }
  }

  /* ===== HubSpot meetings success → true "demo booked" conversion ===== */
  /* The scheduler runs in a cross-origin HubSpot iframe and posts a message
     when a slot is actually booked. That on-calendar booking is the real
     conversion — distinct from demo_submit (lead form only). GTM maps
     demo_booked -> the Google Ads "Demo booked" conversion action. */
  function originHost(origin) {
    try { return new URL(origin).hostname; } catch (_) { return ''; }
  }
  window.addEventListener('message', function (e) {
    var d = e && e.data;
    if (!d || d.meetingBookSucceeded !== true) return;       // HubSpot Meetings success signal
    if (!/(^|\.)hubspot\.com$/i.test(originHost(e.origin))) return; // trust only HubSpot origins
    if (demoBookedTracked) return;                            // HubSpot may repeat its success message
    demoBookedTracked = true;
    track('demo_booked', { source: 'hubspot_meetings' });
  }, false);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInline);
  } else {
    initInline();
  }
})();
