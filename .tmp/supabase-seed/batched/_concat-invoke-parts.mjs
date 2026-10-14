/** stdout: full query for batch from invoke-*-part-*.txt in agent store */
import fs from 'fs';
import path from 'path';

const batch = process.argv[2];
const store = process.argv[3] || process.env.CURSOR_AGENT_STORE_FILES_DIR;
if (!batch || !store) {
  console.error('usage: node _concat-invoke-parts.mjs <batch.sql> [storeDir]');
  process.exit(1);
}
const safe = batch.replace(/[^a-zA-Z0-9.-]/g, '_');
const prefix = `invoke-${safe}-part-`;
const files = fs
  .readdirSync(store)
  .filter((f) => f.startsWith(prefix) && f.endsWith('.txt'))
  .sort();
if (!files.length) {
  const argsPath = path.join(store, `mcp-args-${safe.replace(/\.sql$/, '')}.json`.replace('mcp-args-01-meta.sql', 'mcp-args-01-meta'));
  const alt = path.join(store, 'mcp-args-01-meta.json');
  const p = batch === '01-meta.sql' ? alt : path.join(store, `invoke-${safe}.json`);
  if (fs.existsSync(p)) {
    const { query } = JSON.parse(fs.readFileSync(p, 'utf8'));
    process.stdout.write(query);
    process.exit(0);
  }
  console.error('no parts for', batch, 'in', store);
  process.exit(1);
}
let q = '';
for (const f of files) q += fs.readFileSync(path.join(store, f), 'utf8');
process.stdout.write(q);
