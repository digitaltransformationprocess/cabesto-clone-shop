import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const shop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const seed = path.join(shop, '.tmp/supabase-seed');
const statePath = path.join(seed, 'import-state.json');

function run(cmd) {
  return execSync(cmd, { cwd: shop, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).trim();
}

const raw = run('node .tmp/supabase-seed/mcp-import-runner.mjs 4');
const j = JSON.parse(raw);
if (j.status === 'complete') {
  console.log(JSON.stringify({ status: 'complete', state: j.state }));
  process.exit(0);
}

const batchDir = path.join(seed, 'current-batch');
fs.mkdirSync(batchDir, { recursive: true });
const items = [];
j.payload.forEach((p, i) => {
  fs.writeFileSync(path.join(batchDir, `${i}.sql`), p.query, 'utf8');
  fs.writeFileSync(path.join(batchDir, `${i}.file`), p.file, 'utf8');
  fs.writeFileSync(path.join(batchDir, `mcp-args-${i}.json`), JSON.stringify({ query: p.query }), 'utf8');
  items.push({ index: i, file: p.file, queryPath: path.join(batchDir, `mcp-args-${i}.json`) });
});

console.log(JSON.stringify({ status: 'batch', remaining: j.remaining, items }));
