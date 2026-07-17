#!/usr/bin/env node
/* Clubtech website static build.
   Compiles editorial, landing, solution, and comparison sources with zero
   dependencies. A built-in Markdown renderer emits final static HTML.

   Emits:
     blog/<slug>/index.html   (one page per post)
     blog/index.html          (the directory/listing page)
     sitemap.xml + llms.txt

   Frontmatter (flat key: value lines, optional quotes — NOT full YAML):
   title, titleTag, slug, date, author, category, excerpt, hero, heroAlt,
   description. A "## Questions operators ask" section emits FAQPage JSON-LD.

   Canonicals: www.clubtechglobal.com is the primary, self-canonical site.
   Every indexable route belongs in sitemap.xml.

   Usage: node scripts/build-blog.mjs   (or: npm run build:blog)
*/

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLOG_PATHWAYS,
  CAPABILITIES,
  COMPARISON_CONFIG,
  FOOTER_GROUPS,
  LANDING_CONFIG,
  TEAM,
} from './site-config.mjs';

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

/* Normalize retired and pre-rebuild destinations at the rendering boundary.
   Sources are still repaired directly, but this prevents a missed legacy link
   from shipping as a 404 or a meta-refresh hop. */
function normalizeInternalLinks(html) {
  return String(html)
    .replaceAll('/platform.html', '/platform/')
    .replaceAll('/contact.html', '/book-a-demo/')
    .replaceAll('/revenue.html', '/sell/#revenue')
    .replaceAll('/revenue/', '/sell/#revenue')
    .replaceAll('/booking/#every-guest-data', '/platform/#guest-lists')
    .replaceAll('/booking/', '/platform/#booking')
    .replaceAll('/operations/', '/platform/#operations')
    .replaceAll('/intelligence/', '/grow/#guest-data');
}

const splitMetaList = (value) => String(value || '').split('|').map((item) => item.trim()).filter(Boolean);
const routeHref = (rel, route) => /^(?:https?:|mailto:|tel:|#|\/)/.test(route) ? route : `${rel}${route}`;

/* ─── Minimal markdown renderer ──────────────────────────────── */
/* Covers the authoring subset the blog protocol allows: ##/### headings,
   paragraphs, **bold**, _italic_/*italic*, [text](href), `code`,
   -/* unordered lists, 1. ordered lists, > blockquotes, --- rules.
   Raw HTML in the source is escaped (the protocol strips it anyway). */
function inlineMd(text, allowRelative = false) {
  let out = esc(text);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,:;!?]|$)/g, '$1<em>$2</em>');
  out = out.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,:;!?]|$)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
    let safe = /^(https?:\/\/|\/|#|mailto:)/.test(href) || (allowRelative && /^\.\.?\//.test(href)) ? href : '#';
    // Root-relative links come from content written for www.clubtechglobal.com;
    // on this subpath-hosted mirror they must point at the primary site.
    if (safe.startsWith('/')) safe = CANONICAL_ORIGIN + safe;
    const ext = /^https?:\/\//.test(safe) ? ' rel="noopener"' : '';
    return `<a href="${esc(safe)}"${ext}>${label}</a>`;
  });
  return out;
}

