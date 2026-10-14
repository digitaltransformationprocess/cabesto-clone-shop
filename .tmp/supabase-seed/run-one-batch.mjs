import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const shop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const batchDir = path.join(shop, '.tmp/supabase-seed/current-batch');
const statePath = path.join(shop, '.tmp/supabase-seed/import-state.json');

const raw = execSync('node .tmp/supabase-seed/fetch-batch.mjs', {
  cwd: shop,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});
const meta = JSON.parse(raw.trim());
if (meta.complete) {
  console.log(JSON.stringify({ complete: true }));
  process.exit(0);
}

// Emit one JSON line per query for agent to pipe to execute_sql
for (let i = 0; i < meta.files.length; i++) {
  const q = fs.readFileSync(path.join(batchDir, `${i}.sql`), 'utf8');
  console.log(JSON.stringify({ file: meta.files[i], query: q }));
}
console.log(JSON.stringify({ batchFiles: meta.files, remaining: meta.remaining }));
