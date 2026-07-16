#!/usr/bin/env node
/* ──────────────────────────────────────────────────────────────────────
   Clubtech branded landing — product-shot renderer.

   Captures the interactive demo apps (js/demo.js, js/operator.js, js/intel.js
   and the newer feature demos) as deterministic product screenshots, so the
   inner pages can show the REAL product UI instead of stock imagery.

   How it works: for each demo state in MANIFEST we generate a minimal capture
   page under scripts/shots/ (kept inside the repo so the demos' relative asset
   paths resolve), open it in system Chrome via playwright-core, wait for fonts
   + images, then screenshot the mount element clipped to itself at 2x DPR.
   PNGs are converted to .webp with cwebp when available.

   Output → assets/product/<demo>-<state>.webp  (committed; referenced by pages)

   Usage:  node scripts/shoot-demos.mjs [demoName ...]
           KEEP_PNG=1 node scripts/shoot-demos.mjs operator
   No network. Deterministic: same demos → identical shots.
   ────────────────────────────────────────────────────────────────────── */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS_DIR = path.join(ROOT, 'scripts', 'shots');
const OUT_DIR = path.join(ROOT, 'assets', 'product');

/* playwright-core isn't a dependency of this zero-dep site; resolve it from a
   local install if present, else from the sibling instagram-grid repo. */
function loadChromium() {
  const candidates = [
    'playwright-core',
    '/Users/brad/Documents/CTG/clubtech-instagram-grid/node_modules/playwright-core',
  ];
  for (const c of candidates) {
    try { return require(c).chromium; } catch { /* try next */ }
  }
  throw new Error('playwright-core not found. Install it here, or keep the clubtech-instagram-grid sibling repo (which has it).');
}

