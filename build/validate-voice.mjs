#!/usr/bin/env node
/**
 * validate-voice.mjs — the anti-AI-slop gate.
 *
 * Ported from jiaoluo-shuwu's validate-formatting.mjs and the vendored
 * humanizer ruleset (templates/_drafting/humanizer-SKILL.md, distilled
 * from Wikipedia's "Signs of AI writing"). Policy:
 *
 *   ERROR (blocks build + pre-push):
 *     - Any em-dash (—) in body prose or frontmatter text fields. Budget 0.
 *     - Double-hyphen used as a dash ( -- ).
 *     - Hard health claims on teas/tisanes (cure/treat/prevent/detox/
 *       clinically proven). These are liability and slop at once.
 *
 *   WARN (surfaced, does not block):
 *     - AI-tell vocabulary clusters (significance inflation, promo
 *       language, copula avoidance, vague attribution, signposting,
 *       chatbot closers, negative parallelism, false ranges).
 *     - Spaced en-dash used as a dash (ranges like 551–479 are fine).
 *     - Soft health claims (antioxidant, boosts immunity, calming) that
 *       need a named source or a rewrite as attribution.
 *     - Slow openings: first paragraph with no concrete fact in 3 sentences.
 *     - Complete non-hub pages without section anchors.
 *
 * See templates/_drafting/VOICE.md for the rules in prose form.
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CONTENT = path.join(ROOT, 'content');

let errors = 0;
let warns = 0;
function report(level, file, msg) {
  if (level === 'ERROR') errors += 1; else warns += 1;
  console[level === 'ERROR' ? 'error' : 'warn'](`${level} ${file}: ${msg}`);
}

/* ── AI-tell pattern groups (machine-checkable subset) ────── */

