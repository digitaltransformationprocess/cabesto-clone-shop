/**
 * Orchestrates import batches: stages next batch, prints indices to execute.
 * Agent runs execute_sql for each index via load-out-args + CallDynamicTool.
 * Usage: node mcp-loop-runner.mjs prepare | mark <file...> | status
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const seed = path.dirname(fileURLToPath(import.meta.url));
const shop = path.resolve(seed, '../..');
const batchDir = path.join(seed, 'current-batch');
const cmd = process.argv[2];

function prepareOutArgs() {
  for (let i = 0; i < 4; i++) {
    const sqlPath = path.join(batchDir, `${i}.sql`);
    if (!fs.existsSync(sqlPath)) break;
    const q = fs.readFileSync(sqlPath, 'utf8');
    fs.writeFileSync(path.join(batchDir, `out-args-${i}.json`), JSON.stringify({ query: q }));
  }
}

if (cmd === 'prepare') {
  const raw = execSync('node .tmp/supabase-seed/mcp-import-runner.mjs 4', {
    cwd: shop,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const j = JSON.parse(raw.trim());
  if (j.status === 'complete') {
    console.log(JSON.stringify({ complete: true }));
    process.exit(0);
  }
  fs.mkdirSync(batchDir, { recursive: true });
  j.payload.forEach((p, i) => {
    fs.writeFileSync(path.join(batchDir, `${i}.sql`), p.query, 'utf8');
    fs.writeFileSync(path.join(batchDir, `${i}.file`), p.file, 'utf8');
  });
  prepareOutArgs();
  console.log(
    JSON.stringify({
      complete: false,
      remaining: j.remaining,
      files: j.payload.map((p) => p.file),
      bytes: j.payload.map((p) => p.query.length),
    }),
  );
} else if (cmd === 'mark') {
  const files = process.argv.slice(3);
  execSync(`node .tmp/supabase-seed/mark-done.mjs ${files.map((f) => JSON.stringify(f)).join(' ')}`, {
    cwd: shop,
    encoding: 'utf8',
  });
  console.log(JSON.stringify({ marked: files }));
} else if (cmd === 'status') {
  const state = JSON.parse(fs.readFileSync(path.join(seed, 'import-state.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(seed, 'json-chunks/manifest.json'), 'utf8'));
  const all = [...manifest.productFiles, ...manifest.imageFiles];
  const pending = all.filter((f) => !state.done.includes(f) && !state.failed.some((x) => x.file === f));
  console.log(JSON.stringify({ done: state.done.length, pending: pending.length, failed: state.failed }));
} else {
  console.error('Usage: node mcp-loop-runner.mjs prepare|mark <files...>|status');
  process.exit(1);
}
