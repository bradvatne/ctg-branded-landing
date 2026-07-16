#!/usr/bin/env node
/* Clubtech branded landing — blog build.
   Ports the ctg-landingpage blog protocol (content/blog/*.md → blog/) with
   zero dependencies: a built-in markdown renderer replaces marked, and the
   listing is emitted as final static HTML (no PHP cache layer).

   Emits:
     blog/<slug>/index.html   (one page per post)
     blog/index.html          (the directory/listing page)
     sitemap.xml

   Frontmatter (flat key: value lines, optional quotes — NOT full YAML):
   title, titleTag, slug, date, author, category, excerpt, hero, heroAlt,
   description. A "## Questions operators ask" section emits FAQPage JSON-LD.

   Canonicals: every post canonicalizes to the original article on
   www.clubtechglobal.com — this Pages site is a branded mirror and must not
   compete with the primary blog in search. For the same reason sitemap.xml
   lists only this site's own indexable URLs (/ and /blog/), not the posts.

   Usage: node scripts/build-blog.mjs   (or: npm run build:blog)
*/

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'content', 'blog');
const PAGES_DIR = join(ROOT, 'content', 'pages');
const OUT_DIR = join(ROOT, 'blog');
const SITE_ORIGIN = 'https://www.clubtechglobal.com';
const CANONICAL_ORIGIN = 'https://www.clubtechglobal.com';
const PAGE_SECTIONS = { solutions: 'Solutions', compare: 'Compare' };

/* ─── Frontmatter parser (same contract as ctg-landingpage) ──── */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Missing frontmatter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    meta[key] = val;
  }
  return { meta, body: m[2] };
}

/* ─── HTML helpers ───────────────────────────────────────────── */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escScriptJson = (s) => String(s).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

function sanitizeBlogHtml(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<object\b[\s\S]*?<\/object\s*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/\b(href|src|action|formaction)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[^"']*\2/gi, '$1="#"');
}

/* ─── Minimal markdown renderer ──────────────────────────────── */
/* Covers the authoring subset the blog protocol allows: ##/### headings,
   paragraphs, **bold**, _italic_/*italic*, [text](href), `code`,
   -/* unordered lists, 1. ordered lists, > blockquotes, --- rules.
   Raw HTML in the source is escaped (the protocol strips it anyway). */
function inlineMd(text) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,:;!?]|$)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,:;!?]|$)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    let safe = /^(https?:\/\/|\/|#|mailto:)/.test(href) ? href : '#';
    // Root-relative links come from content written for www.clubtechglobal.com;
    // on this subpath-hosted mirror they must point at the primary site.
    if (safe.startsWith('/')) safe = CANONICAL_ORIGIN + safe;
    const ext = /^https?:\/\//.test(safe) ? ' rel="noopener"' : '';
    return `<a href="${esc(safe)}"${ext}>${label}</a>`;
  });
  return out;
}

