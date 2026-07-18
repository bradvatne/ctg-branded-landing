/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — HubSpot behavioral tracking (pixel only)

   Ported from ctg-landingpage hubspot.js. First-party analytics pixel,
   CONSENT-GATED (marketing bucket): js.hs-scripts.com loads only after
   opt-in, mirroring consent.js. The _hsq queue is created up front so
   identify()/trackEvent() calls are safe before (and without) load —
   booking.js calls window.CTGHubSpot.identify/trackEvent.

   No UI, no iframe, no secret — the portal id is a public identifier.

   Public API: window.CTGHubSpot
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var CONFIG = {
    portalId: '242607066',
    trackingSrc: 'https://js.hs-scripts.com/242607066.js',
  };

  // Anything pushed before the script loads is replayed by HubSpot on load;
  // if the script never loads (no consent), pushes sit in the array untransmitted.
  window._hsq = window._hsq || [];

  var trackingLoaded = false;
  var STORE_KEY = 'ctg-hs-pending';

  function loadTracking() {
    if (trackingLoaded) return;
    trackingLoaded = true;
    var s = document.createElement('script');
    s.id = 'hs-script-loader';
    s.async = true;
    s.defer = true;
    s.src = CONFIG.trackingSrc;
    document.head.appendChild(s);
    replayPending();
  }

  // A lead submitted before marketing consent is persisted; replay it once the
  // pixel loads (this session or a later visit) so the contact still lands.
  function replayPending() {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (_) {}
    if (!raw) return;
    try {
      var t = JSON.parse(raw);
      if (t && t.email) { window._hsq.push(['identify', t]); window._hsq.push(['trackPageView']); }
    } catch (_) {}
    try { localStorage.removeItem(STORE_KEY); } catch (_) {}
  }

  function wireConsent() {
    function maybeLoad(prefs) {
      if (prefs && prefs.marketing) loadTracking();
    }
    var stored = window.CTGConsent && window.CTGConsent.get && window.CTGConsent.get();
    if (stored && stored.prefs) maybeLoad(stored.prefs);
    window.addEventListener('ctg:consent', function (e) { maybeLoad(e.detail); });
  }

  function identify(traits) {
    if (!traits || !traits.email) return;
    window._hsq.push(['identify', traits]);
    window._hsq.push(['trackPageView']);
    if (!trackingLoaded) {
      // No marketing consent yet — persist so a later opt-in still lands the lead.
      try { localStorage.setItem(STORE_KEY, JSON.stringify(traits)); } catch (_) {}
    }
  }

  function trackEvent(name, properties) {
    if (!name) return;
    window._hsq.push(['trackCustomBehavioralEvent', {
      name: name,
      properties: properties || {}
    }]);
  }

  window.CTGHubSpot = {
    identify: identify,
    trackEvent: trackEvent,
    config: CONFIG
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireConsent);
  } else {
    wireConsent();
  }
})();