function renderMarkdown(md, allowRelative = false) {
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
    if (para.length) { out.push(`<p>${inlineMd(para.join(' ').trim(), allowRelative)}</p>`); para = []; }
  };
  const flushList = () => {
    if (list) { out.push(`<${list.tag}>` + list.items.map((i) => `<li>${inlineMd(i, allowRelative)}</li>`).join('') + `</${list.tag}>`); list = null; }
  };
  const flushQuote = () => {
    if (quote.length) { out.push(`<blockquote><p>${inlineMd(quote.join(' ').trim(), allowRelative)}</p></blockquote>`); quote = []; }
  };

  const flushTable = () => {
    if (!table.length) return;
    const rows = table.map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
    const sepAt = rows.findIndex(r => r.every(c => /^:?-{3,}:?$/.test(c)));
    const head = sepAt > 0 ? rows[0] : null;
    const body = rows.filter((r, i) => i !== sepAt && (head ? i !== 0 : true) && !r.every(c => /^:?-{3,}:?$/.test(c)));
    let html = '<div class="cmp-table"><table>';
    if (head) html += '<thead><tr>' + head.map(c => `<th scope="col">${inlineMd(c, allowRelative)}</th>`).join('') + '</tr></thead>';
    html += '<tbody>' + body.map(r => '<tr>' + r.map((c, i) => i === 0 ? `<th scope="row">${inlineMd(c, allowRelative)}</th>` : `<td>${inlineMd(c, allowRelative)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
    out.push(html);
    table = [];
  };
  const flushAll = () => { flushPara(); flushList(); flushQuote(); flushTable(); };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    const h = line.match(/^(#{1,4}) (.+)$/);
    if (h) { flushAll(); const lvl = Math.min(Math.max(h[1].length, 2), 4); out.push(`<h${lvl}>${inlineMd(h[2], allowRelative)}</h${lvl}>`); continue; }
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
    .replace(/[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function extractFaqs(body) {
  const secMatch = body.match(/^## ([^\n]*(?:questions|frequently asked)[^\n]*)\s*$([\s\S]*?)(?=^## |(?![\s\S]))/im);
  if (!secMatch) return [];
  const faqs = [];
  // Answers stop at the next question, a horizontal rule, or EOF — without
  // the ^--- stop, a trailing rule + CTA line bleeds into the last answer.
  const re = /^### (.+)$([\s\S]*?)(?=^### |^-{3,}\s*$|(?![\s\S]))/gm;
  let m;
  while ((m = re.exec(secMatch[2])) !== null) {
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
/* The hand-written pillar + delivery pages (Booking/Operations/Intelligence were
   folded into Platform/Grow anchors in the nav rebuild; their old paths survive
   only as noindex redirect stubs and must NOT be advertised in sitemap/llms).
   Root landing pages (about, pricing, careers, help, support, ai-bookings) are
   emitted from the `landings` array separately — do not duplicate them here. */
const FEATURE_PAGES = [
  ['platform', 'Bookings'], ['sell', 'Revenue'], ['grow', 'Marketing'],
  ['delivery', 'Delivery'],
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
    key: 'platform', label: 'Platform', href: 'platform/',
    cols: [
      { h: 'Bookings', tag: 'The guest journey', links: [
        ['platform/', 'Bookings overview', 'From first tap to the service day'],
        ['platform/#booking', '3D booking map', 'Exact furniture, zones, and packages'],
        ['platform/#operations', 'Operations &amp; floor', 'Portal, floor plan, allocation'],
        ['platform/#guest-lists', 'Guest lists &amp; VMS', 'Door lists, whole-party capture'],
        ['platform/#check-in', 'Door &amp; check-in', 'QR scanning at the door'],
        ['platform/#integrations', 'Integrations', 'POS, PMS, payments, ads'],
      ] },
      { h: 'Revenue', tag: 'The commercial engine', links: [
        ['sell/', 'Revenue overview', 'Every lever around the reservation'],
        ['sell/#events', 'Events &amp; ticketing', 'Tiered tickets and QR check-in'],
        ['sell/#packages', 'Packages &amp; upsells', 'Bottles, cakes, transfers'],
        ['sell/#dynamic-pricing', 'Dynamic pricing', 'Price the same seats to demand'],
        ['sell/#prepayments', 'Prepayments &amp; deposits', 'Commit revenue before arrival'],
      ] },
      { h: 'Marketing', tag: 'The demand loop', links: [
        ['grow/', 'Marketing overview', 'Turn each booking into better demand'],
        ['grow/#ads', 'Ads &amp; attribution', 'The booking is the conversion'],
        ['grow/#abandoned-recovery', 'Abandoned recovery', 'Return to the zone, date, and price'],
        ['grow/#guest-data', 'Guest data &amp; reports', '20+ reports, data you own'],
        ['ai-bookings/', 'AI-agent bookings', 'Built for the agent era'],
      ] },
    ],
    rail: {
      feature: ['platform/', 'Platform overview', 'Bookings, revenue, and marketing in one system'],
      links: [
        ['delivery/', 'How we deliver', 'Built around the venue you run'],
      ],
      cta: ['book-a-demo/', 'Book a Demo'],
    },
  },
  {
    key: 'solutions', label: 'Solutions', href: 'solutions/',
    cols: [
      { h: 'Who we serve', tag: '', links: [
        ['for-hotels/', 'Hotels &amp; resorts', ''],
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
      cta: ['book-a-demo/', 'Book a Demo'],
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
      cta: ['book-a-demo/', 'Book a Demo'],
    },
  },
  { key: 'pricing', label: 'Commercials', href: 'pricing/' },
  {
    key: 'company', label: 'Company', href: 'about/', small: true, align: 'right',
    cols: [
      { h: '', tag: '', links: [
        ['about/', 'About Clubtech', 'Founded in Singapore'],
        ['careers/', 'Careers', 'Work at Clubtech'],
        ['delivery/', 'How we deliver', 'Five stages to live'],
        ['support/', 'Support', 'Help for venue teams'],
        ['book-a-demo/', 'Contact sales', 'Book a focused walkthrough'],
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
    top.cols.forEach((c) => {
      if (c.h) links.push(`            <p class="m-subhead">${c.h}</p>`);
      c.links.forEach((l) => links.push(`            <a href="${href(l[0])}">${l[1]}</a>`));
    });
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
        <a class="button button-dark nav-cta" href="${href('book-a-demo/')}" data-open-demo>Book a Demo</a>
      </div>
      <details class="mobile-menu">
        <summary>Menu</summary>
        <div class="mobile-panel">
${mob}
          <a class="button button-mint m-cta" href="${href('book-a-demo/')}" data-open-demo>Book a Demo</a>
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
${links.map(([href, label]) => `        <a href="${routeHref(rel, href)}">${esc(label)}</a>`).join('\n')}
      </div>`;
  const r = (s) => `${rel}${s}`;
  return `  <footer class="footer shell">
    <div class="footer-top">
      <a href="${rel}index.html" class="brand"><img src="${rel}brand/clubtech-wordmark-white-560.png" alt="Clubtech" width="190" height="48"></a>
      <div>
        <a href="${r('platform/')}">Bookings</a>
        <a href="${r('sell/')}">Revenue</a>
        <a href="${r('grow/')}">Marketing</a>
        <a href="${r('solutions/')}">Solutions</a>
        <a href="${r('pricing/')}">Commercials</a>
        <a href="${r('blog/')}">Blog</a>
        <a href="${r('help/')}">Help</a>
        <a href="mailto:info@clubtechglobal.com">Email us</a>
        <a href="#" data-open-consent>Cookie preferences</a>
      </div>
    </div>
    <div class="footer-grid">
${FOOTER_GROUPS.map(([title, links]) => col(title, links)).join('\n')}
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
  <link rel="stylesheet" href="${rel}css/content-blocks.css">
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

/* Solution pages are product pages, not articles. Their source copy still
   lives in content/pages/*.md, but these route-specific settings choose the
   strongest demo surfaces and proof language for each venue, goal, or market. */
const SOLUTION_CONFIG = {
  'beach-clubs': {
    group: 'venue', kicker: 'Built for beach clubs', label: 'Beach clubs',
    heroShot: 'booking-map.webp', secondShot: 'operator-floor.webp',
    productTitle: 'The booking and the floor share one map.',
    productCopy: 'Guests choose the exact daybed. The operator sees that same inventory before doors open.',
    proof: [['3D map', 'Furniture-first booking'], ['4 taps', 'Mobile checkout'], ['FINNS', 'Named venue proof']],
  },
  'day-club-booking-system': {
    group: 'venue', kicker: 'Built for day clubs', label: 'Day clubs',
    heroShot: 'pricing-calendar.webp', secondShot: 'booking-map.webp',
    productTitle: 'Price the same deck to the daypart.',
    productCopy: 'The Saturday pool party and the quiet midweek lounger are different products. The calendar makes that visible.',
    proof: [['Dayparts', 'One deck, more yield'], ['Packages', 'Bottle pre-sales'], ['Prepaid', 'Saturday sold early']],
  },
  'hotel-pool-booking': {
    group: 'venue', kicker: 'Built for hotel pools', label: 'Hotel pools',
    heroShot: 'booking-map.webp', secondShot: 'operator-reservations.webp',
    productTitle: 'One pool deck. Resident and day-guest demand.',
    productCopy: 'Sell the exact cabana, keep inventory live for the floor, and own the direct day-pass channel.',
    proof: [['Direct', 'Owned day-pass channel'], ['Opera', 'PMS integration'], ['Map-first', 'Exact cabana selection']],
  },
  'nightclub-management-software': {
    group: 'venue', kicker: 'Built for nightclubs', label: 'Nightclubs',
    heroShot: 'operator-floor.webp', secondShot: 'doorlist-list.webp',
    productTitle: 'The table, the floor, and the door agree.',
    productCopy: 'VIP sales, live allocation, guest lists, and check-in sit on one operating picture.',
    proof: [['VIP tables', 'Pre-sold on the map'], ['Live floor', 'Allocation in one view'], ['Door list', 'QR-ready check-in']],
  },
  'nightclub-table-booking': {
    group: 'venue', kicker: 'Built for VIP table sales', label: 'Nightclub tables',
    heroShot: 'booking-map.webp', secondShot: 'operator-floor.webp',
    productTitle: 'Sell the booth before the night starts.',
    productCopy: 'Guests pick the exact table, stack the package, and commit before the door team ever opens the list.',
    proof: [['Map-based', 'Exact VIP table'], ['Packages', 'Bottle service attached'], ['Prepaid', 'No-show protection']],
  },
  'resorts': {
    group: 'venue', kicker: 'Built for resorts', label: 'Resorts',
    heroShot: 'operator-reservations.webp', secondShot: 'intel-reports.webp',
    productTitle: 'Every sellable outlet, one revenue picture.',
    productCopy: 'Pools, cabanas, day passes, events, and beach inventory feed the same operating and reporting loop.',
    proof: [['Multi-outlet', 'One booking surface'], ['20+ reports', 'Property-wide visibility'], ['White-label', 'The resort owns the guest']],
  },
  'restaurants': {
    group: 'venue', kicker: 'Built for experience-led restaurants', label: 'Restaurants',
    heroShot: 'restaurant-booking.webp', secondShot: 'operator-reservations.webp', demo: 'restaurant',
    productTitle: 'Try the restaurant booking journey.',
    productCopy: 'Pick the actual table, attach the experience, and confirm the value before arrival. This demo is fictional; the booking mechanics are the product.',
    proof: [['Exact table', 'Map-based selection'], ['Packages', 'Minimum spend attached'], ['White-label', 'Your domain and guest data']],
  },
  'sunbed-booking-system': {
    group: 'goal', kicker: 'Sell the deck in advance', label: 'Sunbed booking',
    heroShot: 'booking-map.webp', secondShot: 'pricing-rules.webp',
    productTitle: 'The front row should look premium before it is priced.',
    productCopy: 'A visual map turns location into value. Pricing rules protect the same furniture across peak and quiet demand.',
    proof: [['Exact spot', 'Guests choose the bed'], ['Dynamic', 'Price to demand'], ['Live sync', 'Sold inventory leaves the map']],
  },
  'event-ticketing-for-clubs': {
    group: 'goal', kicker: 'Sell and run event nights', label: 'Event ticketing',
    heroShot: 'events-tickets.webp', secondShot: 'events-checkout.webp',
    productTitle: 'Ticket sale to QR check-in, in one flow.',
    productCopy: 'Tiered tickets sit beside table bookings and guest lists, so the door receives one reconciled picture.',
    proof: [['Tiered', 'Ticket types and value'], ['QR', 'Check-in at the door'], ['One guest', 'Record across the night']],
  },
  'guest-list-management-software': {
    group: 'goal', kicker: 'Run the list and the door', label: 'Guest lists',
    heroShot: 'doorlist-list.webp', secondShot: 'doorlist-soldout.webp',
    productTitle: 'One list from every source.',
    productCopy: 'Reservations, tickets, promoter lists, and priority entry arrive at the door in one live view.',
    proof: [['One list', 'No spreadsheet merge'], ['Every guest', 'Whole-party capture'], ['Sold out', 'Priority data capture']],
  },
  'beach-club-booking-bali': {
    group: 'location', kicker: 'Clubtech in Bali', label: 'Bali',
    heroShot: 'booking-map.webp', secondShot: 'intel-attribution.webp',
    productTitle: 'Built for the booking made after 10pm.',
    productCopy: 'Map-first mobile booking, local payments, and attributed revenue fit the way Bali weekends are decided.',
    proof: [['FINNS', 'Flagship proof'], ['Midtrans', 'Local payment integration'], ['Bali time', 'Operator-side delivery']],
  },
  'beach-club-booking-dubai': {
    group: 'location', kicker: 'Clubtech in Dubai', label: 'Dubai',
    heroShot: 'pricing-calendar.webp', secondShot: 'booking-map.webp',
    productTitle: 'Make the compressed season visible.',
    productCopy: 'Price high-demand dates deliberately, sell premium zones before arrival, and keep a multi-currency guest in one mobile flow.',
    proof: [['Season-led', 'Demand-aware pricing'], ['Multi-currency', 'International checkout'], ['Hotel-ready', 'Pool and beach inventory']],
  },
  'beach-club-booking-phuket': {
    group: 'location', kicker: 'Clubtech in Phuket', label: 'Phuket',
    heroShot: 'booking-map.webp', secondShot: 'doorlist-soldout.webp',
    productTitle: 'High season sells. Green season captures.',
    productCopy: 'Pre-sell the premium weekends, then keep sold-out and priority demand working when inventory changes.',
    proof: [['SEA proven', 'Built one island over'], ['Map-first', 'Zone-specific inventory'], ['Multi-currency', 'Every passport']],
  },
  'beach-club-booking-ibiza': {
    group: 'location', kicker: 'Clubtech in Ibiza', label: 'Ibiza',
    heroShot: 'pricing-rules.webp', secondShot: 'booking-map.webp',
    productTitle: 'Configure the season before opening week.',
    productCopy: 'Package ladders, minimum spends, and day-specific pricing are ready before the first flight lands.',
    proof: [['Pre-season', 'Configured before opening'], ['VIP beds', 'Minimum spend attached'], ['Prepaid', 'Demand commits early']],
  },
  'beach-club-booking-mykonos': {
    group: 'location', kicker: 'Clubtech in Mykonos', label: 'Mykonos',
    heroShot: 'booking-map.webp', secondShot: 'intel-reports.webp',
    productTitle: 'A short season needs fast feedback.',
    productCopy: 'Sell ultra-premium furniture visually, then read lead time, product mix, and booking value while the season can still move.',
    proof: [['Ultra-premium', 'The exact bed is the product'], ['20+ reports', 'Read the season live'], ['Priority', 'Capture demand after sellout']],
  },
};

function stripHtml(value) {
  return String(value).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function splitSolutionBody(html) {
  const firstH2 = html.search(/<h2(?:\s[^>]*)?>/i);
  const intro = firstH2 < 0 ? html : html.slice(0, firstH2);
  const rest = firstH2 < 0 ? '' : html.slice(firstH2);
  const sections = [];
  const re = /<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2(?:\s[^>]*)?>|$)/gi;
  let match;
  while ((match = re.exec(rest))) {
    const rawTitle = match[1];
    const cleanTitle = stripHtml(rawTitle);
    const moduleMatch = cleanTitle.match(/^(Workflow|Capabilities|Outcomes|Fit|Proof)\s*(?:—|:|-)\s*(.+)$/i);
    sections.push({
      key: moduleMatch ? moduleMatch[1].toLowerCase() : 'detail',
      title: moduleMatch ? esc(moduleMatch[2]) : rawTitle,
      body: match[2],
    });
  }
  const faqIndex = sections.findIndex((section) => /questions operators ask/i.test(stripHtml(section.title)));
  return { intro, sections: faqIndex < 0 ? sections : sections.slice(0, faqIndex), faq: faqIndex < 0 ? null : sections[faqIndex] };
}

function normalizeSolutionLinks(html) {
  return String(html)
    .replaceAll('href="../../booking/#four-tap-checkout"', 'href="../../platform/#booking"')
    .replaceAll('href="../../booking/"', 'href="../../sell/#revenue"')
    .replaceAll('href="../../operations/"', 'href="../../platform/#operations"')
    .replaceAll('href="../../intelligence/#ads-integration"', 'href="../../grow/#ads"')
    .replaceAll('href="../../intelligence/"', 'href="../../grow/#guest-data"');
}

function solutionBodyParts(body) {
  const items = [];
  const itemRe = /<li>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = itemRe.exec(body))) items.push(match[1]);
  const lead = body.replace(/<(?:ul|ol)>[\s\S]*?<\/(?:ul|ol)>/gi, '').trim();
  return { lead, items };
}

function renderSolutionModule(section, config, index) {
  const { lead, items } = solutionBodyParts(section.body);
  const itemCards = items.map((item, itemIndex) => `<li><span>${itemIndex + 1}</span><div>${item}</div></li>`).join('');

  if (section.key === 'workflow') {
    return `<section class="solution-module solution-workflow ${items.length ? '' : 'is-copy-only'}" id="how-it-works"><div class="shell"><div class="solution-module-head"><p class="solution-module-index">How it works</p><h2>${section.title}</h2>${lead}</div>${items.length ? `<ol class="solution-steps">${itemCards}</ol>` : ''}</div></section>`;
  }
  if (section.key === 'capabilities') {
    return `<section class="solution-module solution-capabilities ${items.length ? '' : 'is-copy-only'}"><div class="shell solution-capability-layout"><div class="solution-capability-stage"><div class="solution-stage-chrome"><span></span><span></span><span></span><small>Clubtech · ${esc(config.label)}</small></div><img src="../../assets/product/${esc(config.secondShot)}" alt="Clubtech ${esc(config.label)} operating view" loading="lazy" decoding="async"></div><div class="solution-capability-copy"><p class="solution-module-index">Across the booking journey</p><h2>${section.title}</h2>${lead}${items.length ? `<ul class="solution-capability-list">${itemCards}</ul>` : ''}</div></div></section>`;
  }
  if (section.key === 'outcomes') {
    return `<section class="solution-module solution-outcomes dark-section ${items.length ? '' : 'is-copy-only'}"><div class="shell"><div class="solution-module-head"><p class="solution-module-index">Operator outcomes</p><h2>${section.title}</h2>${lead}</div>${items.length ? `<ul class="solution-outcome-grid">${itemCards}</ul>` : ''}</div></section>`;
  }
  if (section.key === 'fit') {
    return `<section class="solution-module solution-fit ${items.length ? '' : 'is-copy-only'}"><div class="shell solution-fit-layout"><div><p class="solution-module-index">Where it fits</p><h2>${section.title}</h2>${items.length ? lead : ''}</div>${items.length ? `<ul class="solution-fit-list">${itemCards}</ul>` : `<div class="solution-fit-copy">${lead}</div>`}</div></section>`;
  }
  if (section.key === 'proof') {
    return `<section class="solution-module solution-proof"><div class="shell solution-proof-panel"><div><p class="solution-module-index">The proof</p><h2>${section.title}</h2></div><div class="solution-proof-copy">${section.body}</div></div></section>`;
  }
  return `<section class="solution-module solution-detail"><div class="shell solution-detail-layout"><div><p class="solution-module-index">In detail</p><h2>${section.title}</h2></div><div>${section.body}</div></div></section>`;
}

function canonicalFeatureLabel(route) {
  const normalized = String(route || '').replace(/^\//, '');
  const capability = Object.values(CAPABILITIES).find((item) => item.canonical === normalized);
  if (capability) return `Explore ${capability.label}`;
  if (normalized.startsWith('solutions/')) return 'See the complete solution';
  const [label] = routeCard(normalized);
  return `Explore ${label}`;
}

function renderSolutionFaq(faq) {
  if (!faq) return '';
  const items = [];
  const body = faq.body.split('<hr/>', 1)[0];
  const re = /<h3(?:\s[^>]*)?>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3(?:\s[^>]*)?>|$)/gi;
  let match;
  while ((match = re.exec(body))) items.push(`<details><summary>${match[1]}</summary><div class="solution-faq-answer">${match[2]}</div></details>`);
  if (!items.length) return '';
  return `<section class="solution-faq"><div class="shell solution-faq-grid"><div><p class="eyebrow">Operator questions</p><h2>${faq.title}</h2></div><div class="solution-faq-list">${items.join('')}</div></div></section>`;
}

function renderSolutionProductBand(config) {
  const live = config.demo === 'restaurant'
    ? `<div class="ckd" data-demo="map" data-demo-kind="restaurant" data-demo-badge="Limited demo — try it" role="application" aria-label="Interactive restaurant booking demo — choose an exact table and dining option"></div>`
    : `<div class="solution-product-grid"><figure><img src="../../assets/product/${esc(config.heroShot)}" alt="Primary Clubtech product view for ${esc(config.label)}" loading="lazy" decoding="async"><figcaption>${esc(config.label)} booking view <span>Guest side</span></figcaption></figure><figure><img src="../../assets/product/${esc(config.secondShot)}" alt="Secondary Clubtech product view for ${esc(config.label)}" loading="lazy" decoding="async"><figcaption>Connected operating view <span>Venue side</span></figcaption></figure></div>`;
  return `<section class="solution-product-band"><div class="shell"><div class="solution-product-heading"><h2>${esc(config.productTitle)}</h2><p>${esc(config.productCopy)}</p></div>${live}</div></section>`;
}

function renderSolutionPage(page, pages) {
  const config = SOLUTION_CONFIG[page.meta.slug];
  const body = normalizeSolutionLinks(sanitizeBlogHtml(renderMarkdown(page.body, true)));
  const parts = splitSolutionBody(body);
  const relatedPool = pages.filter((p) => p.meta.section === 'solutions' && p.meta.slug !== page.meta.slug && SOLUTION_CONFIG[p.meta.slug]?.group === config.group);
  const related = [...relatedPool, ...pages.filter((p) => p.meta.section === 'solutions' && p.meta.slug !== page.meta.slug && !relatedPool.includes(p))].slice(0, 3);
  const pathways = splitMetaList(page.meta.related);
  const relatedCards = related.map((item) => {
    const relatedConfig = SOLUTION_CONFIG[item.meta.slug];
    return `<a class="solution-related-card" href="../${esc(item.meta.slug)}/"><img src="../../assets/product/${esc(relatedConfig?.heroShot || 'booking-map.webp')}" alt="" loading="lazy" decoding="async"><div class="solution-related-copy"><small>${esc(relatedConfig?.label || 'Solution')}</small><strong>${esc(plainTitle(item.meta.title))}</strong></div><span aria-hidden="true">↗</span></a>`;
  }).join('');
  const modules = parts.sections.map((section, index) => renderSolutionModule(section, config, index)).join('');
  const head = headHTML({
    title: page.meta.titleTag || `${plainTitle(page.meta.title)} | Clubtech`,
    description: page.meta.description || page.meta.excerpt,
    canonical: pageCanonical(page),
    ogImage: `${SITE_ORIGIN}${page.meta.hero}`,
    ogImageAlt: page.meta.heroAlt || plainTitle(page.meta.title),
    jsonLd: pageJsonLd(page), rel: '../../', ogType: 'website',
  });
  const proof = config.proof.map(([value, label]) => `<li><strong>${esc(value)}</strong><span>${esc(label)}</span></li>`).join('');
  const restaurantCss = config.demo === 'restaurant' ? '<link rel="stylesheet" href="../../css/demo.css">' : '';
  const restaurantJs = config.demo === 'restaurant' ? '<script src="../../js/demo.js" defer></script>' : '';
  const solutionStyles = `  <link rel="stylesheet" href="../../css/solutions.css">${restaurantCss ? `\n  ${restaurantCss}` : ''}`;
  const solutionHead = head.replace('</head>', `${solutionStyles}\n</head>`);

  return `${solutionHead}
<body class="solution-page p-solutions solution-${esc(page.meta.slug)}">
<a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../../', 'solutions')}
<main id="main">
  <header class="solution-hero"><div class="shell solution-hero-grid"><div><p class="solution-kicker"><i></i>${esc(config.kicker)}</p><h1>${h1Html(page.meta.title)}</h1><p class="solution-hero-copy">${esc(page.meta.excerpt)}</p><div class="solution-actions"><a class="button button-mint" href="../../book-a-demo/" data-open-demo>Book a Demo</a><a class="button button-ghost" href="#how-it-works">See the workflow ↓</a></div>${page.meta.canonicalFeature ? `<a class="solution-canonical" href="${esc(routeHref('../../', page.meta.canonicalFeature))}">${esc(canonicalFeatureLabel(page.meta.canonicalFeature))} <span aria-hidden="true">↗</span></a>` : ''}<ul class="solution-proofline">${proof}</ul></div><div class="solution-hero-visual"><div class="solution-stage-chrome"><span></span><span></span><span></span><small>Clubtech · ${esc(config.label)}</small></div><img class="solution-hero-shot" src="../../assets/product/${esc(config.heroShot)}" alt="Clubtech ${esc(config.label)} product experience" fetchpriority="high" decoding="async"><figure class="solution-hero-photo"><img src="../..${esc(page.meta.hero)}" alt="${esc(page.meta.heroAlt)}" fetchpriority="high" decoding="async"><figcaption>${esc(config.label)} · venue context</figcaption></figure><span class="solution-hero-label"><i></i>Live product surface</span></div></div></header>
  <section class="solution-intro"><div class="shell solution-intro-grid"><div class="solution-intro-label"><p class="eyebrow">The operating case</p><p>Inventory · revenue · service day · owned data</p></div><div class="solution-lead">${parts.intro}</div></div></section>
${renderSolutionProductBand(config)}
${modules}
${renderSolutionFaq(parts.faq)}
  ${renderPathwayRail(pathways, '../../', 'Connected product path', 'See the capability, the operating fit, and the proof.')}
  <section class="solution-related"><div class="shell"><div class="solution-related-head"><div><p class="eyebrow">Keep exploring</p><h2>Related solutions</h2></div><a href="../">See every solution ↗</a></div><div class="solution-related-grid">${relatedCards}</div></div></section>
  <section class="closing dark-section"><img class="closing-mark" src="../../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy"><div class="shell centered"><p class="eyebrow">Your venue, pre-sold.</p><h2>Put your venue<br><span class="mint-text">inside the demo.</span></h2><p>Book a focused walkthrough, configured around a premium venue like yours.</p><a class="button button-mint" href="../../book-a-demo/" data-open-demo>Book a Demo</a></div></section>
${footerMarkup('../../', pages)}
</main>
${CONSENT_MARKUP}
<script src="../../js/consent.js" defer></script><script src="../../js/hubspot.js" defer></script><script src="../../js/booking.js" defer></script><script src="../../js/analytics.js" defer></script><script src="../../js/blog.js" defer></script>${restaurantJs}
</body></html>`;
}

const ROUTE_LABELS = {
  'book-a-demo/': ['Book a Demo', 'See Clubtech configured around your venue.'],
  'platform/': ['Bookings', 'Follow the booking from first tap to the floor.'],
  'sell/': ['Revenue', 'See the revenue mechanics behind the reservation.'],
  'grow/': ['Marketing', 'Connect booking value, guest data, and reporting.'],
  'delivery/': ['Delivery', 'See how Clubtech gets a venue live.'],
  'pricing/': ['Commercial fit', 'Shape the rollout and commercials around your venue.'],
  'for-hotels/': ['For hotels', 'See the owned pool and day-pass model.'],
  'support/': ['Support', 'Reach the Clubtech team for venue-specific help.'],
  'help/': ['Help center', 'Get plain answers about the platform.'],
};

function routeCard(route) {
  const normalized = String(route).replace(/^\//, '');
  const base = normalized.split('#')[0];
  if (ROUTE_LABELS[base]) return ROUTE_LABELS[base];
  if (normalized.startsWith('solutions/')) return ['See the operating fit', 'Open the solution built around this venue or workflow.'];
  if (normalized.startsWith('compare/')) return ['Compare the fit', 'See where each operating model is the stronger choice.'];
  if (normalized.startsWith('blog/')) return ['Read the playbook', 'Go deeper on the operator decision behind this page.'];
  const capability = Object.values(CAPABILITIES).find((item) => item.canonical === normalized);
  if (capability) return [capability.label, 'See the approved product capability in its canonical home.'];
  return ['Keep exploring', 'Continue to the next relevant Clubtech page.'];
}

function renderTeamSection() {
  const cards = TEAM.map((m) => `      <article class="team-card"><img class="team-avatar" src="../assets/team/${esc(m.img)}" alt="${esc(m.name)}" width="96" height="96" loading="lazy" decoding="async"><h3>${esc(m.name)}</h3><p class="team-role">${esc(m.role)}</p><p class="team-blurb">${esc(m.blurb)}</p></article>`).join('\n');
  return `  <section class="team-section"><div class="shell">
    <h2>The people who <span class="indigo-text">run the build.</span></h2>
    <div class="team-grid">
${cards}
    </div>
  </div></section>`;
}

function renderPathwayRail(routes, rel, eyebrow = 'Next step', heading = 'Keep the decision moving.') {
  const unique = [...new Set(routes.filter(Boolean))].slice(0, 3);
  if (!unique.length) return '';
  const cards = unique.map((route) => {
    const [label, copy] = routeCard(route);
    const normalized = String(route).replace(/^\//, '');
    const base = normalized.split('#')[0];
    const rootTypes = { 'platform/': 'Bookings', 'sell/': 'Revenue', 'grow/': 'Marketing', 'delivery/': 'Delivery', 'pricing/': 'Commercials', 'for-hotels/': 'Solution', 'help/': 'Support', 'support/': 'Support', 'about/': 'Company', 'careers/': 'Company', 'book-a-demo/': 'Next step' };
    const type = normalized.startsWith('solutions/') ? 'Solution' : normalized.startsWith('compare/') ? 'Comparison' : normalized.startsWith('blog/') ? 'Guide' : rootTypes[base] || 'Explore';
    return `<a class="pathway-card" href="${esc(routeHref(rel, route))}"><span>${esc(type)}</span><strong>${esc(label)}</strong><p>${esc(copy)}</p><i aria-hidden="true">↗</i></a>`;
  }).join('');
  return `<section class="pathway-rail"><div class="shell"><p class="eyebrow">${esc(eyebrow)}</p><div class="pathway-head"><h2>${esc(heading)}</h2></div><div class="pathway-grid">${cards}</div></div></section>`;
}

function renderComparisonPage(page, pages) {
  const config = COMPARISON_CONFIG[page.meta.slug] || {};
  const capability = CAPABILITIES[config.capability] || CAPABILITIES.booking;
  const body = normalizeInternalLinks(sanitizeBlogHtml(renderMarkdown(page.body, true)));
  const related = splitMetaList(page.meta.related);
  const pathways = related.length ? related : [config.solution, capability.canonical, 'delivery/'];
  const verified = page.meta.verificationDate
    ? `<p class="comparison-verified">Competitor details checked ${esc(page.meta.verificationDate)}${page.meta.verificationSource ? ` · <a href="${esc(page.meta.verificationSource)}" rel="noopener">primary source</a>` : ''}</p>`
    : '<p class="comparison-verified is-pending">Competitor details require a current primary-source check before the next factual update.</p>';
  const head = headHTML({
    title: page.meta.titleTag || `${plainTitle(page.meta.title)} | Clubtech`,
    description: page.meta.description || page.meta.excerpt,
    canonical: pageCanonical(page),
    ogImage: `${SITE_ORIGIN}${page.meta.hero}`,
    ogImageAlt: page.meta.heroAlt || plainTitle(page.meta.title),
    jsonLd: pageJsonLd(page), rel: '../../', ogType: 'website',
  });
  return `${head}
<body class="comparison-page p-compare"><a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../../', 'resources')}
<main id="main">
  <header class="comparison-hero"><div class="shell comparison-hero-grid"><div><p class="solution-kicker"><i></i>Fair-fit comparison</p><h1>${h1Html(page.meta.title)}</h1><p class="comparison-sub">${esc(page.meta.excerpt)}</p><div class="solution-actions"><a class="button button-mint" href="../../book-a-demo/" data-open-demo>Book a Demo</a><a class="button button-ghost" href="../../${esc(config.solution || 'platform/')}">See the relevant solution</a></div>${verified}</div><div class="comparison-visual"><img class="comparison-venue" src="../..${esc(page.meta.hero)}" alt="${esc(page.meta.heroAlt)}" fetchpriority="high" decoding="async"><img class="comparison-product" src="../../assets/product/${esc(config.proof || capability.asset || 'booking-map.webp')}" alt="Clubtech ${esc(capability.label)} product view" fetchpriority="high" decoding="async"><span>Clubtech product proof</span></div></div></header>
  <section class="comparison-thesis"><div class="shell"><p>Decision first.</p><h2>Choose the operating model that fits the inventory—not the loudest feature list.</h2></div></section>
  <article class="comparison-article"><div class="shell comparison-body"><aside><p class="eyebrow">What Clubtech owns</p><h2>${esc(capability.label)}</h2><p>The full product explanation lives on the canonical capability page. This comparison stays focused on fit.</p><a href="../../${esc(capability.canonical)}">See the capability ↗</a></aside><div class="post-body">${body}</div></div></article>
  <section class="comparison-proof-band"><div class="shell"><div><p class="eyebrow">Product proof</p><h2>See the Clubtech side of the decision.</h2><p>${esc(capability.label)} is shown in the actual product, not described as a checklist.</p></div><figure><img src="../../assets/product/${esc(config.proof || capability.asset || 'booking-map.webp')}" alt="Clubtech ${esc(capability.label)} interface" loading="lazy" decoding="async"><figcaption>Clubtech · ${esc(capability.label)}</figcaption></figure></div></section>
  ${renderPathwayRail(pathways, '../../', 'Evaluation pathway', 'Fit, product, then implementation.')}
  <section class="closing dark-section"><img class="closing-mark" src="../../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy"><div class="shell centered"><p class="eyebrow">Compare it on your floor.</p><h2>See Clubtech on <span class="mint-text">your own inventory.</span></h2><p>Book a focused walkthrough configured around the venue you actually run.</p><a class="button button-mint" href="../../book-a-demo/" data-open-demo>Book a Demo</a></div></section>
${footerMarkup('../../', pages)}</main>${CONSENT_MARKUP}
<script src="../../js/consent.js" defer></script><script src="../../js/hubspot.js" defer></script><script src="../../js/booking.js" defer></script><script src="../../js/analytics.js" defer></script><script src="../../js/blog.js" defer></script>
</body></html>`;
}

function renderLandingPage(page, pages) {
  if (page.meta.section === 'solutions' && SOLUTION_CONFIG[page.meta.slug]) return renderSolutionPage(page, pages);
  if (page.meta.section === 'compare') return renderComparisonPage(page, pages);
  const body = normalizeInternalLinks(sanitizeBlogHtml(renderMarkdown(page.body)));
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
          <a class="button button-mint" href="../../book-a-demo/" data-open-demo>Book a Demo</a>
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
      <a class="button button-mint" href="../book-a-demo/" data-open-demo>Book a Demo</a>
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
const LANDING_LABEL = { platform: 'Platform', company: 'Company', resources: 'Resources', pricing: 'Commercial fit', solutions: 'Solutions' };

function rootJsonLd(page) {
  const url = `${SITE_ORIGIN}/${page.meta.slug}/`;
  const faqs = extractFaqs(page.body);
  const webpage = {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    name: page.meta.titleTag || plainTitle(page.meta.title),
    headline: plainTitle(page.meta.title),
    description: page.meta.description || page.meta.excerpt,
    datePublished: page.meta.date,
    dateModified: page.meta.date,
    isPartOf: { '@id': `${CANONICAL_ORIGIN}/#website` },
    about: { '@id': `${CANONICAL_ORIGIN}/#organization` },
    url,
  };
  if (faqs.length) webpage.mainEntity = { '@id': `${url}#faq` };
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
      url,
      isPartOf: { '@id': `${CANONICAL_ORIGIN}/#website` },
      mainEntity: faqs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
    });
  }
  return JSON.stringify(obj, null, 2);
}

