/**
 * Stages batches from mcp-import-runner; agent must execute each query via user-supabase execute_sql.
 * Usage: node mcp-import-loop.mjs [--mark-done-after path/to/done-files.json]
 * Without mark-done: prints one batch payload JSON to stdout.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const shop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const seed = path.join(shop, '.tmp/supabase-seed');

const raw = execSync('node .tmp/supabase-seed/mcp-import-runner.mjs 4', {
  cwd: shop,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});
const j = JSON.parse(raw.trim());
if (j.status === 'complete') {
  console.log(JSON.stringify({ status: 'complete', state: j.state }));
  process.exit(0);
}

const batchDir = path.join(seed, 'current-batch');
fs.mkdirSync(batchDir, { recursive: true });
j.payload.forEach((p, i) => {
  fs.writeFileSync(path.join(batchDir, `${i}.sql`), p.query, 'utf8');
  fs.writeFileSync(path.join(batchDir, `${i}.file`), p.file, 'utf8');
  fs.writeFileSync(path.join(batchDir, `mcp-args-${i}.json`), JSON.stringify({ query: p.query }), 'utf8');
});

console.log(
  JSON.stringify({
    status: 'batch',
    remaining: j.remaining,
    files: j.payload.map((p) => p.file),
    queryFiles: j.payload.map((_, i) => path.join(batchDir, `${i}.sql`)),
  }),
);