function renderMarkdown(md) {
  // HTML comments (e.g. <!-- VERIFY: ... --> author flags) stay in the
  // source but must never render — raw HTML is escaped, so without this
  // they'd appear as visible text on the published page.
  md = md.replace(/<!--[\s\S]*?-->/g, '');
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let para = [];
  let list = null; // {tag, items}
  let table = [];
  let quote = [];

  const flushPara = () => {
    if (para.length) { out.push(`<p>${inlineMd(para.join(' ').trim())}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) { out.push(`<${list.tag}>` + list.items.map((i) => `<li>${inlineMd(i)}</li>`).join('') + `</${list.tag}>`); list = null; }
  };
  const flushQuote = () => {
    if (quote.length) { out.push(`<blockquote><p>${inlineMd(quote.join(' ').trim())}</p></blockquote>`); quote = []; }
  };

  const flushTable = () => {
    if (!table.length) return;
    const rows = table.map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    const sepAt = rows.findIndex(r => r.every(c => /^:?-{3,}:?$/.test(c)));
    const head = sepAt > 0 ? rows[0] : null;
    const body = rows.filter((r, i) => i !== sepAt && (head ? i !== 0 : true) && !r.every(c => /^:?-{3,}:?$/.test(c)));
    let html = '<div class="cmp-table"><table>';
    if (head) html += '<thead><tr>' + head.map(c => `<th scope="col">${inlineMd(c)}</th>`).join('') + '</tr></thead>';
    html += '<tbody>' + body.map(r => '<tr>' + r.map((c, i) => i === 0 ? `<th scope="row">${inlineMd(c)}</th>` : `<td>${inlineMd(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
    out.push(html);
    table = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const h = line.match(/^(#{1,4}) (.+)$/);
    if (h) { flushAll(); const lvl = Math.min(Math.max(h[1].length, 2), 4); out.push(`<h${lvl}>${inlineMd(h[2])}</h${lvl}>`); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flushAll(); out.push('<hr/>'); continue; }
    const ul = line.match(/^\s*[-*] (.+)$/);
    if (ul) { flushPara(); flushQuote(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(ul[1]); continue; }
    const ol = line.match(/^\s*\d+\. (.+)$/);
    if (ol) { flushPara(); flushQuote(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(ol[1]); continue; }
    const bq = line.match(/^> ?(.*)$/);
    if (bq) { flushPara(); flushList(); quote.push(bq[1]); continue; }
    if (/^\|.*\|\s*$/.test(line)) {
      flushPara(); flushList(); flushQuote();
      table.push(line.trim());
      continue;
    }
    if (!line.trim()) { flushAll(); continue; }
    flushList(); flushQuote(); flushTable(); para.push(line.trim());
  }
  flushAll();
  return out.join('\n');
}

/* ─── Dates, read time ───────────────────────────────────────── */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function readMinutes(body) {
  const words = body.replace(/[#*_`>\-\[\]()]/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 250));
}

/* ─── FAQ extraction (FAQPage JSON-LD) ──────────────────────── */
function mdToPlain(md) {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function extractFaqs(body) {
  const secMatch = body.match(/^## Questions operators ask\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m);
  if (!secMatch) return [];
  const faqs = [];
  // Answers stop at the next question, a horizontal rule, or EOF — without
  // the ^--- stop, a trailing rule + CTA line bleeds into the last answer.
  const re = /^### (.+)$([\s\S]*?)(?=^### |^-{3,}\s*$|(?![\s\S]))/gm;
  let m;
  while ((m = re.exec(secMatch[1])) !== null) {
    const q = mdToPlain(m[1]);
    const a = mdToPlain(m[2]);
    if (q && a) faqs.push({ q, a });
  }
  return faqs;
}

/* ─── JSON-LD ────────────────────────────────────────────────── */
function postJsonLd(post) {
  const url = `${SITE_ORIGIN}/blog/${post.meta.slug}/`;
  const canonical = `${CANONICAL_ORIGIN}/blog/${post.meta.slug}/`;
  const faqs = extractFaqs(post.body);
  const obj = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': canonical,
        headline: post.meta.title,
        description: post.meta.description || post.meta.excerpt,
        image: `${CANONICAL_ORIGIN}${post.meta.hero}`,
        datePublished: post.meta.date,
        dateModified: post.meta.date,
        author: { '@type': 'Organization', name: post.meta.author || 'Clubtech Global' },
        publisher: { '@type': 'Organization', name: 'Clubtech Global', url: `${CANONICAL_ORIGIN}/` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        articleSection: post.meta.category,
        url: canonical,
      },
    ],
  };
  if (faqs.length) {
    obj['@graph'].push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }
  return JSON.stringify(obj, null, 2);
}

function listingJsonLd(posts) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_ORIGIN}/blog/`,
    name: 'The Index — Clubtech',
    url: `${SITE_ORIGIN}/blog/`,
    description: 'Operator playbooks on booking UX, revenue capture, and guest data for premium venues.',
    hasPart: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.meta.title,
      url: `${SITE_ORIGIN}/blog/${p.meta.slug}/`,
      datePublished: p.meta.date,
    })),
  }, null, 2);
}

/* ─── Shared chrome ──────────────────────────────────────────── */
/* Standalone feature pages at the site root (hand-written, not generated). */
const FEATURE_PAGES = [
  ['platform', 'Platform'], ['booking', 'Booking'], ['operations', 'Operations'],
  ['intelligence', 'Intelligence'], ['delivery', 'Delivery'],
];

/* ─── Navigation model ───────────────────────────────────────
   Single source of truth for the site nav. Each top-level item is
   either a plain link (Pricing) or a hover mega-menu (cols + rail).
   Link targets are root-relative suffixes ('events/', 'blog/'); they
   get the page's `rel` prefix at render time. http/mailto pass through.
   Rendered identically for every page (static + generated) so the nav
   never drifts. Mobile collapses each mega into a <details> accordion. */
const NAV = [
  {
    key: 'platform', label: 'Platform', href: 'platform/', small: true, align: 'left',
    cols: [
      { h: '', tag: '', links: [
        ['platform/#booking', 'Booking platform', '3D birds-eye booking map'],
        ['platform/#operations', 'Operations &amp; floor', 'Portal, floor plan, allocation'],
        ['platform/#guest-lists', 'Guest lists &amp; VMS', 'Door lists, whole-party capture'],
        ['platform/#check-in', 'Door &amp; check-in', 'QR scanning at the door'],
        ['platform/#integrations', 'Integrations', 'POS, PMS, payments, ads'],
        ['ai-bookings/', 'AI-agent bookings', 'Built for the agent era'],
      ] },
    ],
  },
  {
    key: 'sell', label: 'Sell', href: 'sell/', small: true, align: 'left',
    cols: [
      { h: '', tag: '', links: [
        ['sell/#events', 'Events &amp; ticketing', 'Tiered tickets and QR check-in'],
        ['sell/#packages', 'Packages &amp; upsells', 'Bottles, cakes, transfers'],
        ['sell/#gift-cards', 'Gift cards', 'Prepaid revenue, new guests'],
        ['sell/#dynamic-pricing', 'Dynamic pricing', 'Price the same seats to demand'],
        ['sell/#revenue', 'Revenue', 'The four-lever revenue playbook'],
      ] },
    ],
  },
  {
    key: 'grow', label: 'Grow', href: 'grow/', small: true, align: 'left',
    cols: [
      { h: '', tag: '', links: [
        ['grow/#marketing-ai', 'Marketing AI', 'Ad attribution &amp; retargeting'],
        ['grow/#ads', 'Ads &amp; attribution', 'The booking is the conversion'],
        ['grow/#guest-data', 'Guest data &amp; reports', '20+ reports, data you own'],
        ['grow/#reviews', 'Clubtech Reviews', 'Post-visit guest feedback'],
      ] },
    ],
  },
  {
    key: 'solutions', label: 'Solutions', href: 'solutions/',
    cols: [
      { h: 'Who we serve', tag: '', links: [
        ['solutions/resorts/', 'Resorts', ''],
        ['solutions/beach-clubs/', 'Beach clubs', ''],
        ['solutions/day-club-booking-system/', 'Day clubs', ''],
        ['solutions/nightclub-management-software/', 'Nightclubs', ''],
        ['solutions/hotel-pool-booking/', 'Hotel pools', ''],
        ['solutions/restaurants/', 'Restaurants', ''],
      ] },
      { h: 'By location', tag: '', links: [
        ['solutions/beach-club-booking-bali/', 'Bali', ''],
        ['solutions/beach-club-booking-dubai/', 'Dubai', ''],
        ['solutions/beach-club-booking-phuket/', 'Phuket', ''],
        ['solutions/beach-club-booking-ibiza/', 'Ibiza', ''],
        ['solutions/beach-club-booking-mykonos/', 'Mykonos', ''],
      ] },
      { h: 'By goal', tag: '', links: [
        ['sell/#revenue', 'Grow revenue', ''],
        ['solutions/guest-list-management-software/', 'Manage guest lists', ''],
        ['sell/#events', 'Fill events &amp; tickets', ''],
      ] },
    ],
    rail: {
      feature: ['solutions/', 'All solutions', 'Every venue type and destination'],
      links: [
        ['compare/', 'Compare Clubtech', 'See how we stack up'],
      ],
      cta: ['index.html#contact', 'Book a Demo'],
    },
  },
  {
    key: 'resources', label: 'Resources', href: 'blog/',
    cols: [
      { h: 'Learn', tag: '', links: [
        ['blog/', 'Blog &amp; playbooks', 'Operator playbooks and guides'],
        ['blog/beach-club-booking-system-complete-guide/', 'The complete guide', ''],
        ['blog/beach-club-revenue-playbook/', 'The revenue playbook', ''],
      ] },
      { h: 'Customer stories', tag: '', links: [
        ['blog/finns-beach-club-case-study/', 'FINNS Beach Club', 'Millions pre-paid monthly'],
      ] },
      { h: 'Compare', tag: '', links: [
        ['compare/sevenrooms-alternative/', 'vs SevenRooms', ''],
        ['compare/resortpass-alternative/', 'vs ResortPass', ''],
        ['compare/urvenue-alternative/', 'vs UrVenue', ''],
        ['compare/', 'All comparisons', ''],
      ] },
    ],
    rail: {
      feature: ['help/', 'Help center', 'Answers for venue teams'],
      links: [
        ['support/', 'Support', 'Message the Clubtech team'],
      ],
      cta: ['index.html#contact', 'Book a Demo'],
    },
  },
  { key: 'pricing', label: 'Pricing', href: 'pricing/' },
  {
    key: 'company', label: 'Company', href: 'about/', small: true, align: 'right',
    cols: [
      { h: '', tag: '', links: [
        ['about/', 'About Clubtech', 'Founded in Singapore'],
        ['careers/', 'Careers', 'Work at Clubtech'],
        ['delivery/', 'How we deliver', 'Five stages to live'],
        ['support/', 'Support', 'Help for venue teams'],
        ['index.html#contact', 'Contact', 'Talk to the team'],
      ] },
    ],
  },
];

/* rel = path prefix back to the site root ('' root, '../' one level, '../../' posts).
   active = top-level key to highlight. solid = bake the scrolled (solid) nav
   for pages that don't load js/main.js (all generated + root landing pages). */
function navMarkup(rel, active = null, solid = true) {
  const href = (s) => /^(https?:|mailto:|tel:)/.test(s) ? s : `${rel}${s}`;
  const megaLink = (cls, [h, t, d]) =>
    `              <a class="${cls}" href="${href(h)}"><span class="mega-lt">${t}</span>${d ? `<span class="mega-ld">${d}</span>` : ''}</a>`;
  const item = (top) => {
    const activeCls = active === top.key ? ' is-active' : '';
    const caret = top.cols ? '<svg class="nav-caret" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' : '';
    const topA = `<a class="nav-top" href="${href(top.href)}"${top.cols ? ' aria-haspopup="true" aria-expanded="false"' : ''}>${top.label}${caret}</a>`;
    if (!top.cols) return `        <div class="nav-item${activeCls}">${topA}</div>`;
    const cols = top.cols.map((c) => `            <div class="mega-col">
${c.h ? `              <p class="mega-h">${c.h}${c.tag ? `<span>${c.tag}</span>` : ''}</p>\n` : ''}${c.links.map((l) => megaLink('mega-link', l)).join('\n')}
            </div>`).join('\n');
    let rail = '';
    if (top.rail) {
      const r = top.rail;
      rail = `          <div class="mega-rail">
            <a class="mega-feature" href="${href(r.feature[0])}"><span class="mega-feature-k">${r.feature[1]}</span><span class="mega-feature-t">${r.feature[2]}</span></a>
${(r.links || []).map((l) => megaLink('mega-rail-link', l)).join('\n')}
${r.cta ? `            <a class="button button-mint mega-cta" href="${href(r.cta[0])}" data-open-demo>${r.cta[1]}</a>` : ''}
          </div>`;
    }
    return `        <div class="nav-item has-mega${top.small ? (top.align === 'left' ? ' dropdown left' : ' dropdown') : ''}${activeCls}">
          ${topA}
          <div class="mega${top.small ? ' mega-sm' : ''}" role="region" aria-label="${top.label} menu">
            <div class="mega-panel">
              <div class="mega-cols">
${cols}
              </div>
${rail}            </div>
          </div>
        </div>`;
  };
  const items = NAV.map(item).join('\n');
  const mob = NAV.map((top) => {
    if (!top.cols) return `          <a href="${href(top.href)}">${top.label}</a>`;
    const links = [];
    top.cols.forEach((c) => c.links.forEach((l) => links.push(`            <a href="${href(l[0])}">${l[1]}</a>`)));
    if (top.rail) {
      links.push(`            <a href="${href(top.rail.feature[0])}">${top.rail.feature[1]}</a>`);
      (top.rail.links || []).forEach((l) => links.push(`            <a href="${href(l[0])}">${l[1]}</a>`));
    }
    return `          <details class="m-group"><summary>${top.label}</summary><div>\n${links.join('\n')}\n          </div></details>`;
  }).join('\n');
  return `  <header class="nav-wrap${solid ? ' scrolled' : ''}">
    <nav class="nav" aria-label="Main navigation">
      <a href="${href('index.html')}" class="brand" aria-label="Clubtech home"><img src="${rel}brand/clubtech-wordmark-white-560.png" alt="Clubtech" width="176" height="44"></a>
      <div class="nav-links">
${items}
      </div>
      <div class="nav-actions">
        <a class="nav-login" href="https://id.clubtechglobal.com" rel="noopener">Login</a>
        <a class="button button-dark nav-cta" href="${href('index.html#contact')}" data-open-demo>Book a Demo</a>
      </div>
      <details class="mobile-menu">
        <summary>Menu</summary>
        <div class="mobile-panel">
${mob}
          <a class="button button-mint m-cta" href="${href('index.html#contact')}" data-open-demo>Book a Demo</a>
          <a class="m-login" href="https://id.clubtechglobal.com" rel="noopener">Login</a>
        </div>
      </details>
    </nav>
  </header>`;
}

/* Short labels for footer columns and anywhere full titles don't fit. */
const SHORT_LABELS = {
  'sunbed-booking-system': 'Sunbed booking',
  'beach-clubs': 'Beach clubs',
  'day-club-booking-system': 'Day clubs',
  'nightclub-table-booking': 'Nightclub tables',
  'hotel-pool-booking': 'Hotel pools',
  'beach-club-booking-bali': 'Bali',
  'beach-club-booking-dubai': 'Dubai',
  'beach-club-booking-phuket': 'Phuket',
  'beach-club-booking-ibiza': 'Ibiza',
  'beach-club-booking-mykonos': 'Mykonos',
  'urvenue-alternative': 'vs UrVenue',
  'sevenrooms-alternative': 'vs SevenRooms',
  'resortpass-alternative': 'vs ResortPass',
  'servme-alternative': 'vs serVme',
  'book-tech-labs-alternative': 'vs Book Tech Labs',
  'fourvenues-alternative': 'vs Fourvenues',
  'hoteligy-alternative': 'vs Hoteligy',
};
const GEO_PREFIX = 'beach-club-booking-';
const shortLabel = (slug) =>
  SHORT_LABELS[slug] || slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function footerMarkup(rel, pages = []) {
  const col = (title, links) => `      <div class="footer-col">
        <p class="footer-col-h">${esc(title)}</p>
${links.map(([href, label]) => `        <a href="${href}">${esc(label)}</a>`).join('\n')}
      </div>`;
  const solutions = pages.filter((p) => p.meta.section === 'solutions' && !p.meta.slug.startsWith(GEO_PREFIX));
  const geos = pages.filter((p) => p.meta.section === 'solutions' && p.meta.slug.startsWith(GEO_PREFIX));
  const compares = pages.filter((p) => p.meta.section === 'compare');
  const pageLink = (p) => [`${rel}${p.meta.section}/${p.meta.slug}/`, shortLabel(p.meta.slug)];
  const r = (s) => `${rel}${s}`;
  return `  <footer class="footer shell">
    <div class="footer-top">
      <a href="${rel}index.html" class="brand"><img src="${rel}brand/clubtech-wordmark-white-560.png" alt="Clubtech" width="190" height="48"></a>
      <div>
        <a href="${r('platform/')}">Platform</a>
        <a href="${r('sell/')}">Sell</a>
        <a href="${r('grow/')}">Grow</a>
        <a href="${r('solutions/')}">Solutions</a>
        <a href="${r('pricing/')}">Pricing</a>
        <a href="${r('blog/')}">Blog</a>
        <a href="${r('help/')}">Help</a>
        <a href="mailto:info@clubtechglobal.com">Contact</a>
        <a href="#" data-open-consent>Cookie preferences</a>
      </div>
    </div>
    <div class="footer-grid">
${col('Platform', [[r('platform/#booking'), 'Booking'], [r('platform/#operations'), 'Operations & floor'], [r('platform/#guest-lists'), 'Guest lists'], [r('platform/#integrations'), 'Integrations'], [r('ai-bookings/'), 'AI-agent bookings']])}
${col('Sell', [[r('sell/#events'), 'Events & ticketing'], [r('sell/#packages'), 'Packages & upsells'], [r('sell/#gift-cards'), 'Gift cards'], [r('sell/#dynamic-pricing'), 'Dynamic pricing'], [r('sell/#revenue'), 'Revenue']])}
${col('Grow', [[r('grow/#marketing-ai'), 'Marketing AI'], [r('grow/#ads'), 'Ads & attribution'], [r('grow/#guest-data'), 'Guest data'], [r('grow/#reviews'), 'Reviews']])}
${col('Solutions', [...solutions.map(pageLink), [`${rel}solutions/`, 'All solutions']])}
${col('Locations', geos.map(pageLink))}
${col('Compare', [...compares.map(pageLink), [`${rel}compare/`, 'All comparisons']])}
${col('Company', [[r('about/'), 'About'], [r('careers/'), 'Careers'], [r('delivery/'), 'How we deliver'], [r('support/'), 'Support'], [r('pricing/'), 'Pricing'], [`${rel}index.html#contact`, 'Contact']])}
    </div>
    <div class="footer-wordmark"><img src="${rel}brand/clubtech-wordmark-white-560.png" alt="Clubtech" width="1200" height="300" loading="lazy"></div>
    <p class="copyright">© 2026 Clubtech, Inc.</p>
  </footer>`;
}

const CONSENT_MARKUP = `<div class="cc-banner" id="cc-banner" role="region" aria-label="Cookie consent" hidden>
  <div class="cc-banner-head">Cookies &amp; privacy</div>
  <div class="cc-banner-body">
    We use cookies to make this site work, understand how it's used, and — with your permission — measure campaign performance. Accept all, reject non-essential, or choose categories. Reopen anytime via <a href="#" data-open-consent>preferences</a>.
  </div>
  <div class="cc-banner-actions">
    <button type="button" class="cc-btn cc-btn-primary" id="cc-accept">Accept all</button>
    <button type="button" class="cc-btn cc-btn-ghost" id="cc-reject">Reject non-essential</button>
    <button type="button" class="cc-btn cc-btn-link" id="cc-customize">Customize</button>
  </div>
</div>

<div class="cc-prefs" id="cc-prefs" role="dialog" aria-modal="true" aria-labelledby="cc-prefs-title" hidden>
  <div class="cc-prefs-inner">
    <button type="button" class="cc-prefs-close" id="cc-prefs-close" aria-label="Close">✕</button>
    <span class="cc-prefs-kicker">Cookie preferences</span>
    <h2 class="cc-prefs-title" id="cc-prefs-title">Choose what we can store</h2>
    <p class="cc-prefs-sub">Essential cookies keep the site working; everything else is opt-in and can be changed at any time.</p>
    <div class="cc-prefs-list">
      <div class="cc-cat">
        <div class="cc-cat-head">
          <div class="cc-cat-title">Strictly necessary</div>
          <span class="cc-locked">Always on</span>
        </div>
        <div class="cc-cat-desc">Required for the site to function — remembering your consent choice and basic security. Cannot be disabled.</div>
      </div>
      <div class="cc-cat">
        <div class="cc-cat-head">
          <div class="cc-cat-title">Analytics</div>
          <label class="cc-switch">
            <input type="checkbox" id="cc-toggle-analytics">
            <span class="cc-switch-slider"></span>
          </label>
        </div>
        <div class="cc-cat-desc">Helps us understand which pages are useful, where visitors drop off, and how to improve the product.</div>
        <div class="cc-cat-vendors">Vendors · Google Analytics 4</div>
      </div>
      <div class="cc-cat">
        <div class="cc-cat-head">
          <div class="cc-cat-title">Marketing</div>
          <label class="cc-switch">
            <input type="checkbox" id="cc-toggle-marketing">
            <span class="cc-switch-slider"></span>
          </label>
        </div>
        <div class="cc-cat-desc">Measures the performance of paid campaigns and lets us show you relevant ads on other platforms.</div>
        <div class="cc-cat-vendors">Vendors · Google Ads · Meta Pixel</div>
      </div>
    </div>
    <div class="cc-prefs-actions">
      <button type="button" class="cc-btn cc-btn-link" id="cc-prefs-reject">Reject all</button>
      <button type="button" class="cc-btn cc-btn-ghost" id="cc-prefs-accept">Accept all</button>
      <button type="button" class="cc-btn cc-btn-primary" id="cc-save">Save preferences</button>
    </div>
  </div>
</div>`;

function headHTML({ title, description, canonical, ogImage, ogImageAlt, jsonLd, rel, ogType = 'article' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta name="theme-color" content="#020617">
  <link rel="icon" href="${rel}favicon.svg">
  <link rel="icon" type="image/png" sizes="32x32" href="${rel}favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="${rel}favicon-16.png">
  <link rel="apple-touch-icon" href="${rel}apple-touch-icon.png">

  <meta property="og:type" content="${esc(ogType)}">
  <meta property="og:site_name" content="Clubtech">
  <meta property="og:url" content="${esc(canonical)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:alt" content="${esc(ogImageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <meta name="twitter:image:alt" content="${esc(ogImageAlt)}">

  <link rel="preload" href="${rel}fonts/albert-sans-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="${rel}css/styles.css">
  <link rel="stylesheet" href="${rel}css/blog.css">
  <link rel="stylesheet" href="${rel}css/consent.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${rel}css/consent.css"></noscript>
  <link rel="stylesheet" href="${rel}css/booking.css" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${rel}css/booking.css"></noscript>
  <script>document.documentElement.classList.add('js')</script>

  <script type="application/ld+json">
${escScriptJson(jsonLd)}
  </script>
</head>`;
}

/* ─── Solution / comparison pages (content/pages/*.md) ───────── */
/* Frontmatter adds: section (solutions|compare) and optional canonical
   (set it to the clubtechglobal.com URL for pages that also exist on the
   primary site; omit for net-new pages, which self-canonicalize here). */

// "**word**" in a page title renders as the mint accent span in the H1.
function h1Html(title) {
  return esc(title).replace(/\*\*([^*]+)\*\*/g, '<span class="mint-text">$1</span>');
}
const plainTitle = (t) => String(t).replace(/\*\*/g, '');

function pageCanonical(page) {
  return page.meta.canonical || `${SITE_ORIGIN}/${page.meta.section}/${page.meta.slug}/`;
}

function pageJsonLd(page) {
  const url = `${SITE_ORIGIN}/${page.meta.section}/${page.meta.slug}/`;
  const canonical = pageCanonical(page);
  const faqs = extractFaqs(page.body);
  const obj = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonical,
        name: page.meta.titleTag || plainTitle(page.meta.title),
        headline: plainTitle(page.meta.title),
        description: page.meta.description || page.meta.excerpt,
        image: `${SITE_ORIGIN}${page.meta.hero}`,
        datePublished: page.meta.date,
        dateModified: page.meta.date,
        about: { '@type': 'Organization', name: 'Clubtech', url: `${CANONICAL_ORIGIN}/` },
        url: canonical,
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: plainTitle(page.meta.title), item: url },
        ],
      },
    ],
  };
  if (faqs.length) {
    obj['@graph'].push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqs.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }
  return JSON.stringify(obj, null, 2);
}

function renderLandingPage(page, pages) {
  const body = sanitizeBlogHtml(renderMarkdown(page.body));
  const sectionLabel = PAGE_SECTIONS[page.meta.section];

  const others = pages.filter((p) => p.meta.section === page.meta.section && p.meta.slug !== page.meta.slug).slice(0, 4);
  const moreRows = others.map((p) => `      <a class="index-row" href="../${esc(p.meta.slug)}/">
        <span class="index-main">
          <span class="index-title">${esc(plainTitle(p.meta.title))}</span>
          <span class="index-meta"><span class="index-cat">${esc(PAGE_SECTIONS[p.meta.section])}</span></span>
        </span>
        <img class="index-thumb" src="../..${esc(p.meta.hero)}" alt="" loading="lazy" decoding="async" width="190" height="120">
        <span class="index-arrow" aria-hidden="true">↗</span>
      </a>`).join('\n');
  const moreSection = others.length ? `
  <section class="shell post-more" aria-label="More ${esc(sectionLabel.toLowerCase())}">
    <h2 class="post-more-h">More from ${esc(sectionLabel.toLowerCase())}</h2>
    <div class="index-list">
${moreRows}
    </div>
  </section>
` : '';

  const head = headHTML({
    title: page.meta.titleTag || `${plainTitle(page.meta.title)} | Clubtech`,
    description: page.meta.description || page.meta.excerpt,
    canonical: pageCanonical(page),
    ogImage: `${SITE_ORIGIN}${page.meta.hero}`,
    ogImageAlt: page.meta.heroAlt || plainTitle(page.meta.title),
    jsonLd: pageJsonLd(page),
    rel: '../../',
    ogType: 'website',
  });

  return `${head}
<body class="blog-post p-${esc(page.meta.section)}">
<a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../../', page.meta.section === 'solutions' ? 'solutions' : 'resources')}
<main id="main">

  <article>
    <header class="post-hero">
      <div class="shell post-hero-inner">
        <p class="post-tags"><span class="index-cat">${esc(sectionLabel)}</span></p>
        <h1>${h1Html(page.meta.title)}</h1>
        <p class="post-sub">${esc(page.meta.excerpt)}</p>
        <div class="post-hero-actions">
          <a class="button button-mint" href="mailto:info@clubtechglobal.com" data-open-demo>Book a Demo</a>
          <a class="button button-ghost" href="../../platform/">See the Platform</a>
        </div>
      </div>
    </header>

    <div class="shell post-hero-media">
      <img src="../..${esc(page.meta.hero)}" alt="${esc(page.meta.heroAlt)}" fetchpriority="high" decoding="async" width="1600" height="1067">
    </div>

    <div class="shell post-body">
${body}
    </div>
  </article>
${moreSection}
  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy">
    <div class="shell centered">
      <p class="eyebrow">Your venue, pre-sold.</p>
      <h2>Stop reading about it.<br><span class="mint-text">See it live.</span></h2>
      <p>Book a focused walkthrough, configured around a premium venue like yours.</p>
      <a class="button button-mint" href="mailto:info@clubtechglobal.com" data-open-demo>Book a Demo</a>
    </div>
  </section>

${footerMarkup('../../', pages)}
</main>
${CONSENT_MARKUP}
<script src="../../js/consent.js" defer></script>
<script src="../../js/hubspot.js" defer></script>
<script src="../../js/booking.js" defer></script>
<script src="../../js/analytics.js" defer></script>
<script src="../../js/blog.js" defer></script>
</body>
</html>
`;
}

/* ─── Root landing pages (content/landing/*.md → /<slug>/) ───── */
/* Flat product/company pages that live at the site root next to the
   hand-written feature pages. Self-canonical, reuse the blog post-hero +
   post-body chrome. Frontmatter adds: group (nav highlight + eyebrow),
   eyebrow (override), optional hero/heroAlt, cta2href/cta2label. */
const LANDING_LABEL = { platform: 'Platform', company: 'Company', resources: 'Resources', pricing: 'Pricing', solutions: 'Solutions' };

function rootJsonLd(page) {
  const url = `${SITE_ORIGIN}/${page.meta.slug}/`;
  const faqs = extractFaqs(page.body);
  const webpage = {
    '@type': 'WebPage',
    '@id': url,
    name: page.meta.titleTag || plainTitle(page.meta.title),
    headline: plainTitle(page.meta.title),
    description: page.meta.description || page.meta.excerpt,
    datePublished: page.meta.date,
    dateModified: page.meta.date,
    about: { '@type': 'Organization', name: 'Clubtech', url: `${CANONICAL_ORIGIN}/` },
    url,
  };
  if (page.meta.hero) webpage.image = `${SITE_ORIGIN}${page.meta.hero}`;
  const obj = {
    '@context': 'https://schema.org',
    '@graph': [
      webpage,
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: plainTitle(page.meta.title), item: url },
        ],
      },
    ],
  };
  if (faqs.length) {
    obj['@graph'].push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: faqs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  return JSON.stringify(obj, null, 2);
}

function renderRootPage(page, landings, pages) {
  const body = sanitizeBlogHtml(renderMarkdown(page.body));
  const eyebrow = page.meta.eyebrow || LANDING_LABEL[page.meta.group] || 'Clubtech';
  const cta2 = page.meta.cta2href ? [page.meta.cta2href, page.meta.cta2label || 'Learn more'] : ['platform/', 'See the platform'];
  const heroMedia = page.meta.hero ? `
    <div class="shell post-hero-media">
      <img src="..${esc(page.meta.hero)}" alt="${esc(page.meta.heroAlt || plainTitle(page.meta.title))}" fetchpriority="high" decoding="async" width="1600" height="1067">
    </div>` : '';

  const head = headHTML({
    title: page.meta.titleTag || `${plainTitle(page.meta.title)} | Clubtech`,
    description: page.meta.description || page.meta.excerpt,
    canonical: `${SITE_ORIGIN}/${page.meta.slug}/`,
    ogImage: page.meta.hero ? `${SITE_ORIGIN}${page.meta.hero}` : `${SITE_ORIGIN}/assets/og/clubtech-og.jpg`,
    ogImageAlt: page.meta.heroAlt || plainTitle(page.meta.title),
    jsonLd: rootJsonLd(page),
    rel: '../',
    ogType: 'website',
  });

  return `${head}
<body class="blog-post p-landing">
<a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../', page.meta.group || null)}
<main id="main">

  <article>
    <header class="post-hero">
      <div class="shell post-hero-inner">
        <p class="post-tags"><span class="index-cat">${esc(eyebrow)}</span></p>
        <h1>${h1Html(page.meta.title)}</h1>
        <p class="post-sub">${esc(page.meta.excerpt)}</p>
        <div class="post-hero-actions">
          <a class="button button-mint" href="mailto:info@clubtechglobal.com" data-open-demo>Book a Demo</a>
          <a class="button button-ghost" href="../${cta2[0]}">${esc(cta2[1])}</a>
        </div>
      </div>
    </header>
${heroMedia}
    <div class="shell post-body">
${body}
    </div>
  </article>

  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy">
    <div class="shell centered">
      <p class="eyebrow">Your venue, pre-sold.</p>
      <h2>Stop reading about it.<br><span class="mint-text">See it live.</span></h2>
      <p>Book a focused walkthrough, configured around a premium venue like yours.</p>
      <a class="button button-mint" href="mailto:info@clubtechglobal.com" data-open-demo>Book a Demo</a>
    </div>
  </section>

${footerMarkup('../', pages)}
</main>
${CONSENT_MARKUP}
<script src="../js/consent.js" defer></script>
<script src="../js/hubspot.js" defer></script>
<script src="../js/booking.js" defer></script>
<script src="../js/analytics.js" defer></script>
<script src="../js/blog.js" defer></script>
</body>
</html>
`;
}

/* ─── Section index pages (/solutions/ + /compare/) ──────────── */
const SECTION_HERO = {
  solutions: {
    h1: 'Built for how <span class="mint-text">your venue sells.</span>',
    sub: 'Sunbeds, daybeds, tables, and day passes — one platform, configured to the way each venue type turns furniture into revenue.',
  },
  compare: {
    h1: 'Clubtech, <span class="mint-text">compared fairly.</span>',
    sub: 'Honest, fair-fit comparisons. Where an alternative is the better tool for your venue, these pages say so.',
  },
};

function sectionIndexJsonLd(sectionKey, sectionPages) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${SITE_ORIGIN}/${sectionKey}/`,
    name: `${PAGE_SECTIONS[sectionKey]} — Clubtech`,
    url: `${SITE_ORIGIN}/${sectionKey}/`,
    hasPart: sectionPages.map((p) => ({
      '@type': 'WebPage',
      name: plainTitle(p.meta.title),
      url: `${SITE_ORIGIN}/${p.meta.section}/${p.meta.slug}/`,
    })),
  }, null, 2);
}

function renderSectionIndex(sectionKey, pages) {
  const sectionPages = pages.filter((p) => p.meta.section === sectionKey);
  const label = PAGE_SECTIONS[sectionKey];
  const rows = sectionPages.map((p) => `      <a class="index-row" href="${esc(p.meta.slug)}/">
        <span class="index-main">
          <span class="index-title">${esc(plainTitle(p.meta.title))}</span>
          <span class="index-desc">${esc(p.meta.excerpt)}</span>
        </span>
        <img class="index-thumb" src="..${esc(p.meta.hero)}" alt="" loading="lazy" decoding="async" width="190" height="120">
        <span class="index-arrow" aria-hidden="true">↗</span>
      </a>`).join('\n');

  const head = headHTML({
    title: `${label} — Clubtech`,
    description: sectionKey === 'solutions'
      ? 'Clubtech booking and revenue solutions by venue type and destination — beach clubs, day clubs, nightclubs, hotel pools, and sunbed decks.'
      : 'Fair, factual comparisons of Clubtech against UrVenue, SevenRooms, ResortPass, serVme, Book Tech Labs, Fourvenues, and Hoteligy.',
    canonical: `${SITE_ORIGIN}/${sectionKey}/`,
    ogImage: `${SITE_ORIGIN}${sectionPages[0]?.meta.hero || '/assets/og/clubtech-og.jpg'}`,
    ogImageAlt: `Clubtech ${label.toLowerCase()}`,
    jsonLd: sectionIndexJsonLd(sectionKey, sectionPages),
    rel: '../',
    ogType: 'website',
  });

  return `${head}
<body class="blog-index p-${esc(sectionKey)}-index">
<a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../', sectionKey === 'solutions' ? 'solutions' : 'resources')}
<main id="main">

  <section class="index-hero">
    <div class="shell">
      <p class="index-kicker"><span class="tick"></span>${esc(label)} · ${sectionPages.length} pages</p>
      <h1 class="index-h1">${SECTION_HERO[sectionKey].h1}</h1>
      <p class="index-sub">${esc(SECTION_HERO[sectionKey].sub)}</p>
    </div>
  </section>

  <section class="index-list-wrap shell" aria-label="All ${esc(label.toLowerCase())} pages">
    <div class="index-list">
${rows}
    </div>
  </section>

  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy">
    <div class="shell centered">
      <p class="eyebrow">Your venue, pre-sold.</p>
      <h2>Stop reading about it.<br><span class="mint-text">See it live.</span></h2>
      <p>Book a focused walkthrough, configured around a premium venue like yours.</p>
      <a class="button button-mint" href="mailto:info@clubtechglobal.com" data-open-demo>Book a Demo</a>
    </div>
  </section>

${footerMarkup('../', pages)}
</main>
${CONSENT_MARKUP}
<script src="../js/consent.js" defer></script>
<script src="../js/hubspot.js" defer></script>
<script src="../js/booking.js" defer></script>
<script src="../js/analytics.js" defer></script>
<script src="../js/blog.js" defer></script>
</body>
</html>
`;
}

/* ─── Listing (the directory page) ───────────────────────────── */
function indexRow(post, n) {
  const cat = post.meta.category || '';
  const catKey = cat.toLowerCase().replace(/\s+/g, '-');
  return `      <a class="index-row" href="${esc(post.meta.slug)}/" data-category="${esc(catKey)}">
        <span class="index-num">${String(n).padStart(2, '0')}</span>
        <span class="index-main">
          <span class="index-title">${esc(post.meta.title)}</span>
          <span class="index-meta"><span class="index-cat">${esc(cat)}</span><span>${esc(shortDate(post.meta.date))}</span><span>${readMinutes(post.body)} min</span></span>
        </span>
        <img class="index-thumb" src="..${esc(post.meta.hero)}" alt="" loading="lazy" decoding="async" width="190" height="120">
        <span class="index-arrow" aria-hidden="true">↗</span>
      </a>`;
}

function renderListing(posts, pages) {
  const [latest, ...rest] = posts;
  const categories = [...new Set(posts.map((p) => p.meta.category).filter(Boolean))];
  const chips = categories.map((c) =>
    `        <button class="filter-chip" data-filter="${esc(c.toLowerCase().replace(/\s+/g, '-'))}">${esc(c)}</button>`).join('\n');
  const rows = rest.map((p, i) => indexRow(p, posts.length - 1 - i)).join('\n');

  const head = headHTML({
    title: 'The Index — operator playbooks | Clubtech',
    description: 'Operator playbooks on booking UX, revenue capture, and guest data for premium venues. From the team behind Clubtech.',
    canonical: `${SITE_ORIGIN}/blog/`,
    ogImage: `${SITE_ORIGIN}${latest.meta.hero}`,
    ogImageAlt: latest.meta.heroAlt || 'Clubtech',
    jsonLd: listingJsonLd(posts),
    rel: '../',
    ogType: 'website',
  });

  return `${head}
<body class="blog-index">
<a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../', 'resources')}
<main id="main">

  <section class="index-hero">
    <div class="shell">
      <p class="index-kicker"><span class="tick"></span>The Clubtech index · ${posts.length} entries</p>
      <h1 class="index-h1">Playbooks for<br>venues that <span class="mint-text">sell out.</span></h1>
      <p class="index-sub">Booking UX, revenue capture, guest data. Everything we learn on the floor of premium venues, written down.</p>
    </div>
    <div class="index-marquee" aria-hidden="true"><div class="index-marquee-track"><span>BOOKING UX · REVENUE CAPTURE · GUEST DATA · DYNAMIC PRICING · PRE-PAID · ATTRIBUTION · </span><span>BOOKING UX · REVENUE CAPTURE · GUEST DATA · DYNAMIC PRICING · PRE-PAID · ATTRIBUTION · </span></div></div>
  </section>

  <section class="index-featured shell" aria-label="Latest entry">
    <a class="featured-card" href="${esc(latest.meta.slug)}/">
      <div class="featured-copy">
        <p class="featured-tag"><span class="index-cat">${esc(latest.meta.category)}</span><span class="featured-latest">Latest — ${esc(shortDate(latest.meta.date))}</span></p>
        <h2>${esc(latest.meta.title)}</h2>
        <p class="featured-excerpt">${esc(latest.meta.excerpt)}</p>
        <span class="featured-cta">Read the entry <span aria-hidden="true">↗</span></span>
      </div>
      <div class="featured-media"><img src="..${esc(latest.meta.hero)}" alt="${esc(latest.meta.heroAlt)}" loading="lazy" decoding="async" width="1600" height="1067"></div>
    </a>
  </section>

  <section class="index-list-wrap shell" aria-label="All entries">
    <div class="index-toolbar">
      <p class="index-count"><b>${posts.length - 1}</b> more entries</p>
      <div class="index-filters" role="group" aria-label="Filter by category">
        <button class="filter-chip is-active" data-filter="all">All</button>
${chips}
      </div>
    </div>
    <div class="index-list">
${rows}
    </div>
    <p class="index-empty" hidden>Nothing in this category yet.</p>
  </section>

  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy" decoding="async">
    <div class="shell centered">
      <p class="eyebrow">Your venue, pre-sold.</p>
      <h2>Stop reading about it.<br><span class="mint-text">See it live.</span></h2>
      <p>Book a focused walkthrough, configured around a premium venue like yours.</p>
      <a class="button button-mint" href="mailto:info@clubtechglobal.com" data-open-demo>Book a Demo</a>
    </div>
  </section>

${footerMarkup('../', pages)}
</main>
${CONSENT_MARKUP}
<script src="../js/consent.js" defer></script>
<script src="../js/hubspot.js" defer></script>
<script src="../js/booking.js" defer></script>
<script src="../js/analytics.js" defer></script>
<script src="../js/blog.js" defer></script>
</body>
</html>
`;
}

/* ─── Post page ──────────────────────────────────────────────── */
function renderPost(post, posts, pages) {
  const canonical = `${CANONICAL_ORIGIN}/blog/${post.meta.slug}/`;
  const body = sanitizeBlogHtml(renderMarkdown(post.body));
  const readMin = readMinutes(post.body);

  const others = posts.filter((p) => p.meta.slug !== post.meta.slug).slice(0, 3);
  const moreRows = others.map((p) => `      <a class="index-row" href="../${esc(p.meta.slug)}/">
        <span class="index-main">
          <span class="index-title">${esc(p.meta.title)}</span>
          <span class="index-meta"><span class="index-cat">${esc(p.meta.category)}</span><span>${esc(shortDate(p.meta.date))}</span></span>
        </span>
        <img class="index-thumb" src="../..${esc(p.meta.hero)}" alt="" loading="lazy" decoding="async" width="190" height="120">
        <span class="index-arrow" aria-hidden="true">↗</span>
      </a>`).join('\n');

  const head = headHTML({
    title: post.meta.titleTag || `${post.meta.title} | Clubtech`,
    description: post.meta.description || post.meta.excerpt,
    canonical,
    ogImage: `${SITE_ORIGIN}${post.meta.hero}`,
    ogImageAlt: post.meta.heroAlt || post.meta.title,
    jsonLd: postJsonLd(post),
    rel: '../../',
  });

  return `${head}
<body class="blog-post">
<a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../../', 'resources')}
<main id="main">

  <article>
    <header class="post-hero">
      <div class="shell post-hero-inner">
        <p class="post-back"><a href="../">← The Index</a></p>
        <p class="post-tags"><span class="index-cat">${esc(post.meta.category)}</span></p>
        <h1>${esc(post.meta.title)}</h1>
        <p class="post-meta">${esc(shortDate(post.meta.date))} · ${esc(post.meta.author || 'Clubtech Global')} · ${readMin} min read</p>
      </div>
    </header>

    <div class="shell post-hero-media">
      <img src="../..${esc(post.meta.hero)}" alt="${esc(post.meta.heroAlt)}" fetchpriority="high" decoding="async" width="1600" height="1067">
    </div>

    <div class="shell post-body">
${body}
    </div>
  </article>

  <section class="shell post-more" aria-label="More entries">
    <h2 class="post-more-h">More from the index</h2>
    <div class="index-list">
${moreRows}
    </div>
  </section>

  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy" decoding="async">
    <div class="shell centered">
      <p class="eyebrow">Your venue, pre-sold.</p>
      <h2>Stop reading about it.<br><span class="mint-text">See it live.</span></h2>
      <p>Book a focused walkthrough, configured around a premium venue like yours.</p>
      <a class="button button-mint" href="mailto:info@clubtechglobal.com" data-open-demo>Book a Demo</a>
    </div>
  </section>

${footerMarkup('../../', pages)}
</main>
${CONSENT_MARKUP}
<script src="../../js/consent.js" defer></script>
<script src="../../js/hubspot.js" defer></script>
<script src="../../js/booking.js" defer></script>
<script src="../../js/analytics.js" defer></script>
<script src="../../js/blog.js" defer></script>
</body>
</html>
`;
}

/* ─── Sitemap ────────────────────────────────────────────────── */
/* Pages whose canonical points at another origin are excluded; now that the
   site serves www.clubtechglobal.com itself, those canonicals are self-
   canonical and everything (incl. blog posts) belongs in the sitemap. */
function renderSitemap(posts, pages, landings = []) {
  const latest = posts[0]?.meta.date || '2026-01-01';
  const entries = [
    { loc: `${SITE_ORIGIN}/`, lastmod: latest, changefreq: 'weekly', priority: '1.0' },
    ...FEATURE_PAGES.map(([slug]) => ({ loc: `${SITE_ORIGIN}/${slug}/`, lastmod: latest, changefreq: 'monthly', priority: '0.8' })),
    { loc: `${SITE_ORIGIN}/book-a-demo/`, lastmod: latest, changefreq: 'monthly', priority: '0.8' },
    { loc: `${SITE_ORIGIN}/blog/`, lastmod: latest, changefreq: 'weekly', priority: '0.8' },
    ...Object.keys(PAGE_SECTIONS).map((sec) => ({ loc: `${SITE_ORIGIN}/${sec}/`, lastmod: latest, changefreq: 'weekly', priority: '0.7' })),
    ...posts.map((p) => ({
      loc: `${SITE_ORIGIN}/blog/${p.meta.slug}/`,
      lastmod: p.meta.date,
      changefreq: 'monthly',
      priority: '0.7',
    })),
    ...pages.filter((p) => !p.meta.canonical || p.meta.canonical === `${SITE_ORIGIN}/${p.meta.section}/${p.meta.slug}/`).map((p) => ({
      loc: `${SITE_ORIGIN}/${p.meta.section}/${p.meta.slug}/`,
      lastmod: p.meta.date,
      changefreq: 'monthly',
      priority: '0.8',
    })),
    ...landings.map((p) => ({
      loc: `${SITE_ORIGIN}/${p.meta.slug}/`,
      lastmod: p.meta.date,
      changefreq: 'monthly',
      priority: '0.8',
    })),
  ];
  const xml = entries.map((e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xml}
</urlset>
`;
}

