/** Split assembled batch query into <=90k parts in agent store for Read + execute_sql. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
const store = process.argv[3];
if (!batch || !store) {
  console.error('usage: node _split-query-for-agent.mjs <file.sql> <agent-store-dir>');
  process.exit(1);
}

const chunkDir = path.join(__dirname, '.read-chunks', batch);
const meta = JSON.parse(fs.readFileSync(path.join(chunkDir, 'meta.json'), 'utf8'));
const parts = Array.isArray(meta.parts) ? meta.parts : [];
let q = '';
for (const p of parts) {
  q += fs.readFileSync(path.join(chunkDir, p), 'utf8');
}
fs.mkdirSync(store, { recursive: true });
const slice = 90000;
const outParts = [];
for (let i = 0; i * slice < q.length; i++) {
  const name = `query-${batch.replace(/[^a-zA-Z0-9.-]/g, '_')}-part-${String(i).padStart(3, '0')}.txt`;
  const content = q.slice(i * slice, (i + 1) * slice);
  fs.writeFileSync(path.join(store, name), content, 'utf8');
  outParts.push({ name, len: content.length });
}
console.log(JSON.stringify({ batch, queryLen: q.length, outParts }, null, 2));