function cwebpAvailable() {
  try { execFileSync('cwebp', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

/* Serve the repo over http so @font-face (Albert Sans) loads — file:// blocks
   cross-origin fonts, which would fall the shots back to a system font. */
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.ico': 'image/x-icon' };
function startServer(root) {
  const server = http.createServer((req, res) => {
    try {
      let fp = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      if (fp.endsWith(path.sep)) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(root)) { res.writeHead(403); return res.end(); }
      const data = fs.readFileSync(fp);
      res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
      res.end(data);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

/* ── Capture-page template ─────────────────────────────────────────────
   A full-viewport wrapper of a fixed width holds one demo mount in a target
   state. Badge attributes are intentionally omitted so shots are clean. */
function capturePage({ css, js, mount, width, frameBg }) {
  const links = ['css/styles.css', ...css].map((h) => `<link rel="stylesheet" href="../../${h}">`).join('\n');
  const scripts = js.map((s) => `<script src="../../${s}"></script>`).join('\n');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${links}
<style>
  html,body{margin:0;background:${frameBg || '#020617'}}
  #shot-frame{width:${width}px;margin:0 auto;padding:0}
</style>
</head><body>
<div id="shot-frame">${mount}</div>
${scripts}
</body></html>`;
}

/* ── Manifest ──────────────────────────────────────────────────────────
   sel = the element clipped in the screenshot (the demo mount itself).
   Add new-demo entries here as they land (doorlist, events, pricing,
   reviews, support). */
const MANIFEST = [
  {
    name: 'booking', css: ['css/demo.css'], js: ['js/demo.js'], sel: '.ckd', width: 1180,
    states: [
      { id: 'map', mount: `<div class="ckd" data-demo="map" role="application" style="height:720px;background-image:url(../../assets/demo/venue-real.webp);background-size:cover;background-position:center"></div>` },
    ],
  },
  {
    name: 'operator', css: ['css/operator.css'], js: ['js/operator.js'], sel: '.cko', width: 1180,
    states: [
      { id: 'floor',        mount: `<div class="cko" data-opdemo="map" role="application" style="aspect-ratio:auto;height:660px"></div>` },
      { id: 'reservations', mount: `<div class="cko" data-opdemo="bookings" role="application" style="aspect-ratio:auto;height:660px"></div>` },
    ],
  },
  {
    name: 'intel', css: ['css/intel.css'], js: ['js/intel.js'], sel: '.cki', width: 1180,
    states: [
      { id: 'reports',     mount: `<div class="cki" data-inteldemo="product" role="application" style="aspect-ratio:auto;height:660px"></div>` },
      { id: 'attribution', mount: `<div class="cki" data-inteldemo="ads" role="application" style="aspect-ratio:auto;height:660px"></div>` },
    ],
  },
  // ── new feature demos ──
  {
    name: 'pricing', css: ['css/pricing.css'], js: ['js/pricing.js'], sel: '.ckp', width: 1180,
    states: [
      { id: 'calendar', mount: `<div class="ckp" data-pricedemo="calendar" role="application" style="aspect-ratio:auto;height:680px"></div>` },
      { id: 'rules',    mount: `<div class="ckp" data-pricedemo="rules" role="application" style="aspect-ratio:auto;height:680px"></div>` },
    ],
  },
  {
    name: 'reviews', css: ['css/reviews.css'], js: ['js/reviews.js'], sel: '.ckr', width: 1180,
    states: [
      { id: 'dashboard', mount: `<div class="ckr" data-reviewdemo="dashboard" role="application" style="aspect-ratio:auto;height:680px"></div>` },
      { id: 'detail',    mount: `<div class="ckr" data-reviewdemo="detail" role="application" style="aspect-ratio:auto;height:680px"></div>` },
    ],
  },
  {
    name: 'doorlist', css: ['css/doorlist.css'], js: ['js/doorlist.js'], sel: '.ckdl', width: 940,
    states: [
      { id: 'list',    mount: `<div class="ckdl" data-doordemo="list" role="application" style="aspect-ratio:auto;height:660px"></div>` },
      { id: 'soldout', mount: `<div class="ckdl" data-doordemo="soldout" role="application" style="aspect-ratio:auto;height:660px"></div>` },
    ],
  },
  {
    name: 'events', css: ['css/events.css'], js: ['js/events.js'], sel: '.cke', width: 640,
    states: [
      { id: 'tickets',  mount: `<div class="cke" data-eventdemo="tickets" role="application" style="aspect-ratio:auto;height:660px"></div>` },
      { id: 'checkout', mount: `<div class="cke" data-eventdemo="checkout" role="application" style="aspect-ratio:auto;height:660px"></div>` },
    ],
  },
  {
    name: 'support', css: ['css/support.css'], js: ['js/support.js'], sel: '.cks', width: 1120,
    states: [
      { id: 'console', mount: `<div class="cks" data-supportdemo="tickets" role="application" style="aspect-ratio:auto;height:660px"></div>` },
      { id: 'thread',  mount: `<div class="cks" data-supportdemo="thread" role="application" style="aspect-ratio:auto;height:660px"></div>` },
    ],
  },
];

async function main() {
  const only = process.argv.slice(2);
  const demos = only.length ? MANIFEST.filter((d) => only.includes(d.name)) : MANIFEST;
  if (!demos.length) { console.error('No matching demos in MANIFEST:', only.join(', ')); process.exit(1); }

  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const chromium = loadChromium();
  const webp = cwebpAvailable();
  if (!webp) console.warn('cwebp not found — leaving PNGs (install webp via `brew install webp` for .webp output).');

  const { server, port } = await startServer(ROOT);
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1600 }, deviceScaleFactor: 2 });

  for (const demo of demos) {
    for (const st of demo.states) {
      const html = capturePage({ css: demo.css, js: demo.js, mount: st.mount, width: st.width || demo.width, frameBg: st.frameBg });
      const pageFile = path.join(SHOTS_DIR, `${demo.name}-${st.id}.html`);
      fs.writeFileSync(pageFile, html);

      await page.goto(`http://127.0.0.1:${port}/${path.relative(ROOT, pageFile).split(path.sep).join('/')}`);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.evaluate(() => Promise.all([...document.images].map((img) => (img.decode ? img.decode().catch(() => {}) : null))));
      await page.waitForTimeout(900); // let the demo's own render + any transitions settle

      const sel = st.sel || demo.sel;
      const el = page.locator(sel).first();
      if (!(await el.count())) { console.warn(`  ! ${demo.name}-${st.id}: selector ${sel} not found — skipped`); continue; }
      const pngPath = path.join(OUT_DIR, `${demo.name}-${st.id}.png`);
      await el.screenshot({ path: pngPath });

      if (webp) {
        const webpPath = path.join(OUT_DIR, `${demo.name}-${st.id}.webp`);
        execFileSync('cwebp', ['-quiet', '-q', '90', pngPath, '-o', webpPath]);
        if (!process.env.KEEP_PNG) fs.rmSync(pngPath);
        console.log('wrote', path.relative(ROOT, webpPath));
      } else {
        console.log('wrote', path.relative(ROOT, pngPath));
      }
    }
  }

  await browser.close();
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
