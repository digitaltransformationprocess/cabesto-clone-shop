import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
if (!batch) {
  console.error('Usage: node _concat-query-parts.mjs <batch.sql>');
  process.exit(1);
}
const partsDir = path.join(__dirname, 'query-parts', batch);
const meta = JSON.parse(fs.readFileSync(path.join(partsDir, 'meta.json'), 'utf8'));
let query = '';
for (const p of meta.parts) {
  query += fs.readFileSync(path.join(partsDir, p), 'utf8');
}
process.stdout.write(query);
