#!/usr/bin/env node
/**
 * build.mjs — generate pages/ and data/ from content/.
 *
 * Source of truth is content/<category>/<slug>.md (frontmatter + HTML body).
 * Never hand-edit pages/ — it is fully regenerated on every build.
 *
 * What this does:
 *   1. Parse every content file (gray-matter).
 *   2. Generate the hero from frontmatter (cup atom for teas/tisanes,
 *      topic hero for craft/practice/regions, hub hero for hubs).
 *   3. Auto-generate the sidebar TOC by scanning section anchors.
 *   4. Replace body markers: <!--STEEP_CURVE-->, <!--TERROIR_MAP-->,
 *      <!--HUB_MEMBERS-->.
 *   5. Append the sources block from content_sources.
 *   6. Wrap in templates/_layout.html and write pages/<category>/<slug>.html.
 *   7. Emit data/entries.json and data/search-index.json.
 *   8. Emit sitemap.xml when site.url is configured in category-meta.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { cupStyle } from './lib/liquor.mjs';
import { renderSteepCurve } from './lib/steep-curve.mjs';
import { renderTerroirMap, renderWorldMap } from './lib/terroir-map.mjs';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CONTENT = path.join(ROOT, 'content');
const PAGES = path.join(ROOT, 'pages');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'templates', '_layout.html'), 'utf8');
const META = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'category-meta.json'), 'utf8'));

const REL = '../../'; // all pages live two levels deep

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── content walk ─────────────────────────────────────────── */

function walkContent() {
  const files = [];
  for (const cat of fs.readdirSync(CONTENT)) {
    if (cat.startsWith('_')) continue;
    const dir = path.join(CONTENT, cat);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      files.push({ category: cat, slug: name.replace(/\.md$/, ''), full: path.join(dir, name) });
    }
  }
  return files.sort((a, b) => `${a.category}/${a.slug}`.localeCompare(`${b.category}/${b.slug}`));
}

/* ── hero rendering ───────────────────────────────────────── */

function teaTypeChip(fm) {
  const t = META.teaTypes[fm.tea_type];
  if (!t) return '';
  return `<span class="chip" data-category="${fm.tea_type === 'tisane' ? 'tisanes' : 'teas'}"><span class="native">${t.native}</span> ${t.label}</span>`;
}

function renderHero(fm, entriesBySlug) {
  const native = fm.native ? ` <span class="native">${esc(fm.native)}</span>` : '';
  const reading = fm.reading ? ` <span class="he-native">${esc(fm.reading)}</span>` : '';

  if (fm.type === 'tea' || fm.type === 'tisane') {
    const chips = [teaTypeChip(fm)];
    if (fm.origin) {
      const origin = entriesBySlug.get(`regions/${fm.origin}`);
      chips.push(origin
        ? `<a class="chip" data-category="regions" href="${REL}pages/regions/${fm.origin}.html">${esc(origin.title)}</a>`
        : `<span class="chip" data-category="regions">${esc(fm.origin)}</span>`);
    }
    if (fm.cultivar) chips.push(`<span class="chip">${esc(fm.cultivar)}</span>`);
    if (fm.elevation_m) chips.push(`<span class="chip">${esc(fm.elevation_m)} m</span>`);
    return `    <header class="tea-hero">
      <div class="cup" style="${cupStyle(fm.liquor || '#cf9434')}" role="img" aria-label="Liquor color of ${esc(fm.title)}"></div>
      <div class="tea-hero-body">
        <span class="hero-eyebrow">${esc(META.categories[fm.category]?.label || fm.category)}${reading}</span>
        <h1 class="tea-hero-title">${esc(fm.title)}${native}</h1>
        <p class="tea-hero-desc">${esc(fm.desc)}</p>
        <div class="hero-chips">${chips.filter(Boolean).join('\n          ')}</div>
      </div>
    </header>`;
  }

  if (fm.type === 'hub') {
    return `    <header class="hub-hero">
      <span class="hero-eyebrow">${esc(META.site.name)} · index</span>
      <h1 class="hub-hero-title">${esc(fm.title)}</h1>
      <p class="hub-hero-desc">${esc(fm.desc)}</p>
    </header>`;
  }

  const eyebrow = fm.type === 'region'
    ? `Origin · ${esc(fm.country || '')}`
    : esc(META.categories[fm.category]?.label || fm.category);
  return `    <header class="topic-hero">
      <span class="hero-eyebrow">${eyebrow}${reading}</span>
      <h1 class="topic-hero-title">${esc(fm.title)}${native}</h1>
      <p class="topic-hero-desc">${esc(fm.desc)}</p>
    </header>`;
}