/* ─── llms.txt (AEO) ─────────────────────────────────────────── */
function renderLlmsTxt(posts, pages, landings = []) {
  const lines = [`# Clubtech — Your venue, pre-sold

> Clubtech is an all-in-one booking and revenue operations platform for premium venues — beach clubs, day clubs, nightclubs, and hotel pools. Online reservations with a 3D birds-eye venue map, front-of-house floor operations, and marketing attribution in a single system. Founded in Singapore; processes $332k in weekly GMV across venue partners in 7+ countries.

Key facts:
- Guests select the exact furniture, zone, and daypart on a 3D interactive map and pay before arrival.
- Revenue levers: prepayments and deposits, upsells and add-ons, dynamic pricing, abandoned-booking retargeting.
- Commercials: no monthly fee — the platform earns when the venue's online revenue grows; pricing is built per venue and shared on a quick demo (book at ${SITE_ORIGIN}/book-a-demo/).
- Integrations: Opera PMS, Airwallex, Midtrans (QRIS, GoPay, OVO), Apple Pay, Google Pay, Meta Ads, Google Ads, GA4, WhatsApp.
- Delivery: five stages (onboarding, build, training, go-live, optimize) with a dedicated account lead and 90-day hypercare.
- Contact: info@clubtechglobal.com · main site: https://www.clubtechglobal.com/

## Pages

- [Landing page](${SITE_ORIGIN}/): platform overview, booking journey, operations, commercials, FAQ
- [Platform](${SITE_ORIGIN}/platform/): the all-in-one platform — reservations, front of house, and marketing
- [Booking](${SITE_ORIGIN}/booking/): the guest booking journey — 3D map, packages, add-ons, dynamic pricing, gift cards
- [Operations](${SITE_ORIGIN}/operations/): floor plan, seating allocation, inventory sync, guest lists
- [Intelligence](${SITE_ORIGIN}/intelligence/): guest data, 20+ reports, Meta/Google/GA4 attribution
- [Delivery](${SITE_ORIGIN}/delivery/): five-stage rollout with a dedicated account lead and 90-day hypercare
- [Book a demo](${SITE_ORIGIN}/book-a-demo/): a 15-minute demo configured around your venue — no monthly fee, and pricing built per venue is shared on the call
- [The Index (blog)](${SITE_ORIGIN}/blog/): operator playbooks on booking UX, revenue capture, and guest data`];
  if (landings.length) {
    lines.push('\n## Product & platform\n');
    for (const p of landings) {
      lines.push(`- [${plainTitle(p.meta.title)}](${SITE_ORIGIN}/${p.meta.slug}/): ${p.meta.excerpt}`);
    }
  }
  for (const sectionKey of Object.keys(PAGE_SECTIONS)) {
    const sectionPages = pages.filter((p) => p.meta.section === sectionKey);
    if (!sectionPages.length) continue;
    lines.push(`\n## ${PAGE_SECTIONS[sectionKey]}\n`);
    for (const p of sectionPages) {
      lines.push(`- [${plainTitle(p.meta.title)}](${SITE_ORIGIN}/${p.meta.section}/${p.meta.slug}/): ${p.meta.excerpt}`);
    }
  }
  lines.push('\n## Blog entries\n');
  for (const p of posts) {
    lines.push(`- [${p.meta.title}](${SITE_ORIGIN}/blog/${p.meta.slug}/): ${p.meta.excerpt}`);
  }
  lines.push('');
  return lines.join('\n');
}

