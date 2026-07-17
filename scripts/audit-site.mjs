#!/usr/bin/env node
/* Static output audit: sitemap routes, page invariants, internal destinations,
   fragments, and local assets. No network or third-party packages required. */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://www.clubtechglobal.com';
const failures = [];
const checkedAssets = new Set();
const confidentialCommercialPatterns = [
  /no monthly fee/i,
  /4% online processing fee/i,
  /\$2,?000 one-time (?:set-?up|setup) fee/i,
];
const bannedPublicCopyPatterns = [
  /no[\s-]+pitch[\s-]+deck/i,
];

const fail = (route, message) => failures.push(`${route}: ${message}`);
const routeFile = (pathname) => {
  const clean = decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!clean) return join(ROOT, 'index.html');
  if (clean.endsWith('/')) return join(ROOT, clean, 'index.html');
  const direct = join(ROOT, clean);
  if (existsSync(direct)) return direct;
  return join(ROOT, clean, 'index.html');
};

const decodeHtml = (value) => String(value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp|rsquo|lsquo|rdquo|ldquo|mdash|ndash);/g, (_, entity) => ({
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–',
  }[entity]))
  .replace(/&[a-z]+;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const comparableText = (value) => decodeHtml(value)
  .toLowerCase()
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9%$]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const jsonNodes = (value) => {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(jsonNodes);
  return [value, ...Object.values(value).flatMap(jsonNodes)];
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

  for (const pattern of confidentialCommercialPatterns) {
    if (pattern.test(decodeHtml(html))) fail(pathname, `confidential commercial claim exposed: ${pattern}`);
  }
  for (const pattern of bannedPublicCopyPatterns) {
    if (pattern.test(decodeHtml(html))) fail(pathname, `banned public copy exposed: ${pattern}`);
  }

  const canonicalMatch = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  const canonical = canonicalMatch?.[1];
  const structuredScripts = [...html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  if (structuredScripts.length !== 1) fail(pathname, `expected exactly one JSON-LD block, found ${structuredScripts.length}`);
  const visibleText = comparableText(html.replace(/<script\b[\s\S]*?<\/script>/gi, ''));
  for (const [, source] of structuredScripts) {
    let structured;
    try { structured = JSON.parse(source); } catch (error) { fail(pathname, `invalid JSON-LD: ${error.message}`); continue; }
    const primaryNodes = Array.isArray(structured['@graph']) ? structured['@graph'] : [structured];
    const nodes = jsonNodes(structured);
    const pageNodes = primaryNodes.filter((node) => node['@type'] === 'WebPage');
    for (const node of pageNodes) {
      if (node.url && canonical && node.url !== canonical) fail(pathname, `WebPage.url ${node.url} does not match canonical ${canonical}`);
    }
    const breadcrumbs = nodes.filter((node) => node['@type'] === 'BreadcrumbList');
    for (const breadcrumb of breadcrumbs) {
      const positions = (breadcrumb.itemListElement || []).map((item) => item.position);
      if (!positions.length || positions.some((position, index) => position !== index + 1)) fail(pathname, 'BreadcrumbList positions must start at 1 and remain sequential');
    }
    const faqPages = nodes.filter((node) => node['@type'] === 'FAQPage');
    for (const faqPage of faqPages) {
      if (!Array.isArray(faqPage.mainEntity) || !faqPage.mainEntity.length) fail(pathname, 'FAQPage requires at least one mainEntity');
      for (const question of faqPage.mainEntity || []) {
        const answer = question.acceptedAnswer?.text;
        if (question['@type'] !== 'Question' || !question.name || !answer) {
          fail(pathname, 'FAQPage questions require name and acceptedAnswer.text');
          continue;
        }
        if (!visibleText.includes(comparableText(question.name))) fail(pathname, `FAQ question is not visible: ${question.name}`);
        if (!visibleText.includes(comparableText(answer))) fail(pathname, `FAQ answer is not visible for: ${question.name}`);
      }
    }
  }

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

for (const publicTextFile of ['llms.txt', 'agents.txt']) {
  const contents = readFileSync(join(ROOT, publicTextFile), 'utf8');
  for (const pattern of confidentialCommercialPatterns) {
    if (pattern.test(contents)) fail(`/${publicTextFile}`, `confidential commercial claim exposed: ${pattern}`);
  }
  for (const pattern of bannedPublicCopyPatterns) {
    if (pattern.test(contents)) fail(`/${publicTextFile}`, `banned public copy exposed: ${pattern}`);
  }
}

const collectCopySources = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isDirectory()) return collectCopySources(path);
  return /\.(?:md|js|txt|html)$/i.test(entry.name) ? [path] : [];
});

for (const sourceRoot of ['content', 'js']) {
  for (const file of collectCopySources(join(ROOT, sourceRoot))) {
    const contents = readFileSync(file, 'utf8');
    for (const pattern of bannedPublicCopyPatterns) {
      if (pattern.test(contents)) fail(`/${file.slice(ROOT.length + 1)}`, `banned public copy exposed: ${pattern}`);
    }
  }
}

if (failures.length) {
  console.error(`Site audit failed with ${failures.length} issue(s):`);
  failures.forEach((item) => console.error(`- ${item}`));
  process.exit(1);
}

console.log(`Site audit passed: ${routes.length} sitemap routes, ${checkedAssets.size} unique local assets, 3 legacy redirects.`);
