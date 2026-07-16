#!/usr/bin/env node
/* Static output audit: sitemap routes, page invariants, internal destinations,
   fragments, and local assets. No network or third-party packages required. */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.clubtechglobal.com';
const failures = [];
const checkedAssets = new Set();

const fail = (route, message) => failures.push(`${route}: ${message}`);
const routeFile = (pathname) => {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!clean) return join(ROOT, 'index.html');
  if (clean.endsWith('/')) return join(ROOT, clean, 'index.html');
  const direct = join(ROOT, clean);
  if (existsSync(direct)) return direct;
  return join(ROOT, clean, 'index.html');
};

const sitemap = readFileSync(join(ROOT, 'sitemap.xml'), 'utf8');
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);

for (const pathname of routes) {
  const file = routeFile(pathname);
  if (!existsSync(file)) {
    fail(pathname, `missing route output ${file}`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const count = (pattern) => (html.match(pattern) || []).length;
  if (count(/<main\b/gi) !== 1) fail(pathname, 'expected exactly one <main>');
  if (count(/<h1\b/gi) !== 1) fail(pathname, 'expected exactly one <h1>');
  if (count(/<title>[^<]+<\/title>/gi) !== 1) fail(pathname, 'missing or duplicate <title>');
  if (count(/<meta\s+name="description"\s+content="[^"]+"/gi) !== 1) fail(pathname, 'missing or duplicate meta description');
  if (count(/<link\s+rel="canonical"\s+href="[^"]+"/gi) !== 1) fail(pathname, 'missing or duplicate canonical');

  const ids = new Set([...html.matchAll(/\s(?:id|name)="([^"]+)"/gi)].map((match) => match[1]));
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/gi)].map((match) => match[1]);
  for (const ref of refs) {
    if (!ref || /^(?:mailto:|tel:|javascript:|data:)/i.test(ref)) continue;
    let url;
    try { url = new URL(ref, `${ORIGIN}${pathname}`); } catch { fail(pathname, `invalid URL ${ref}`); continue; }
    if (url.origin !== ORIGIN) continue;
    if (/\/(?:platform|contact|revenue)\.html(?:$|[?#])/.test(url.href) || /^\/(?:booking|operations|intelligence)\/?$/.test(url.pathname)) {
      fail(pathname, `retired internal destination ${ref}`);
    }
    const target = routeFile(url.pathname);
    if (!existsSync(target)) {
      fail(pathname, `broken internal destination ${ref}`);
      continue;
    }
    if (/\.(?:css|js|png|jpe?g|webp|svg|woff2?|mp4|ico)$/i.test(url.pathname)) {
      checkedAssets.add(url.pathname);
      continue;
    }
    if (url.hash) {
      const targetHtml = target === file ? html : readFileSync(target, 'utf8');
      const targetIds = target === file ? ids : new Set([...targetHtml.matchAll(/\s(?:id|name)="([^"]+)"/gi)].map((match) => match[1]));
      const fragment = decodeURIComponent(url.hash.slice(1));
      if (fragment && !targetIds.has(fragment)) fail(pathname, `missing fragment ${ref}`);
    }
  }
}

const htaccess = existsSync(join(ROOT, '.htaccess')) ? readFileSync(join(ROOT, '.htaccess'), 'utf8') : '';
for (const legacy of ['booking', 'operations', 'intelligence']) {
  if (!new RegExp(`Redirect(?:Match)?\\s+30[18][^\\n]*\\^?/${legacy}`).test(htaccess)) {
    fail('/.htaccess', `missing permanent redirect for /${legacy}/`);
  }
}

if (failures.length) {
  console.error(`Site audit failed with ${failures.length} issue(s):`);
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Site audit passed: ${routes.length} sitemap routes, ${checkedAssets.size} unique local assets, 3 legacy redirects.`);