/* ── sidebar / TOC ────────────────────────────────────────── */

function extractToc(body) {
  const items = [];
  const re = /<span class="section-anchor" id="([^"]+)"><\/span>\s*<div class="(?:section-head|hub-section-head)">[\s\S]{0,300}?<span class="(?:sh-title|hub-section-title)">([\s\S]*?)<\/span>/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    items.push({ id: m[1], title: m[2].replace(/<[^>]*>/g, '').trim() });
  }
  return items;
}

function renderSidebar(fm, toc) {
  const native = fm.native ? `<span class="toc-sub"><span class="native">${esc(fm.native)}</span>${fm.reading ? ` · ${esc(fm.reading)}` : ''}</span>` : (fm.reading ? `<span class="toc-sub">${esc(fm.reading)}</span>` : '');
  const list = toc.length
    ? `<span class="toc-label">Contents</span>
    <ul class="toc-list">
${toc.map((t) => `      <li><a href="#${t.id}">${esc(t.title)}</a></li>`).join('\n')}
    </ul>`
    : `<span class="toc-label">${fm.status === 'stub' ? 'Coming soon' : 'Entry'}</span>`;
  return `    <span class="toc-title">${esc(fm.title)}</span>
    ${native}
    <div class="toc-divider"></div>
    ${list}`;
}

/* ── hub member rendering ─────────────────────────────────── */

function entryRow(e) {
  const marker = e.liquor
    ? `<span class="cup" style="${cupStyle(e.liquor)}" aria-hidden="true"></span>`
    : `<span class="er-dot" style="--dot-c:var(--cat-${e.category})" aria-hidden="true"></span>`;
  const native = e.native ? ` <span class="native">${esc(e.native)}</span>` : '';
  const meta = e.status === 'stub' ? 'soon' : (e.tea_type ? esc(META.teaTypes[e.tea_type]?.label || '') : '');
  return `<a class="entry-row" href="${REL}${e.path}">
        ${marker}
        <span class="er-body">
          <span class="er-title">${esc(e.title)}${native}</span>
          <span class="er-desc">${esc(e.desc)}</span>
        </span>
        <span class="er-meta">${meta}</span>
      </a>`;
}

function renderHubMembers(hubKey, entries) {
  const hub = META.hubs[hubKey];
  if (!hub) return '';
  const sections = [];
  for (const cat of hub.members) {
    const members = entries.filter((e) => e.category === cat);
    if (members.length === 0) continue;
    const catMeta = META.categories[cat];
    sections.push(`<section class="hub-section">
      <span class="section-anchor" id="${cat}"></span>
      <div class="hub-section-head">
        <span class="hub-section-title">${esc(catMeta.label)}</span>
        <span class="hub-count">${members.length} ${members.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      ${members.map(entryRow).join('\n      ')}
    </section>`);
  }
  return sections.join('\n');
}

/* ── sources block ────────────────────────────────────────── */

function renderSources(fm) {
  if (!Array.isArray(fm.content_sources) || fm.content_sources.length === 0) return '';
  return `    <div class="sources">
      <span class="sources-label">Sources</span>
      <ul>
${fm.content_sources.map((s) => `        <li>${esc(s)}</li>`).join('\n')}
      </ul>
    </div>`;
}

/* ── main build ───────────────────────────────────────────── */

const files = walkContent();
const parsed = files.map((f) => {
  const raw = fs.readFileSync(f.full, 'utf8');
  const { data: fm, content: body } = matter(raw);
  return { ...f, fm, body };
});

// entries manifest (used by hubs, homepage, search)
const entries = parsed
  .filter((p) => p.fm.category !== 'hubs')
  .map((p) => ({
    path: `pages/${p.category}/${p.slug}.html`,
    slug: `${p.category}/${p.slug}`,
    type: p.fm.type,
    category: p.category,
    title: p.fm.title,
    native: p.fm.native || null,
    reading: p.fm.reading || null,
    desc: p.fm.desc || '',
    tags: p.fm.tags || [],
    tea_type: p.fm.tea_type || null,
    liquor: p.fm.liquor || null,
    origin: p.fm.origin || null,
    country: p.fm.country || null,
    status: p.fm.status,
    content_review: p.fm.content_review || null,
    coords: p.fm.map?.center || null,
    updated: p.fm.updated ? String(p.fm.updated).slice(0, 10) : null,
  }));
