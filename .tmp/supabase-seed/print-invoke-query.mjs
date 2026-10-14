import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const idx = process.argv[2];
if (!idx) {
  console.error('Usage: node print-invoke-query.mjs <invoke-id e.g. 1 or 2-0>');
  process.exit(1);
}
const p = path.join(dir, `_invoke-${idx}.json`);
const { query } = JSON.parse(fs.readFileSync(p, 'utf8'));
process.stdout.write(query);
