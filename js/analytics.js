/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — Analytics / Event Tracking

   Ported from ctg-landingpage analytics.js and adapted to this site's
   sections. Pushes events onto window.dataLayer; the GTM container loaded
   by consent.js fans out to GA4 / Meta Pixel per the GTM dashboard config.
   Events queued before GTM loads wait in the dataLayer and only leave the
   page if/when consent is granted.

   Public API: window.CTGTrack.event(name, props)
   ────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  function pageSlug() {
    const cls = (document.body && document.body.className) || '';
    const m = cls.match(/\bp(?:age)?-([a-z0-9-]+)\b/);
    if (m) return m[1];
    const p = (location.pathname || '/').replace(/^\/+|\/+$/g, '');
    return p === '' ? 'index' : p.replace(/\.html$/, '');
  }

  function attribution() {
    try { return (window.CTGAttribution && window.CTGAttribution.get()) || null; }
    catch (_) { return null; }
  }

  function track(event, props) {
    props = props || {};
    const attr = attribution();
    const enriched = Object.assign(
      { event: event, page_slug: pageSlug(), page_path: location.pathname },
      attr ? {
        utm_source: attr.utm_source || '',
        utm_medium: attr.utm_medium || '',
        utm_campaign: attr.utm_campaign || '',
        utm_term: attr.utm_term || '',
        utm_content: attr.utm_content || '',
        gclid: attr.gclid || '',
        fbclid: attr.fbclid || '',
        first_referrer_host: attr.first_referrer_host || '',
        first_landing_path: attr.first_landing_path || ''
      } : {},
      props
    );
    window.dataLayer = window.dataLayer || [];
    try { window.dataLayer.push(enriched); } catch (_) {}
  }

  /* ── Helpers ────────────────────────────────────────────────── */
  function sectionOf(el) {
    const sec = el.closest && el.closest('section, header, nav, footer, [id]');
    if (sec && sec.id) return sec.id;
    if (sec && sec.tagName) return sec.tagName.toLowerCase();
    return 'unknown';
  }
  function cleanText(s) {
    return (s || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  /* ── Click tracking ─────────────────────────────────────────── */
  function onDocClick(e) {
    const t = e.target;

    // Demo CTAs — the pill buttons that lead to #contact or mailto
    const demoBtn = t.closest && t.closest('.button');
    if (demoBtn) {
      const href = demoBtn.getAttribute('href') || '';
      track('cta_click', {
        cta_label: cleanText(demoBtn.textContent),
        cta_location: sectionOf(demoBtn),
        cta_type: /mailto:|#contact/.test(href) ? 'demo' : 'nav'
      });
      if (/^mailto:/.test(href)) {
        track('outbound_email', {
          address: href.replace('mailto:', ''),
          location: sectionOf(demoBtn)
        });
      }
      return;
    }

    // Explicit data-track attribute
    const custom = t.closest && t.closest('[data-track]');
    if (custom) {
      const name = custom.getAttribute('data-track');
      let props = {};
      const raw = custom.getAttribute('data-track-props');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            delete parsed.__proto__;
            delete parsed.constructor;
            delete parsed.prototype;
            props = parsed;
          }
        } catch (_) {}
      }
      props.cta_location = props.cta_location || sectionOf(custom);
      props.cta_label = props.cta_label || cleanText(custom.textContent);
      track(name, props);
      return;
    }

    // Blog directory rows
    const indexRow = t.closest && t.closest('.index-row');
    if (indexRow) {
      track('blog_card_click', {
        href: indexRow.getAttribute('href') || '',
        title: cleanText((indexRow.querySelector('.index-title') || indexRow).textContent)
      });
      return;
    }

    // Blog category filter
    const chip = t.closest && t.closest('.filter-chip');
    if (chip) {
      track('blog_filter', { category: chip.dataset.filter || cleanText(chip.textContent) });
      return;
    }

    // Featured blog card
    const featured = t.closest && t.closest('.featured-card');
    if (featured) {
      track('blog_card_click', {
        href: featured.getAttribute('href') || '',
        title: cleanText((featured.querySelector('h2') || featured).textContent),
        featured: true
      });
      return;
    }

    // Nav links
    const navLink = t.closest && t.closest('.nav-links a, .brand, .mobile-menu a');
    if (navLink) {
      track('nav_click', {
        label: cleanText(navLink.textContent) || 'brand',
        href: navLink.getAttribute('href') || ''
      });
      return;
    }

    // Outbound mailto (non-button)
    const mailto = t.closest && t.closest('a[href^="mailto:"]');
    if (mailto) {
      track('outbound_email', {
        address: mailto.getAttribute('href').replace('mailto:', ''),
        location: sectionOf(mailto)
      });
      return;
    }

    // Generic outbound link
    const anyLink = t.closest && t.closest('a[href]');
    if (anyLink) {
      const href = anyLink.getAttribute('href') || '';
      if (/^https?:\/\//i.test(href)) {
        try {
          const u = new URL(href, location.href);
          if (u.hostname && u.hostname !== location.hostname) {
            track('outbound_click', {
              link_url: href,
              link_host: u.hostname,
              link_text: cleanText(anyLink.textContent),
              location: sectionOf(anyLink)
            });
            return;
          }
        } catch (_) {}
      }
    }

    // Footer links
    const footLink = t.closest && t.closest('.footer a[href]');
    if (footLink) {
      track('footer_click', {
        label: cleanText(footLink.textContent),
        href: footLink.getAttribute('href') || ''
      });
    }
  }

  /* ── FAQ opens (homepage <details> accordion) ───────────────── */
  function wireFaq() {
    document.querySelectorAll('.faq-item').forEach(function (item) {
      item.addEventListener('toggle', function () {
        if (item.open) {
          const q = item.querySelector('h3');
          track('faq_open', { question: cleanText((q || item).textContent) });
        }
      });
    });
  }

  /* ── Scroll depth (25 / 50 / 75 / 100) ──────────────────────── */
  function wireScrollDepth() {
    const hit = { 25: false, 50: false, 75: false, 100: false };
    function onScroll() {
      const doc = document.documentElement;
      const scrolled = window.scrollY + window.innerHeight;
      const max = Math.max(doc.scrollHeight, document.body.scrollHeight);
      if (max <= window.innerHeight) return;
      const pct = Math.min(100, Math.round((scrolled / max) * 100));
      [25, 50, 75, 100].forEach(function (threshold) {
        if (!hit[threshold] && pct >= threshold) {
          hit[threshold] = true;
          track('scroll_depth', { percent: threshold });
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── Section views (once per section per pageview) ──────────── */
  function wireSectionViews() {
    const selectors = [
      '#top', '#platform', '#booking', '#operations', '#guest-data',
      '#intelligence', '#delivery', '#pricing', '#faq', '#contact',
      '.footer', '.index-hero', '.index-featured', '.index-list-wrap',
      '.post-hero', '.post-body', '.post-more'
    ];
    const seen = new Set();
    const nodes = [];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (n) { nodes.push(n); });
    });
    if (!nodes.length || typeof IntersectionObserver !== 'function') return;
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        const id = e.target.id || e.target.className.split(/\s+/)[0] || 'unknown';
        if (seen.has(id)) return;
        seen.add(id);
        track('section_view', { section: id });
      });
    }, { threshold: 0.35 });
    nodes.forEach(function (n) { obs.observe(n); });
  }

  /* ── Boot ───────────────────────────────────────────────────── */
  function boot() {
    document.addEventListener('click', onDocClick, true);
    wireFaq();
    wireScrollDepth();
    wireSectionViews();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.CTGTrack = { event: track };
})();