/* Optional interactive product demo a root landing page can embed via a
   `demo:` frontmatter key. The demos are the same self-contained JS/CSS the
   hand-written pillar pages mount; the <link> is emitted in-body (valid HTML5)
   so headHTML stays untouched. */
const DEMO_EMBED = {
  support:  { css: 'css/support.css',  js: 'js/support.js',  mount: '<div class="cks" data-supportdemo="tickets" data-supportdemo-badge="Live support console" role="application" aria-label="Clubtech Support console demo — a ticket list and thread, portal and WhatsApp in one place" style="aspect-ratio:auto;height:640px"></div>' },
  booking:  { css: 'css/demo.css',     js: 'js/demo.js',     mount: '<div class="ckd" data-demo="map" role="application" aria-label="Interactive booking demo" style="height:720px;background-image:url(../assets/demo/venue-real.webp);background-size:cover;background-position:center"></div>' },
};

const LANDING_ASSET = {
  about: 'booking-map.webp',
  'ai-bookings': 'booking-map.webp',
  'for-hotels': 'operator-reservations.webp',
  help: 'operator-floor.webp',
  pricing: 'pricing-calendar.webp',
};

function splitHtmlBlocks(html) {
  const firstH2 = html.search(/<h2(?:\s[^>]*)?>/i);
  const intro = firstH2 < 0 ? html : html.slice(0, firstH2);
  const rest = firstH2 < 0 ? '' : html.slice(firstH2);
  const blocks = [];
  const re = /<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2(?:\s[^>]*)?>|$)/gi;
  let match;
  while ((match = re.exec(rest))) blocks.push({ title: match[1], body: match[2] });
  return { intro, blocks };
}

