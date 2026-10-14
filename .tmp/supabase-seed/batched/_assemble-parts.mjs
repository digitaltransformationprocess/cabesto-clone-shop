/** Assemble query parts back to stdout (UTF-8). */
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.join(__dirname, 'query-parts');
const base = process.argv[2];
if (!base) {
  console.error('Usage: node _assemble-parts.mjs <sanitized-base-name>');
  process.exit(1);
}
const dir = path.join(outRoot, base);
const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
let q = '';
for (const p of meta.parts) {
  q += fs.readFileSync(path.join(dir, p), 'utf8');
}
if (q.length !== meta.queryLen) {
  console.error('Length mismatch', q.length, meta.queryLen);
  process.exit(1);
}
process.stdout.write(q);