const entriesBySlug = new Map(entries.map((e) => [e.slug, e]));

// wipe + regenerate pages/
fs.rmSync(PAGES, { recursive: true, force: true });

let pageCount = 0;
for (const p of parsed) {
  const { fm } = p;
  let body = p.body.trim();

  // marker injections
  if (body.includes('<!--STEEP_CURVE-->')) {
    body = body.replace('<!--STEEP_CURVE-->', renderSteepCurve(fm.steeps, fm.liquor));
  }
  if (body.includes('<!--TERROIR_MAP-->')) {
    body = body.replace('<!--TERROIR_MAP-->', renderTerroirMap(fm.map, fm.title));
  }
  if (body.includes('<!--HUB_MEMBERS-->')) {
    body = body.replace('<!--HUB_MEMBERS-->', renderHubMembers(fm.hub_key, entries));
  }
  if (body.includes('<!--WORLD_MAP-->')) {
    body = body.replace('<!--WORLD_MAP-->', renderWorldMap(entries.filter((e) => e.category === 'regions')));
  }

  const toc = extractToc(body);
  const hubKey = fm.type === 'hub' ? fm.hub_key : META.categories[fm.category]?.hub;
  const metaComment = JSON.stringify({
    type: fm.type, category: fm.category, title: fm.title,
    status: fm.status, content_review: fm.content_review || null,
  });

  let html = TEMPLATE
    .replaceAll('{{META_COMMENT}}', metaComment)
    .replaceAll('{{TITLE}}', esc(fm.title))
    .replaceAll('{{SITE_NAME}}', esc(META.site.name))
    .replaceAll('{{META_DESC}}', esc(fm.metaDesc || fm.desc || ''))
    .replaceAll('{{THEME_COLOR}}', META.site.themeColorLight)
    .replaceAll('{{REL}}', REL)
    .replaceAll('{{HERO}}', renderHero(fm, entriesBySlug))
    .replaceAll('{{SIDEBAR}}', renderSidebar(fm, toc))
    .replaceAll('{{BODY}}', body)
    .replaceAll('{{SOURCES}}', renderSources(fm))
    .replaceAll('{{CATEGORY_LABEL}}', esc(META.categories[fm.category]?.label || fm.category))
    .replaceAll('{{UPDATED}}', fm.updated ? ` · updated ${String(fm.updated).slice(0, 10)}` : '');

  for (const key of Object.keys(META.hubs)) {
    html = html.replaceAll(`{{NAV_CUR_${key}}}`, key === hubKey ? ' aria-current="page"' : '');
  }

  const outDir = path.join(PAGES, p.category);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, `${p.slug}.html`), html);
  pageCount += 1;
}

/* ── data emissions ───────────────────────────────────────── */

fs.writeFileSync(path.join(ROOT, 'data', 'entries.json'), JSON.stringify(entries, null, 2));

// search index: token → entry indices (prefix search happens client-side)
function tokenize(text) {
  const out = new Set();
  for (const t of String(text).toLowerCase().split(/[^a-z0-9À-ɏ]+/)) {
    if (t.length >= 2) out.add(t);
  }
  for (const ch of String(text)) {
    if (/[一-鿿]/.test(ch)) out.add(ch);
  }
  return out;
}

const tokens = {};
parsed.filter((p) => p.fm.category !== 'hubs').forEach((p) => {
  const idx = entries.findIndex((e) => e.slug === `${p.category}/${p.slug}`);
  const bodyText = p.body.replace(/<[^>]*>/g, ' ');
  const bag = tokenize([p.fm.title, p.fm.native, p.fm.reading, p.fm.desc, (p.fm.tags || []).join(' '), bodyText].join(' '));
  for (const t of bag) {
    (tokens[t] ??= []).push(idx);
  }
});
fs.writeFileSync(path.join(ROOT, 'data', 'search-index.json'), JSON.stringify({ tokens }));

// sitemap (only when a canonical URL is configured)
if (META.site.url) {
  const base = META.site.url.replace(/\/$/, '');
  const urls = ['', ...parsed.map((p) => `pages/${p.category}/${p.slug}.html`)]
    .map((u) => `  <url><loc>${base}/${u}</loc></url>`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

console.log(`build: ${pageCount} pages, ${entries.length} entries, ${Object.keys(tokens).length} search tokens`);