function renderLandingBlocks(parts, layout) {
  return parts.blocks.map((block, index) => {
    const title = stripHtml(block.title);
    const questionBlock = /questions|frequently asked/i.test(title);
    if (questionBlock) {
      const items = [];
      const body = block.body.split('<hr/>', 1)[0];
      const re = /<h3(?:\s[^>]*)?>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3(?:\s[^>]*)?>|$)/gi;
      let match;
      while ((match = re.exec(body))) {
        items.push(`<details class="faq-item"><summary><h3>${match[1]}</h3><span class="faq-toggle" aria-hidden="true">+</span></summary><div class="landing-faq-answer">${match[2]}</div></details>`);
      }
      return `<section class="landing-block is-faq" id="${esc(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}"><div class="shell landing-block-grid"><div class="landing-block-head"><p class="landing-block-index">Operator questions</p><h2>${block.title}</h2></div><div class="faq-list landing-faq-list">${items.join('')}</div></div></section>`;
    }
    const tone = questionBlock ? 'is-faq' : index % 3 === 1 ? 'is-dark' : index % 3 === 2 ? 'is-soft' : 'is-light';
    const label = questionBlock ? 'Operator questions' : index === 0 ? 'The essentials' : index % 3 === 1 ? 'How it works' : 'What to know';
    return `<section class="landing-block ${tone}" id="${esc(title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))}"><div class="shell landing-block-grid"><div class="landing-block-head"><p class="landing-block-index">${esc(label)}</p><h2>${block.title}</h2></div><div class="landing-block-body">${block.body}</div></div></section>`;
  }).join('');
}

