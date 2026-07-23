/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — Cookie Consent (GDPR / ePrivacy compliant)

   Ported from ctg-landingpage consent.js. Loads Google Tag Manager only
   after consent; the GTM container fans out to GA4 / Meta Pixel / etc.
   Granular consent state propagates via Google Consent Mode v2.
   Same GTM container + Ads tag as www.clubtechglobal.com — traffic from
   this host is distinguished by hostname in GA4.
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const CONFIG = {
    gtm: { id: 'GTM-56T5JJJV', gatewayPath: '/metrics/' },
    googleAds: { id: 'AW-17041977260' },
    consentVersion: '2',
    storageKey: 'ctg-consent',
    attributionKey: 'ctg-attribution',
    attributionTtlMs: 30 * 24 * 60 * 60 * 1000
  };

  /* ── First-touch attribution (functional, no PII) ─────────────── */
  const ATTR_PARAMS = [
    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
    'gclid', 'fbclid', 'msclkid', 'ttclid', 'li_fat_id'
  ];

  function captureAttribution() {
    let stored = null;
    try {
      const raw = localStorage.getItem(CONFIG.attributionKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.first_seen_at &&
            (Date.now() - new Date(parsed.first_seen_at).getTime()) < CONFIG.attributionTtlMs) {
          stored = parsed;
        }
      }
    } catch (_) {}

    let params;
    try { params = new URLSearchParams(location.search); } catch (_) { params = null; }
    const fresh = {};
    if (params) {
      ATTR_PARAMS.forEach(function (k) {
        const v = params.get(k);
        if (v) fresh[k] = v.slice(0, 200);
      });
    }

    let referrerHost = '';
    try {
      if (document.referrer) {
        const u = new URL(document.referrer);
        if (u.hostname && u.hostname !== location.hostname) referrerHost = u.hostname;
      }
    } catch (_) {}

    if (stored && Object.keys(fresh).length === 0) {
      window.CTGAttribution = { get: function () { return stored; } };
      return;
    }

    const now = new Date().toISOString();
    const record = stored
      ? Object.assign({}, stored, {
          last_touch: Object.assign({ at: now, referrer_host: referrerHost }, fresh)
        })
      : Object.assign({
          first_seen_at: now,
          first_referrer_host: referrerHost,
          first_landing_path: location.pathname
        }, fresh);

    try { localStorage.setItem(CONFIG.attributionKey, JSON.stringify(record)); } catch (_) {}
    window.CTGAttribution = { get: function () { return record; } };
  }

  captureAttribution();

  /* ── Google Consent Mode v2 — fallback for non-standard pages ─── */
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  if (!window.__ctgConsentDefaulted) {
    window.__ctgConsentDefaulted = true;
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
      functionality_storage: 'granted',
      security_storage: 'granted',
      wait_for_update: 500
    });
  }

  /* ── Storage helpers ──────────────────────────────────────────── */
  function readStored() {
    try {
      const raw = localStorage.getItem(CONFIG.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.version !== CONFIG.consentVersion) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeStored(prefs) {
    const record = {
      version: CONFIG.consentVersion,
      timestamp: new Date().toISOString(),
      prefs: {
        necessary: true,
        analytics: !!prefs.analytics,
        marketing: !!prefs.marketing
      }
    };
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(record)); } catch (_) {}
    return record;
  }

  /* ── Vendor loaders ───────────────────────────────────────────── */
  /* NOTE: Google Ads (AW-17041977260) is configured by the Google tag
     inside GTM (container GTM-56T5JJJV) — GTM is the SINGLE owner of the
     Ads tag. Do NOT re-add a loadGoogleAds()/gtag('config', AW…) here or
     the Ads tag loads twice. CONFIG.googleAds.id is kept for reference. */
  let gtmLoaded = false;

  function loadGTM() {
    if (gtmLoaded || !CONFIG.gtm.id) return;
    gtmLoaded = true;
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
      const f = d.getElementsByTagName(s)[0];
      const j = d.createElement(s);
      const dl = l !== 'dataLayer' ? '&l=' + l : '';
      j.async = true;
      j.src = CONFIG.gtm.gatewayPath + '?id=' + encodeURIComponent(i) + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, 'script', 'dataLayer', CONFIG.gtm.id);
  }

  /* ── Apply consent ────────────────────────────────────────────── */
  function applyConsent(prefs) {
    gtag('consent', 'update', {
      analytics_storage: prefs.analytics ? 'granted' : 'denied',
      ad_storage: prefs.marketing ? 'granted' : 'denied',
      ad_user_data: prefs.marketing ? 'granted' : 'denied',
      ad_personalization: prefs.marketing ? 'granted' : 'denied'
    });

    if (prefs.analytics || prefs.marketing) {
      loadGTM();
    }

    window.dispatchEvent(new CustomEvent('ctg:consent', { detail: prefs }));
  }

  /* ── UI ───────────────────────────────────────────────────────── */
  function qs(sel) { return document.querySelector(sel); }
  let prefsReturnFocus = null;
  let bodyOverflowBeforePrefs = '';

  function focusableWithin(el) {
    return el.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
  }

  function showBanner() { const el = qs('#cc-banner'); if (el) el.removeAttribute('hidden'); }
  function hideBanner() { const el = qs('#cc-banner'); if (el) el.setAttribute('hidden', ''); }
  function showPrefs(currentPrefs) {
    const el = qs('#cc-prefs');
    if (!el) return;
    prefsReturnFocus = document.activeElement;
    bodyOverflowBeforePrefs = document.body.style.overflow;
    el.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    const aToggle = qs('#cc-toggle-analytics');
    const mToggle = qs('#cc-toggle-marketing');
    if (aToggle) aToggle.checked = !!currentPrefs.analytics;
    if (mToggle) mToggle.checked = !!currentPrefs.marketing;
    const close = qs('#cc-prefs-close');
    if (close) close.focus();
  }
  function hidePrefs() {
    const el = qs('#cc-prefs');
    if (el) el.setAttribute('hidden', '');
    document.body.style.overflow = bodyOverflowBeforePrefs;
    if (prefsReturnFocus && typeof prefsReturnFocus.focus === 'function') prefsReturnFocus.focus();
    prefsReturnFocus = null;
    bodyOverflowBeforePrefs = '';
  }

  function acceptAll() {
    const prefs = { analytics: true, marketing: true };
    writeStored(prefs);
    applyConsent(prefs);
    hideBanner(); hidePrefs();
  }

  function rejectAll() {
    const prefs = { analytics: false, marketing: false };
    writeStored(prefs);
    applyConsent(prefs);
    clearTrackingCookies();
    hideBanner(); hidePrefs();
    if (gtmLoaded) location.reload();
  }

  function clearTrackingCookies() {
    const parts = location.hostname.split('.');
    const domains = ['', location.hostname, '.' + location.hostname];
    if (parts.length >= 2) domains.push('.' + parts.slice(-2).join('.'));
    const matches = (n) => /^_ga(_|$)|^_gid$|^_gcl_/.test(n) || n === '_fbp' || n === '_fbc' || /^_uet/.test(n) || /^ph_/.test(n) || n === '_clck' || n === '_clsk';
    document.cookie.split(';').forEach(function (c) {
      const name = c.split('=')[0].trim();
      if (!matches(name)) return;
      domains.forEach(function (d) {
        const dAttr = d ? '; domain=' + d : '';
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + dAttr;
      });
    });
    try {
      Object.keys(localStorage).forEach(function (k) {
        if (/^(?:ph_|_gcl_)/.test(k)) localStorage.removeItem(k);
      });
    } catch (_) {}
  }

  function saveFromPrefs() {
    const aToggle = qs('#cc-toggle-analytics');
    const mToggle = qs('#cc-toggle-marketing');
    const prefs = {
      analytics: aToggle ? aToggle.checked : false,
      marketing: mToggle ? mToggle.checked : false
    };
    writeStored(prefs);
    applyConsent(prefs);
    hideBanner(); hidePrefs();
  }

  function openPreferences() {
    const stored = readStored();
    const current = stored ? stored.prefs : { analytics: false, marketing: false };
    showPrefs(current);
  }

  function wire() {
    const on = function (sel, fn) { const el = qs(sel); if (el) el.addEventListener('click', fn); };
    on('#cc-accept', acceptAll);
    on('#cc-reject', rejectAll);
    on('#cc-customize', function () { openPreferences(); });
    on('#cc-save', saveFromPrefs);
    on('#cc-prefs-accept', acceptAll);
    on('#cc-prefs-reject', rejectAll);
    on('#cc-prefs-close', hidePrefs);
    const prefsBack = qs('#cc-prefs');
    if (prefsBack) prefsBack.addEventListener('click', function (e) {
      if (e.target === prefsBack) hidePrefs();
    });
    document.addEventListener('keydown', function (e) {
      const p = qs('#cc-prefs');
      if (e.key === 'Escape' && p && !p.hasAttribute('hidden')) hidePrefs();
      if (e.key !== 'Tab' || !p || p.hasAttribute('hidden')) return;
      const items = focusableWithin(p);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    document.addEventListener('click', function (e) {
      const t = e.target.closest && e.target.closest('[data-open-consent]');
      if (t) { e.preventDefault(); openPreferences(); }
    });
  }

  window.CTGConsent = {
    open: openPreferences,
    acceptAll: acceptAll,
    rejectAll: rejectAll,
    get: function () { return readStored(); },
    reset: function () {
      try { localStorage.removeItem(CONFIG.storageKey); } catch (_) {}
      location.reload();
    }
  };

  function boot() {
    wire();
    const stored = readStored();
    if (stored) {
      applyConsent(stored.prefs);
      return;
    }
    if (navigator.globalPrivacyControl === true) {
      rejectAll();
      return;
    }
    showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
