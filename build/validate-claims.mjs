#!/usr/bin/env node
/**
 * validate-claims.mjs — factual discipline for a site that cannot
 * tolerate hallucinations.
 *
 * Three passes over content/ (complete pages only):
 *
 *   1. Sources gate. Every complete page carries content_review
 *      (schema-enforced). Pages with content_review: verified must cite
 *      sources whose labels match data/_reference/known-sources.json —
 *      unknown labels WARN. Categories listed in min_sources_verified
 *      (regions, tisanes) need two or more sources to be verified: ERROR.
 *
 *   2. Canonical claims. When prose mentions a registry name near a year
 *      (or year range), the cited value must match
 *      data/_reference/canonical-claims.json. ERROR on mismatch, WARN
 *      when the page softens the claim with "c." or "around".
 *
 *   3. Cross-page consistency. Any capitalized name cited with a year
 *      range (e.g. "Lu Yu (733–804)") must carry the same range on every
 *      page that mentions it. Pure self-consistency: no registry needed.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CONTENT = path.join(ROOT, 'content');
const REF = path.join(ROOT, 'data', '_reference');

const knownSources = JSON.parse(fs.readFileSync(path.join(REF, 'known-sources.json'), 'utf8'));
const canonical = JSON.parse(fs.readFileSync(path.join(REF, 'canonical-claims.json'), 'utf8'));

let errors = 0;
let warns = 0;
function report(level, file, msg) {
  if (level === 'ERROR') errors += 1; else warns += 1;
  console[level === 'ERROR' ? 'error' : 'warn'](`${level} ${file}: ${msg}`);
}

function textOf(body) {
  return body.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

const pages = [];
for (const cat of fs.readdirSync(CONTENT)) {
  if (cat.startsWith('_')) continue;
  const dir = path.join(CONTENT, cat);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const rel = `content/${cat}/${name}`;
    const { data: fm, content: body } = matter(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (fm.status !== 'complete') continue;
    pages.push({ rel, cat, fm, text: textOf(body) });
  }
}

/* ── 1. sources gate ──────────────────────────────────────── */

const prefixes = knownSources.sources.map((s) => s.prefix);
for (const p of pages) {
  const sources = p.fm.content_sources || [];
  if (p.fm.content_review === 'verified') {
    const min = knownSources.min_sources_verified[p.cat] ?? knownSources.min_sources_verified.default;
    if (sources.length < min) {
      report('ERROR', p.rel, `content_review: verified in '${p.cat}' needs ≥${min} sources (has ${sources.length}).`);
    }
    for (const s of sources) {
      if (!prefixes.some((pre) => s.startsWith(pre))) {
        report('WARN', p.rel, `source "${s}" not in known-sources.json. Add it to the registry deliberately, or cite a registered source.`);
      }
    }
  }
  if (p.fm.content_review === 'unverified') {
    report('WARN', p.rel, 'content_review: unverified on a complete page. Verify or downgrade to stub before shipping this page prominently.');
  }
}

/* ── 2. canonical claims ──────────────────────────────────── */

for (const p of pages) {
  for (const claim of canonical.claims) {
    if (!p.text.includes(claim.name)) continue;
    // examine a window around each mention
    let idx = 0;
    while ((idx = p.text.indexOf(claim.name, idx)) !== -1) {
      const window = p.text.slice(Math.max(0, idx - 60), idx + claim.name.length + 90);
      const soft = /\b(?:c\.|circa|around|roughly|about)\s*\d/.test(window);
      if (claim.kind === 'years') {
        const m = window.match(/(\d{3,4})\s*[–-]\s*(\d{3,4})/);
        if (m) {
          const [a, b] = [Number(m[1]), Number(m[2])];
          if (a !== claim.value[0] || b !== claim.value[1]) {
            report(soft ? 'WARN' : 'ERROR', p.rel,
              `"${claim.name}" cited as ${a}–${b}; registry says ${claim.value[0]}–${claim.value[1]} (${claim.source}).`);
          }
        }
      } else if (claim.kind === 'circa_year' || claim.kind === 'unesco_year') {
        // unesco_year only fires in windows that talk about inscription,
        // so elevations and other numbers near a region name don't trip it.
        if (claim.kind === 'unesco_year' && !/UNESCO|World Heritage|inscri/i.test(window)) { idx += claim.name.length; continue; }
        const m = window.match(/\b(1\d{3}|2\d{3}|[5-9]\d{2})\b/);
        if (m) {
          const y = Number(m[1]);
          const tol = claim.tolerance ?? 0;
          if (Math.abs(y - claim.value) > tol) {
            report(soft ? 'WARN' : 'ERROR', p.rel,
              `"${claim.name}" cited near year ${y}; registry says ${claim.value}±${tol} (${claim.source}).`);
          }
        }
      } else if (claim.kind === 'cultivar_number') {
        const m = window.match(/(?:TTES|TRES)\s*No\.?\s*(\d+)/i);
        if (m && `TTES No. ${m[1]}` !== claim.value) {
          report('ERROR', p.rel,
            `"${claim.name}" cited as station cultivar No. ${m[1]}; registry says ${claim.value} (${claim.source}).`);
        }
      }
      idx += claim.name.length;
    }
  }
}

/* ── 3. cross-page year-range consistency ─────────────────── */

const ranges = new Map(); // name → Map(range → [files])
for (const p of pages) {
  const re = /([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s*\(?\s*(\d{3,4})\s*[–-]\s*(\d{3,4})/g;
  let m;
  while ((m = re.exec(p.text)) !== null) {
    const name = m[1];
    // skip pure elevation/measurement contexts
    const tail = p.text.slice(m.index, m.index + m[0].length + 20);
    if (/\bm\b|metre|meter|°C/.test(tail)) continue;
    const range = `${m[2]}–${m[3]}`;
    if (!ranges.has(name)) ranges.set(name, new Map());
    const byRange = ranges.get(name);
    if (!byRange.has(range)) byRange.set(range, []);
    byRange.get(range).push(p.rel);
  }
}
for (const [name, byRange] of ranges) {
  if (byRange.size > 1) {
    const detail = [...byRange.entries()].map(([r, fs2]) => `${r} (${fs2.join(', ')})`).join(' vs ');
    report('ERROR', 'cross-page', `"${name}" cited with conflicting ranges: ${detail}. Fix the pages, then add the fact to canonical-claims.json.`);
  }
}

console.log(`validate-claims: ${pages.length} complete pages, ${errors} error${errors === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'}`);
process.exit(errors > 0 ? 1 : 0);