function renderRootPage(page, landings, pages) {
  const body = normalizeInternalLinks(sanitizeBlogHtml(renderMarkdown(page.body, true)));
  const parts = splitHtmlBlocks(body);
  const config = LANDING_CONFIG[page.meta.slug] || { layout: page.meta.layout || 'standard', primary: ['book-a-demo/', 'Book a Demo'], secondary: ['platform/', 'See the platform'], related: ['platform/', 'delivery/', 'book-a-demo/'] };
  const layout = page.meta.layout || config.layout || 'standard';
  const stageLabel = layout === 'pricing' ? 'commercial fit' : layout;
  const eyebrow = page.meta.eyebrow || LANDING_LABEL[page.meta.group] || 'Clubtech';
  const demo = page.meta.demo ? DEMO_EMBED[page.meta.demo] : null;
  const demoMarkup = demo ? `
  <section class="section shell" aria-label="Product demo">
    ${demo.mount}
    <script src="../${demo.js}" defer></script>
  </section>` : '';
  const primary = page.meta.ctaHref ? [page.meta.ctaHref, page.meta.ctaLabel || 'Continue'] : config.primary;
  const secondary = page.meta.cta2href ? [page.meta.cta2href, page.meta.cta2label || 'Learn more'] : config.secondary;
  const productAsset = LANDING_ASSET[page.meta.slug];
  const primaryDemo = page.meta.ctaType === 'demo' || primary[0] === 'book-a-demo/';
  const closing = config.closing || ['Your venue, pre-sold.', 'Put your venue inside the demo.', 'Book a Demo'];
  const related = splitMetaList(page.meta.related);

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
  const landingHead = demo ? head.replace('</head>', `  <link rel="stylesheet" href="../${demo.css}">\n</head>`) : head;

  return `${landingHead}
<body class="landing-page p-landing landing-${esc(layout)}">
<a class="skip-link" href="#main">Skip to content</a>
${navMarkup('../', page.meta.group || null)}
<main id="main">
  <header class="landing-hero"><div class="shell landing-hero-grid"><div><p class="solution-kicker"><i></i>${esc(eyebrow)}</p><h1>${h1Html(page.meta.title)}</h1><p class="landing-sub">${esc(page.meta.excerpt)}</p><div class="solution-actions"><a class="button button-mint" href="${esc(routeHref('../', primary[0]))}"${primaryDemo ? ' data-open-demo' : ''}>${esc(primary[1])}</a><a class="button button-ghost" href="${esc(routeHref('../', secondary[0]))}">${esc(secondary[1])}</a></div></div>${productAsset || page.meta.hero ? `<div class="landing-hero-visual">${productAsset ? `<div class="solution-stage-chrome"><span></span><span></span><span></span><small>Clubtech · ${esc(stageLabel)}</small></div><img class="landing-product" src="../assets/product/${esc(productAsset)}" alt="Clubtech product view for ${esc(plainTitle(page.meta.title))}" fetchpriority="high" decoding="async">` : ''}${page.meta.hero ? `<img class="landing-context" src="..${esc(page.meta.hero)}" alt="${esc(page.meta.heroAlt || plainTitle(page.meta.title))}" fetchpriority="high" decoding="async">` : ''}</div>` : ''}</div></header>
${parts.intro.trim() ? `  <section class="landing-intro"><div class="shell landing-intro-copy">${parts.intro}</div></section>\n` : ''}${renderLandingBlocks(parts, layout)}
${page.meta.slug === 'about' ? renderTeamSection() : ''}
${demoMarkup}
  ${renderPathwayRail(related.length ? related : config.related || [], '../', 'Related pathway', 'The next useful page, not more noise.')}
  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy">
    <div class="shell centered">
      <p class="eyebrow">${esc(closing[0])}</p>
      <h2>${esc(closing[1])}</h2>
      <p>${esc(page.meta.excerpt)}</p>
      <a class="button button-mint" href="${esc(routeHref('../', primary[0]))}"${primaryDemo ? ' data-open-demo' : ''}>${esc(closing[2] || primary[1])}</a>
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

/* Overview prose rendered above the tile list on each hub page. Grounded in the
   vault positioning (furniture/zones/dayparts model; furniture-first + native
   ads-loop wedge; fair-comparison doctrine). Kept short — the tiles do the rest. */
const SECTION_INTRO = {
  solutions: [
    'Venues run on furniture, zones, and dayparts — a front-row daybed, a swim-up cabana, a VIP table, sold by date and time. Clubtech models that inventory the way each venue type actually sells it, then pre-sells it on a 3D birds-eye map under your own brand.',
    'The pages below are the same platform configured for a specific venue type or destination. The mechanics carry across all of them: guests pick the exact spot, prepay before arrival, and every booking feeds your ads and guest data with real revenue attached.',
  ],
  compare: [
    'Plenty of platforms take prepaid bookings, and a few do furniture-first white-label. What none of them pair is furniture-first booking with a native, server-side ads-revenue loop — every booking posted back to Meta, Google, and GA4 with its real value.',
    'These comparisons are written to be fair. Where an alternative is the better fit for your venue — restaurant covers, US casino resorts, midweek day-pass fill — the page says so. We win on fit, not noise.',
  ],
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

function renderSolutionsIndex(pages) {
  const sectionPages = pages.filter((page) => page.meta.section === 'solutions');
  const groups = [
    ['venue', 'By venue', 'Start with the inventory your team sells: daybeds, cabanas, tables, pool access, or a whole resort.'],
    ['location', 'By destination', 'See how the same product handles compressed seasons, local payments, and international guests.'],
    ['goal', 'By operational need', 'Go straight to the workflow: sunbeds, ticketing, guest lists, and the door.'],
  ];
  const cards = (group) => sectionPages.filter((page) => SOLUTION_CONFIG[page.meta.slug]?.group === group).map((page, index) => {
    const config = SOLUTION_CONFIG[page.meta.slug];
    return `<a class="solution-card ${index === 0 ? 'is-featured' : ''}" href="${esc(page.meta.slug)}/"><div class="solution-card-visual"><img src="../assets/product/${esc(config.heroShot)}" alt="" loading="lazy" decoding="async"><span>${esc(config.kicker)}</span></div><div class="solution-card-copy"><small>${esc(config.label)}</small><strong>${esc(plainTitle(page.meta.title))}</strong><p>${esc(page.meta.excerpt)}</p><span class="solution-card-link">Explore ${esc(config.label)} <i aria-hidden="true">↗</i></span></div></a>`;
  }).join('');
  const groupMarkup = groups.map(([key, title, copy]) => `<section class="solution-group solution-group-${esc(key)}" id="${esc(key)}"><div class="solution-group-head"><div><p class="solution-module-index">Find your fit</p><h2>${esc(title)}</h2></div><p>${esc(copy)}</p></div><div class="solution-card-grid">${cards(key)}</div></section>`).join('');
  const head = headHTML({
    title: 'Solutions — Clubtech',
    description: 'Clubtech booking and revenue solutions by venue type and destination — beach clubs, day clubs, nightclubs, hotel pools, restaurants, resorts, and sunbed decks.',
    canonical: `${SITE_ORIGIN}/solutions/`,
    ogImage: `${SITE_ORIGIN}/assets/og/clubtech-og.jpg`,
    ogImageAlt: 'Clubtech booking and venue operations platform',
    jsonLd: sectionIndexJsonLd('solutions', sectionPages), rel: '../', ogType: 'website',
  });
  const solutionHead = head.replace('</head>', '  <link rel="stylesheet" href="../css/solutions.css">\n</head>');
  return `${solutionHead}
<body class="solution-page p-solutions-index"><a class="skip-link" href="#main">Skip to content</a>${navMarkup('../', 'solutions')}<main id="main">
  <section class="index-hero solution-index-hero"><div class="shell solution-index-hero-grid"><div><p class="index-kicker"><span class="tick"></span>Solutions · ${sectionPages.length} product pages</p><h1 class="index-h1">Built for how <span class="mint-text">your venue sells.</span></h1><p class="index-sub">Sunbeds, daybeds, tables, tickets, and day passes — one platform, configured around the real inventory and the team running it.</p><div class="solution-hub-nav" aria-label="Browse solutions"><a href="#venue">By venue <span>↘</span></a><a href="#location">By destination <span>↘</span></a><a href="#goal">By operational need <span>↘</span></a></div></div><div class="solution-index-showcase"><div class="solution-stage-chrome"><span></span><span></span><span></span><small>Clubtech · booking map</small></div><img src="../assets/product/booking-map.webp" alt="Clubtech interactive venue booking map" fetchpriority="high" decoding="async"><div class="solution-index-callout"><strong>The booking is the product.</strong><span>Exact inventory · prepayment · live floor</span></div></div></div></section>
  <section class="solution-index-thesis"><div class="shell"><p>One platform, three ways in.</p><h2>Choose the venue, the market, or the workflow. The product stays connected from booking to floor to guest data.</h2></div></section>
  <div class="shell solution-index-groups">${groupMarkup}</div>
  <section class="closing dark-section"><img class="closing-mark" src="../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy"><div class="shell centered"><p class="eyebrow">Your venue, pre-sold.</p><h2>Put your venue<br><span class="mint-text">inside the demo.</span></h2><p>Book a focused walkthrough, configured around your floor and sellable inventory.</p><a class="button button-mint" href="../book-a-demo/" data-open-demo>Book a Demo</a></div></section>
${footerMarkup('../', pages)}</main>${CONSENT_MARKUP}<script src="../js/consent.js" defer></script><script src="../js/hubspot.js" defer></script><script src="../js/booking.js" defer></script><script src="../js/analytics.js" defer></script><script src="../js/blog.js" defer></script></body></html>`;
}

function renderCompareIndex(pages) {
  const comparisonPages = pages.filter((page) => page.meta.section === 'compare');
  const groups = [
    ['Furniture and reservations', ['sevenrooms-alternative', 'book-tech-labs-alternative', 'access-collins-alternative', 'servme-alternative']],
    ['Hotels and direct channels', ['resortpass-alternative', 'urvenue-alternative', 'hoteligy-alternative']],
    ['Nightlife and ticketing', ['fourvenues-alternative', 'megatix-alternative', 'tablelist-alternative']],
  ];
  const bySlug = new Map(comparisonPages.map((page) => [page.meta.slug, page]));
  const groupMarkup = groups.map(([title, slugs], groupIndex) => {
    const cards = slugs.map((slug, index) => {
      const page = bySlug.get(slug);
      if (!page) return '';
      const config = COMPARISON_CONFIG[slug] || {};
      return `<a class="compare-card ${index === 0 ? 'is-priority' : ''}" href="${esc(slug)}/"><span class="compare-card-num">0${index + 1}</span><div><small>${esc(title)}</small><h3>${esc(plainTitle(page.meta.title))}</h3><p>${esc(page.meta.excerpt)}</p><span>Compare the fit ↗</span></div><img src="../assets/product/${esc(config.proof || 'booking-map.webp')}" alt="" loading="lazy" decoding="async"></a>`;
    }).join('');
    return `<section class="compare-group"><div class="compare-group-head"><p>0${groupIndex + 1} · Operating model</p><h2>${esc(title)}</h2></div><div class="compare-card-grid">${cards}</div></section>`;
  }).join('');
  const head = headHTML({
    title: 'Compare Clubtech — fair-fit platform comparisons',
    description: 'Fair, factual comparisons of Clubtech with venue booking, hotel day-pass, nightlife, ticketing, and restaurant platforms.',
    canonical: `${SITE_ORIGIN}/compare/`, ogImage: `${SITE_ORIGIN}/assets/og/clubtech-og.jpg`,
    ogImageAlt: 'Compare Clubtech with other venue platforms',
    jsonLd: sectionIndexJsonLd('compare', comparisonPages), rel: '../', ogType: 'website',
  });
  return `${head}<body class="compare-index"><a class="skip-link" href="#main">Skip to content</a>${navMarkup('../', 'resources')}<main id="main">
  <section class="comparison-hero compare-index-hero"><div class="shell comparison-hero-grid"><div><p class="solution-kicker"><i></i>Compare Clubtech</p><h1>Choose by operating model, <span class="mint-text">not feature count.</span></h1><p class="comparison-sub">These comparisons say where another platform fits better, where Clubtech fits better, and what to verify before you move.</p><div class="solution-actions"><a class="button button-mint" href="../book-a-demo/" data-open-demo>Book a Demo</a><a class="button button-ghost" href="../platform/">See the Platform</a></div></div><div class="comparison-principles"><p>Fair-fit doctrine</p><ol><li><span>01</span>Start with the inventory.</li><li><span>02</span>Separate verified fact from interpretation.</li><li><span>03</span>Show coexistence when it makes sense.</li></ol></div></div></section>
  <section class="comparison-thesis"><div class="shell"><p>The short version.</p><h2>Restaurant covers, ticket drops, resort portfolios, and exact furniture are different buying problems.</h2></div></section>
  <div class="shell compare-groups">${groupMarkup}</div>
  ${renderPathwayRail(['platform/', 'solutions/', 'delivery/'], '../', 'Before the shortlist', 'See the product, the fit, and the rollout.')}
  <section class="closing dark-section"><img class="closing-mark" src="../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy"><div class="shell centered"><p class="eyebrow">Compare it on your floor.</p><h2>See Clubtech on <span class="mint-text">your own inventory.</span></h2><p>A focused walkthrough is more useful than another checklist.</p><a class="button button-mint" href="../book-a-demo/" data-open-demo>Book a Demo</a></div></section>
${footerMarkup('../', pages)}</main>${CONSENT_MARKUP}<script src="../js/consent.js" defer></script><script src="../js/hubspot.js" defer></script><script src="../js/booking.js" defer></script><script src="../js/analytics.js" defer></script><script src="../js/blog.js" defer></script></body></html>`;
}

function renderSectionIndex(sectionKey, pages) {
  if (sectionKey === 'solutions') return renderSolutionsIndex(pages);
  if (sectionKey === 'compare') return renderCompareIndex(pages);
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
      ${SECTION_INTRO[sectionKey] ? `<div class="index-intro">${SECTION_INTRO[sectionKey].map((p) => `<p>${esc(p)}</p>`).join('')}</div>` : ''}
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
      <a class="button button-mint" href="../book-a-demo/" data-open-demo>Book a Demo</a>
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

  ${renderPathwayRail(['platform/', 'sell/', 'grow/'], '../', 'Product pathways', 'Booking, revenue, and guest intelligence.')}

  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy" decoding="async">
    <div class="shell centered">
      <p class="eyebrow">Your venue, pre-sold.</p>
      <h2>Stop reading about it.<br><span class="mint-text">See it live.</span></h2>
      <p>Book a focused walkthrough, configured around a premium venue like yours.</p>
      <a class="button button-mint" href="../book-a-demo/" data-open-demo>Book a Demo</a>
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
  const body = normalizeInternalLinks(sanitizeBlogHtml(renderMarkdown(post.body, true)));
  const readMin = readMinutes(post.body);
  const explicitRelated = splitMetaList(post.meta.related);
  const pathways = explicitRelated.length ? explicitRelated : BLOG_PATHWAYS[post.meta.slug] || ['platform/', 'solutions/', 'book-a-demo/'];
  const pathwayText = pathways.join(' ');
  const proofAsset = /guest-list|check-in|door/.test(pathwayText) ? 'doorlist-list.webp'
    : /dynamic-pricing|sell\/#/.test(pathwayText) ? 'pricing-rules.webp'
      : /grow\/#/.test(pathwayText) ? 'intel-attribution.webp'
        : 'booking-map.webp';

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

  <section class="article-proof-band"><div class="shell"><div><p class="eyebrow">The product path</p><h2>See the mechanism behind the playbook.</h2><p>The article answers the operating question. The product surface shows where Clubtech carries it into the booking, floor, or data loop.</p></div><figure><img src="../../assets/product/${proofAsset}" alt="Clubtech product interface related to ${esc(post.meta.title)}" loading="lazy" decoding="async"><figcaption>Clubtech · product proof</figcaption></figure></div></section>
  ${renderPathwayRail(pathways, '../../', 'Continue by intent', 'Learn, see the product, then decide.')}

  <section class="closing dark-section blog-closing">
    <img class="closing-mark" src="../../brand/clubtech-mark-white.png" alt="" aria-hidden="true" width="1200" height="1200" loading="lazy" decoding="async">
    <div class="shell centered">
      <p class="eyebrow">Your venue, pre-sold.</p>
      <h2>Stop reading about it.<br><span class="mint-text">See it live.</span></h2>
      <p>Book a focused walkthrough, configured around a premium venue like yours.</p>
      <a class="button button-mint" href="../../book-a-demo/" data-open-demo>Book a Demo</a>
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
- Commercials are scoped after discovery. Clubtech maps the venue, systems, payments, integrations, and rollout, then returns with a proposal built around the confirmed operation.
- Integrations cover POS/PMS, payments, marketing attribution, and messaging. Availability is confirmed per venue and market during implementation.
- Delivery: five stages (onboarding, build, training, go-live, optimize) with a dedicated account lead and 90-day hypercare.
- Contact: info@clubtechglobal.com · main site: https://www.clubtechglobal.com/

## Pages

- [Landing page](${SITE_ORIGIN}/): platform overview, booking journey, operations, commercials, FAQ
- [Bookings](${SITE_ORIGIN}/platform/): the guest journey, front-of-house operations, guest lists, door check-in, and integrations
- [Revenue](${SITE_ORIGIN}/sell/): revenue capture through events, packages, upsells, dynamic pricing, prepayments, and recovery
- [Marketing](${SITE_ORIGIN}/grow/): value-based attribution, abandoned-booking recovery, owned guest data, and 20+ reports
- [Delivery](${SITE_ORIGIN}/delivery/): five-stage rollout with a dedicated account lead and 90-day hypercare
- [Commercial fit](${SITE_ORIGIN}/pricing/): how discovery becomes a venue-scoped commercial proposal
- [Book a discovery call](${SITE_ORIGIN}/book-a-demo/): a focused walkthrough configured around your venue
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

function validatePageContract(file, meta, body, family) {
  if (family === 'landing') {
    for (const key of ['layout', 'ctaType', 'ctaHref', 'ctaLabel']) {
      if (!meta[key]) throw new Error(`${file}: missing ${key} frontmatter required by the root landing renderer`);
    }
  }
  if (meta.section === 'solutions') {
    if (!/^## Workflow\s*(?:—|:|-)/m.test(body)) throw new Error(`${file}: solution pages require a "## Workflow — ..." module`);
    if (!/^## (?:Capabilities|Outcomes|Fit|Proof)\s*(?:—|:|-)/m.test(body)) {
      throw new Error(`${file}: solution pages require at least one Capabilities, Outcomes, Fit, or Proof module`);
    }
    if (!meta.canonicalFeature) throw new Error(`${file}: solution pages require canonicalFeature frontmatter`);
    if (splitMetaList(meta.related).length !== 3) throw new Error(`${file}: solution pages require exactly three pipe-delimited related routes`);
  }
  if (meta.section === 'compare') {
    if (!meta.verificationDate || !meta.verificationSource) throw new Error(`${file}: comparison pages require verificationDate and verificationSource`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.verificationDate)) throw new Error(`${file}: verificationDate must use YYYY-MM-DD`);
    if (splitMetaList(meta.related).length !== 3) throw new Error(`${file}: comparison pages require exactly three pipe-delimited related routes`);
  }
  if (family === 'blog' && splitMetaList(meta.related).length !== 3) {
    throw new Error(`${file}: blog posts require exactly three pipe-delimited related routes`);
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
    validatePageContract(file, meta, body, 'blog');
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
    validatePageContract(file, meta, body, 'page');
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
    validatePageContract(file, meta, body, 'landing');
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
    ['sell/index.html', '../', 'platform', false],
    ['grow/index.html', '../', 'platform', false],
    ['delivery/index.html', '../', 'company', false],
    ['book-a-demo/index.html', '../', null, true],
    ['404.html', '', null, true],
  ];
  let injected = 0;
  for (const [file, prefix, group, solid] of STATIC_PAGES) {
    const fp = join(ROOT, file);
    if (!existsSync(fp)) continue;
    const before = readFileSync(fp, 'utf8');
    let html = before.replace(/^[ \t]*<header class="nav-wrap[^"]*">[\s\S]*?<\/header>/m, () => navMarkup(prefix, group, solid));
    html = html.replace(/^[ \t]*<footer class="footer shell">[\s\S]*?<\/footer>/m, () => footerMarkup(prefix, pages));
    html = html.replace('<!--CONSENT-->', () => CONSENT_MARKUP);
    html = normalizeInternalLinks(html);
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
