#!/usr/bin/env node
/**
 * check.mjs — post-build invariants. Run after `npm run build`.
 *
 *   - Every content file produced a page, and pages/ contains nothing else.
 *   - Every relative link and asset reference in generated pages resolves.
 *   - Required root files exist (PWA shell, robots, 404).
 *   - Review-status summary (complete/verified counts) for the console.
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const PAGES = path.join(ROOT, 'pages');
const CONTENT = path.join(ROOT, 'content');

let errors = 0;
function err(msg) { console.error(`ERROR ${msg}`); errors += 1; }

/* ── pages ↔ content parity ───────────────────────────────── */

const contentSet = new Set();
for (const cat of fs.readdirSync(CONTENT)) {
  if (cat.startsWith('_')) continue;
  const dir = path.join(CONTENT, cat);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const name of fs.readdirSync(dir)) {
    if (name.endsWith('.md')) contentSet.add(`${cat}/${name.replace(/\.md$/, '.html')}`);
  }
}

const pageSet = new Set();
function walkPages(dir, prefix = '') {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkPages(full, `${prefix}${name}/`);
    else if (name.endsWith('.html')) pageSet.add(`${prefix}${name}`);
  }
}
walkPages(PAGES);

for (const c of contentSet) if (!pageSet.has(c)) err(`content ${c} has no generated page — run npm run build`);
for (const p of pageSet) if (!contentSet.has(p)) err(`pages/${p} has no content source — stale file, rebuild`);

/* ── link resolution ──────────────────────────────────────── */

const LINK_RE = /(?:href|src)="([^"#]+?)(?:#[^"]*)?"/g;
for (const p of pageSet) {
  const full = path.join(PAGES, p);
  const html = fs.readFileSync(full, 'utf8');
  let m;
  while ((m = LINK_RE.exec(html)) !== null) {
    const target = m[1];
    if (/^(https?:|mailto:|data:|\/\/)/.test(target)) continue;
    const resolved = path.resolve(path.dirname(full), target);
    if (!fs.existsSync(resolved)) err(`pages/${p}: broken link → ${target}`);
  }
}

/* ── required shell files ─────────────────────────────────── */

for (const f of ['index.html', 'style.css', 'tokens.css', 'manifest.webmanifest', 'sw.js', '404.html', 'robots.txt', 'icons/favicon.svg', 'scripts/homepage.js', 'scripts/toc-scroll.js', 'scripts/theme.js']) {
  if (!fs.existsSync(path.join(ROOT, f))) err(`missing required root file: ${f}`);
}

/* ── review summary ───────────────────────────────────────── */

const entries = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'entries.json'), 'utf8'));
const complete = entries.filter((e) => e.status === 'complete');
const verified = complete.filter((e) => e.content_review === 'verified');
const pending = complete.filter((e) => e.content_review === 'pending');
console.log(`check: ${pageSet.size} pages · ${complete.length} complete (${verified.length} verified, ${pending.length} pending review) · ${entries.length - complete.length} stubs`);

process.exit(errors > 0 ? 1 : 0);