const AI_TELL_CHECKS = [
  {
    label: 'significance inflation',
    patterns: [
      /\btestament to\b/gi, /\btapestry\b/gi,
      /\b(?:cultural|culinary|spiritual|social|historical|agricultural) landscape\b/gi,
      /\bshowcas(?:es|ing|ed)?\b/gi,
      /\bboast(?:s|ing|ed)? (?:a|an|the|over|more)\b/gi,
      /\bvibrant\b/gi, /\bpivotal\b/gi,
      /\b(?:crucial|vital) role\b/gi,
      /\bdelv(?:e|es|ing|ed)\b/gi,
      /\bindelible\b/gi, /\bdeeply rooted\b/gi,
    ],
  },
  {
    label: 'promotional language',
    patterns: [
      /\bnestled\b/gi, /\brenowned\b/gi, /\bbreathtaking\b/gi,
      /\bstunning\b/gi, /\bmust-(?:visit|try)\b/gi,
      /\brich (?:cultural )?heritage\b/gi, /\bhidden gem\b/gi,
      /\btime-honored\b/gi, /\bexquisite\b/gi, /\bunparalleled\b/gi,
    ],
  },
  {
    label: 'copula avoidance',
    patterns: [/\bserves as\b/gi, /\bstands as\b/gi, /\bfunctions as\b/gi],
  },
  {
    label: 'vague attribution',
    patterns: [
      /\bexperts (?:say|argue|believe|agree)\b/gi,
      /\bscholars (?:say|argue|believe|agree)\b/gi,
      /\bmany (?:believe|argue|say)\b/gi,
      /\bsome (?:critics|observers) (?:say|argue|believe)\b/gi,
      /\bit is (?:widely )?believed that\b/gi,
      /\bconnoisseurs (?:agree|prize|consider)\b/gi,
    ],
  },
  {
    label: 'signposting',
    patterns: [
      /\bit(?:['’]s| is) worth noting\b/gi,
      /\bit is important to (?:note|remember)\b/gi,
      /\bworth mentioning\b/gi, /\bimportantly,/gi,
      /\blet(?:['’]s| us) (?:dive|explore|break)\b/gi,
    ],
  },
  {
    label: 'chatbot closer',
    patterns: [
      /\bI hope this helps\b/gi, /\blet me know if\b/gi,
      /\bin conclusion\b/gi, /\bexciting times\b/gi,
      /\bthe future looks bright\b/gi,
    ],
  },
  {
    label: 'negative parallelism',
    patterns: [
      /\b(?:is|are|was|were)?\s?not (?:just|only|merely|simply) [^.!?]{3,70}?[,;]? (?:but|it(?:['’]s| is))\b/gi,
    ],
  },
];

/* Hard health claims — ERROR on teas/tisanes. */
const HEALTH_HARD = [
  /\bcures?\b/gi, /\bclinically proven\b/gi, /\bdetox(?:ify|ifies|es|ing)?\b/gi,
  /\btreats? (?:anxiety|depression|insomnia|cancer|disease)\b/gi,
  /\bprevents? (?:cancer|disease|illness)\b/gi,
  /\bmedicinal(?:ly)? proven\b/gi,
];
/* Soft health claims — WARN: need a named source or rewrite as attribution. */
const HEALTH_SOFT = [
  /\banti-?inflammatory\b/gi, /\bantioxidants?\b/gi,
  /\bboosts? (?:immunity|the immune|metabolism)\b/gi,
  /\baids? digestion\b/gi, /\bcalms? (?:the )?(?:nerves|mind|body)\b/gi,
  /\bhealth benefits?\b/gi, /\bwellness\b/gi,
];

/* False ranges: decorative "from X to Y" sweeps (numeric ranges are fine). */
function findFalseRanges(text) {
  const hits = [];
  const sweepRe = /\b(?:everything|anything|ranging) from [^.!?]{3,60}? to [^.!?,;]{3,60}/gi;
  let m;
  while ((m = sweepRe.exec(text)) !== null) {
    if (!/\d/.test(m[0])) hits.push(m[0].trim().slice(0, 80));
  }
  return hits;
}

/* Concrete-fact test for the slow-opening check. */
function sentenceHasConcreteFact(sentence) {
  if (/\d/.test(sentence)) return true;
  if (/[一-鿿]/.test(sentence)) return true;
  if (/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i.test(sentence)) return true;
  const tokens = sentence.trim().split(/\s+/);
  if (tokens.slice(1).some((t) => /^[A-Z][a-z]/.test(t.replace(/^["'“‘(]+/, '')))) return true;
  return /^[A-Z][a-z]+[’']s$/.test((tokens[0] || '').replace(/^["'“‘(]+/, ''));
}

/* ── main loop ────────────────────────────────────────────── */

for (const cat of fs.readdirSync(CONTENT)) {
  if (cat.startsWith('_')) continue;
  const dir = path.join(CONTENT, cat);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const rel = `content/${cat}/${name}`;
    const raw = fs.readFileSync(path.join(dir, name), 'utf8');
    const { data: fm, content: body } = matter(raw);

    if (fm.status !== 'complete') continue; // stubs are intentionally thin

    // Prose = body with comments/tags stripped; plus surface frontmatter text.
    const bodyProse = body
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<[^>]*>/g, ' ');
    const surfaceText = [fm.title, fm.desc, fm.metaDesc]
      .filter((v) => typeof v === 'string').join('\n');
    const allProse = `${surfaceText}\n${bodyProse}`;

    // 1. Em-dash budget: zero, everywhere. The clearest AI tell.
    const emDashes = (allProse.match(/—/g) || []).length;
    if (emDashes > 0) {
      report('ERROR', rel, `${emDashes} em-dash${emDashes > 1 ? 'es' : ''} (—) in prose. Budget is 0: use comma, colon, parenthetical, or a sentence split.`);
    }
    if (/ -- /.test(allProse)) {
      report('ERROR', rel, 'double-hyphen dash ( -- ) in prose. Same rule as em-dash: rewrite.');
    }
    // Spaced en-dash used as a dash (numeric ranges like 551–479 are fine).
    if (/ – /.test(allProse)) {
      report('WARN', rel, 'spaced en-dash ( – ) used as a dash. Keep en-dashes for numeric ranges only.');
    }

    // 2. AI-tell vocabulary
    for (const check of AI_TELL_CHECKS) {
      const matched = new Map();
      for (const re of check.patterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(allProse)) !== null) {
          const key = m[0].toLowerCase().replace(/\s+/g, ' ').trim();
          matched.set(key, (matched.get(key) || 0) + 1);
        }
      }
      if (matched.size > 0) {
        const total = [...matched.values()].reduce((a, b) => a + b, 0);
        report('WARN', rel, `AI tell (${check.label}): ${total}× — "${[...matched.keys()].slice(0, 5).join('", "')}". Rewrite per VOICE.md.`);
      }
    }

    const ranges = findFalseRanges(allProse);
    if (ranges.length) {
      report('WARN', rel, `AI tell (false range): "${ranges.join('", "')}". Replace with the concrete list or claim.`);
    }

    // 3. Health claims (teas + tisanes only)
    if (cat === 'teas' || cat === 'tisanes') {
      for (const re of HEALTH_HARD) {
        re.lastIndex = 0;
        const m = re.exec(allProse);
        if (m) report('ERROR', rel, `hard health claim: "${m[0]}". Cut it, or attribute a specific tradition with a named source. This site does not make medical claims.`);
      }
      for (const re of HEALTH_SOFT) {
        re.lastIndex = 0;
        const m = re.exec(allProse);
        if (m) report('WARN', rel, `soft health claim: "${m[0]}". Name a specific source or rewrite as tradition/attribution.`);
      }
    }

    // 4. Slow opening: first paragraph should hit a concrete fact fast.
    // Hub pages are index intros, not scholar prose; exempt them.
    const firstP = fm.type === 'hub' ? null : (body.match(/<p[^>]*>([\s\S]*?)<\/p>/) || [])[1];
    if (firstP) {
      const text = firstP.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length > 3 && !sentences.slice(0, 3).some(sentenceHasConcreteFact)) {
        report('WARN', rel, 'slow opening: no concrete fact (name, date, number, native term) in the first 3 sentences. Lead with the interesting specific.');
      }
    }

    // 5. Structure: complete non-hub pages need section anchors for the TOC.
    if (cat !== 'hubs' && !body.includes('class="section-anchor"')) {
      report('WARN', rel, 'no section-anchor elements: sidebar TOC and scroll-spy will be empty.');
    }
  }
}

console.log(`validate-voice: ${errors} error${errors === 1 ? '' : 's'}, ${warns} warning${warns === 1 ? '' : 's'}`);
process.exit(errors > 0 ? 1 : 0);