/* ─── Main ───────────────────────────────────────────────────── */
function validateEntry(file, meta) {
  if (!meta.slug || !meta.title || !meta.date) {
    throw new Error(`${file}: missing slug/title/date frontmatter`);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(meta.slug)) {
    throw new Error(`${file}: invalid slug "${meta.slug}" — must match /^[a-z0-9][a-z0-9-]*$/`);
  }
  if (`${meta.slug}.md` !== file) {
    throw new Error(`${file}: slug "${meta.slug}" does not match filename`);
  }
}

function main() {
  if (!existsSync(CONTENT_DIR)) {
    console.error(`Missing ${CONTENT_DIR}`);
    process.exit(1);
  }
  const files = readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'));
  if (!files.length) {
    console.error('No posts found in content/blog/');
    process.exit(1);
  }

  const posts = files.map((file) => {
    const raw = readFileSync(join(CONTENT_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    validateEntry(file, meta);
    const heroPath = join(ROOT, meta.hero.replace(/^\//, ''));
    if (!existsSync(heroPath)) {
      throw new Error(`${file}: hero image ${meta.hero} not found`);
    }
    return { file, meta, body };
  }).sort((a, b) => (a.meta.date < b.meta.date ? 1 : -1));

  // Landing pages (content/pages/*.md → solutions/ + compare/).
  const pageFiles = existsSync(PAGES_DIR) ? readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md')) : [];
  const pages = pageFiles.map((file) => {
    const raw = readFileSync(join(PAGES_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    validateEntry(file, meta);
    if (!PAGE_SECTIONS[meta.section]) {
      throw new Error(`${file}: invalid section "${meta.section}" — must be one of ${Object.keys(PAGE_SECTIONS).join('|')}`);
    }
    const heroPath = join(ROOT, meta.hero.replace(/^\//, ''));
    if (!existsSync(heroPath)) {
      throw new Error(`${file}: hero image ${meta.hero} not found`);
    }
    return { file, meta, body };
  }).sort((a, b) => (a.meta.slug < b.meta.slug ? -1 : 1));

  // Root landing pages (content/landing/*.md → /<slug>/).
  const LANDING_DIR = join(ROOT, 'content', 'landing');
  const landingFiles = existsSync(LANDING_DIR) ? readdirSync(LANDING_DIR).filter((f) => f.endsWith('.md')) : [];
  const landings = landingFiles.map((file) => {
    const raw = readFileSync(join(LANDING_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    validateEntry(file, meta);
    if (meta.hero) {
      const heroPath = join(ROOT, meta.hero.replace(/^\//, ''));
      if (!existsSync(heroPath)) throw new Error(`${file}: hero image ${meta.hero} not found`);
    }
    return { file, meta, body };
  }).sort((a, b) => (a.meta.slug < b.meta.slug ? -1 : 1));

  // Wipe and regenerate build output dirs.
  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });
  for (const section of Object.keys(PAGE_SECTIONS)) {
    const dir = join(ROOT, section);
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }

  for (const post of posts) {
    const dir = join(OUT_DIR, post.meta.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderPost(post, posts, pages));
  }
  writeFileSync(join(OUT_DIR, 'index.html'), renderListing(posts, pages));

  for (const page of pages) {
    const dir = join(ROOT, page.meta.section, page.meta.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderLandingPage(page, pages));
  }

  for (const sectionKey of Object.keys(PAGE_SECTIONS)) {
    writeFileSync(join(ROOT, sectionKey, 'index.html'), renderSectionIndex(sectionKey, pages));
  }

  // Root landing pages (flat /<slug>/ next to the hand-written feature pages).
  for (const lp of landings) {
    const dir = join(ROOT, lp.meta.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), renderRootPage(lp, landings, pages));
  }

  // Inject the shared nav + footer into the hand-written static pages so the
  // mega-menu never drifts. Idempotent: matches the current <header>/<footer>
  // block (whether original or previously injected) and rewrites it in place.
  // Function replacers avoid $-token interpretation in the markup.
  const STATIC_PAGES = [
    ['index.html', '', null, false],
    ['platform/index.html', '../', 'platform', false],
    ['sell/index.html', '../', 'sell', false],
    ['grow/index.html', '../', 'grow', false],
    ['delivery/index.html', '../', 'company', false],
    ['book-a-demo/index.html', '../', null, true],
  ];
  let injected = 0;
  for (const [file, prefix, group, solid] of STATIC_PAGES) {
    const fp = join(ROOT, file);
    if (!existsSync(fp)) continue;
    const before = readFileSync(fp, 'utf8');
    let html = before.replace(/^[ \t]*<header class="nav-wrap[^"]*">[\s\S]*?<\/header>/m, () => navMarkup(prefix, group, solid));
    html = html.replace(/^[ \t]*<footer class="footer shell">[\s\S]*?<\/footer>/m, () => footerMarkup(prefix, pages));
    html = html.replace('<!--CONSENT-->', () => CONSENT_MARKUP);
    if (html !== before) { writeFileSync(fp, html); injected++; }
  }

  writeFileSync(join(ROOT, 'sitemap.xml'), renderSitemap(posts, pages, landings));
  writeFileSync(join(ROOT, 'llms.txt'), renderLlmsTxt(posts, pages, landings));

  console.log(`Built ${posts.length} posts + listing → blog/`);
  console.log(`Built ${pages.length} section pages → ${Object.keys(PAGE_SECTIONS).map((s) => s + '/').join(' + ')}`);
  console.log(`Built ${landings.length} root landing pages → /<slug>/`);
  console.log(`Injected shared nav + footer into ${injected} static pages`);
  console.log('Refreshed sitemap.xml + llms.txt');
}

main();
