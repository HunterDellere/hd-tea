#!/usr/bin/env node
/**
 * validate.mjs — schema-check every content file before building.
 *
 * ERRORs exit 1 and block the build (and the pre-push hook).
 * Beyond the JSON schema, this adds checks a schema cannot express:
 *   - category folder must match frontmatter `category`
 *   - `desc` stays under 30 words (it renders on cards and hub rows)
 *   - filenames are ASCII kebab-case
 *   - tea/tisane types agree (`type: tisane` ⇒ `tea_type: tisane`)
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { Ajv } from 'ajv';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const CONTENT = path.join(ROOT, 'content');
const schema = JSON.parse(fs.readFileSync(path.join(CONTENT, '_schema', 'entry.schema.json'), 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const check = ajv.compile(schema);

let errors = 0;
let files = 0;

function err(file, msg) {
  console.error(`ERROR ${file}: ${msg}`);
  errors += 1;
}

for (const cat of fs.readdirSync(CONTENT)) {
  if (cat.startsWith('_')) continue;
  const dir = path.join(CONTENT, cat);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    files += 1;
    const rel = `content/${cat}/${name}`;

    if (!/^[a-z0-9-]+\.md$/.test(name)) {
      err(rel, 'filename must be ASCII kebab-case');
    }

    const raw = fs.readFileSync(path.join(dir, name), 'utf8');
    let fm;
    try {
      fm = matter(raw).data;
    } catch (e) {
      err(rel, `frontmatter parse failed: ${e.message}`);
      continue;
    }

    if (!check(fm)) {
      for (const e of check.errors) {
        err(rel, `${e.instancePath || '(root)'} ${e.message}`);
      }
    }

    if (fm.category && fm.category !== cat) {
      err(rel, `category '${fm.category}' does not match folder '${cat}'`);
    }
    if (typeof fm.desc === 'string' && fm.desc.split(/\s+/).length > 30) {
      err(rel, `desc is ${fm.desc.split(/\s+/).length} words; keep under 30 (renders on cards)`);
    }
    if (fm.type === 'tisane' && fm.tea_type && fm.tea_type !== 'tisane') {
      err(rel, `type: tisane requires tea_type: tisane (got '${fm.tea_type}')`);
    }
    if (fm.type === 'tea' && fm.tea_type === 'tisane') {
      err(rel, `type: tea cannot have tea_type: tisane`);
    }
  }
}

console.log(`validate: ${files} files, ${errors} error${errors === 1 ? '' : 's'}`);
process.exit(errors > 0 ? 1 : 0);
