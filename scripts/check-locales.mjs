#!/usr/bin/env node
/* Verifies all locale files have exactly the same keys as en.json */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const en = JSON.parse(readFileSync(join(dir, 'en.json'), 'utf8'));
const enKeys = Object.keys(en).sort();

let ok = true;
for (const f of files) {
  if (f === 'en.json') continue;
  const data = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const keys = Object.keys(data).sort();
  const missing = enKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !enKeys.includes(k));
  const empty = enKeys.filter((k) => !String(data[k] ?? '').trim());
  if (missing.length || extra.length || empty.length) {
    ok = false;
    console.error(`✗ ${f}`);
    if (missing.length) console.error('  missing:', missing.join(', '));
    if (extra.length) console.error('  extra:', extra.join(', '));
    if (empty.length) console.error('  empty:', empty.join(', '));
  } else {
    console.log(`✓ ${f} (${keys.length} keys)`);
  }
}
console.log(`\nen.json: ${enKeys.length} keys`);
if (!ok) process.exit(1);
console.log('All locales in sync ✓');
