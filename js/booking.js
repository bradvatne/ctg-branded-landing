/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — booking experience

   Replicates the ctg-landingpage booking flow for a static host. The
   primary site's flow talks to a same-origin HubSpot proxy (/api/*);
   that proxy is not reachable cross-origin from this mirror, so this
   version uses the flow's own documented degradation path:

     1. Branded lead form (firstname, lastname, company, email, phone,
        notes) — pure Clubtech UI, no HubSpot chrome.
     2. HubSpot meetings scheduler embed (Gus's round-robin link),
        prefilled from step 1. Booking a slot creates the contact in
        HubSpot — the same guarantee the primary flow relies on when
        its lead write fails.
     3. If the embed can't load, a direct link to the scheduler.

   The scheduler iframe loads ONLY after the visitor submits the form
   (explicit intent) — nothing HubSpot-hosted loads on page view.
   Identity/events are delegated to window.CTGHubSpot (consent-gated
   pixel) and window.CTGTrack when present.

   Two mount modes, one flow:
     • Modal   — any element with [data-open-demo] opens the flow in an
                 overlay. Built lazily on first open.
     • Inline  — any element with [data-demo-inline] renders the same
                 two-step flow directly on the page, so /book-a-demo/
                 can be direct-linked (ads, emails). Rendered on load.
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var SCHEDULER = 'https://meetings-na2.hubspot.com/gus-murray/round-robin-scheduler';

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

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  /* ===== shared step markup (used by both modal + inline) ============= */

  function stepsHTML() {
    return '' +
      '  <div class="bk-step" data-step="lead">' +
      '    <span class="bk-kicker">Book a demo</span>' +
      '    <h2 class="bk-h">15 minutes.<br><span class="mint-text">No pitch deck.</span></h2>' +
      '    <p class="bk-sub">Tell us about your venue and we’ll show up with the platform configured around it — and walk you through pricing built for it.</p>' +
      '    <form class="bk-form" novalidate>' +
      '      <div class="bk-row">' +
      '        <label class="bk-field"><span>First name</span><input name="firstname" autocomplete="given-name" required></label>' +
      '        <label class="bk-field"><span>Last name</span><input name="lastname" autocomplete="family-name" required></label>' +
      '      </div>' +
      '      <label class="bk-field"><span>Venue or company</span><input name="company" autocomplete="organization" required placeholder="e.g. Finns Beach Club"></label>' +
      '      <label class="bk-field"><span>Work email</span><input name="email" type="email" autocomplete="email" required></label>' +
      '      <label class="bk-field"><span>Phone <em>(optional)</em></span><input name="phone" type="tel" autocomplete="tel" placeholder="+62 812 …"></label>' +
      '      <label class="bk-field"><span>What should we prepare? <em>(optional)</em></span><textarea name="description" rows="2"></textarea></label>' +
      '      <p class="bk-error" hidden>Please fill in your name, venue, and a valid email.</p>' +
      '      <button type="submit" class="button button-mint bk-submit">Pick a Time</button>' +
      '      <p class="bk-fine">No contracts · no credit card · we only use your details to reply</p>' +
      '    </form>' +
      '  </div>' +
      '  <div class="bk-step" data-step="schedule" hidden>' +
      '    <span class="bk-kicker">Book a demo</span>' +
      '    <h2 class="bk-h">Pick a time <span class="mint-text">that suits you.</span></h2>' +
      '    <div class="bk-cal"></div>' +
      '    <p class="bk-alt">Trouble with the calendar? <a href="' + SCHEDULER + '" target="_blank" rel="noopener">Open the scheduler in a new tab</a>.</p>' +
      '  </div>';
  }

  /* ===== lead read + flow wiring (scoped to a root element) =========== */

  function readLead(formEl) {
    var get = function (name) {
      var f = formEl.querySelector('[name="' + name + '"]');
      return f ? String(f.value || '').trim() : '';
    };
    return {
      firstname: get('firstname'),
      lastname: get('lastname'),
      company: get('company'),
      phone: get('phone'),
      email: get('email'),
      description: get('description'),
    };
  }

  /* root = the element that contains the two .bk-step blocks. */
  function wireFlow(root) {
    var form = root.querySelector('.bk-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var lead = readLead(form);
      var err = root.querySelector('.bk-error');
      if (!lead.firstname || !lead.lastname || !lead.company || !validEmail(lead.email)) {
        if (err) err.hidden = false;
        return;
      }
      if (err) err.hidden = true;

      // Stitch identity onto the consent-gated pixel and log the funnel step.
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
      cal.appendChild(iframe);
    }

    leadStep.hidden = true;
    schedStep.hidden = false;
    // Widen: modal card, or the inline container itself.
    (root.closest('.bk-card') || root).classList.add('bk-wide');
    track('scheduler_shown');
  }

  /* ===== modal mount (once, lazily) =================================== */

  var modal = null;

  function buildModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'bk-back';
    modal.id = 'bk-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'bk-title');
    modal.hidden = true;
    modal.innerHTML =
      '<div class="bk-card">' +
      '  <button type="button" class="bk-close" aria-label="Close">✕</button>' +
      stepsHTML() +
      '</div>';
    document.body.appendChild(modal);

    var card = modal.querySelector('.bk-card');
    // Give the modal title an id for aria-labelledby.
    var h = card.querySelector('[data-step="lead"] .bk-h');
    if (h) h.id = 'bk-title';

    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeModal();
    });
    card.querySelector('.bk-close').addEventListener('click', closeModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
    wireFlow(card);
    return modal;
  }

  function openModal(trigger) {
    buildModal();
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    track('demo_open', { trigger: trigger || 'unknown' });
    var first = modal.querySelector('input[name="firstname"]');
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
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

  /* ===== trigger wiring =============================================== */

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('[data-open-demo]');
    if (!t) return;
    e.preventDefault();
    var section = t.closest('section, header, footer, nav');
    openModal((section && (section.id || section.className.split(/\s+/)[0])) || 'page');
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInline);
  } else {
    initInline();
  }
})();
