/**
 * Agent-driven import loop helper (MCP execute_sql must run in IDE via CallDynamicTool).
 *
 * Usage:
 *   node agent-mcp-import-loop.mjs prepare     # stage next batch + invoke-*.sql in agent store
 *   node agent-mcp-import-loop.mjs mark          # mark-done for staged current-batch/*.file
 *   node agent-mcp-import-loop.mjs status        # pending count + import-state summary
 *
 * After prepare, agent runs up to 4 parallel user-supabase execute_sql with queries from
 * agent store invoke-{0..N-1}.sql, then `node agent-mcp-import-loop.mjs mark`, repeat prepare.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const seed = path.dirname(fileURLToPath(import.meta.url));
const shop = path.resolve(seed, '../..');
const batchDir = path.join(seed, 'current-batch');
const statePath = path.join(seed, 'import-state.json');
const store = process.env.CURSOR_AGENT_STORE_FILES_DIR;

function run(cmd) {
  return execSync(cmd, { cwd: shop, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }).trim();
}

function queriesForIndex(i) {
  const sql = fs.readFileSync(path.join(batchDir, `${i}.sql`), 'utf8');
  const DIRECT_MAX = 120_000;
  if (sql.length <= DIRECT_MAX) return [sql];
  const m = sql.match(/select public\.import_products\(\$json\$(.*)\$json\$::jsonb\)/s);
  if (!m) throw new Error(`parse fail index ${i}`);
  const products = JSON.parse(m[1]);
  const out = [];
  const chunkSize = 8;
  for (let c = 0; c < products.length; c += chunkSize) {
    const slice = products.slice(c, c + chunkSize);
    out.push(`select public.import_products($json$${JSON.stringify(slice)}$json$::jsonb) as n;`);
  }
  return out;
}

function prepare() {
  if (!store) {
    console.error('CURSOR_AGENT_STORE_FILES_DIR not set');
    process.exit(1);
  }
  const raw = run('node .tmp/supabase-seed/mcp-import-runner.mjs 4');
  const j = JSON.parse(raw);
  if (j.status === 'complete') {
    console.log(JSON.stringify({ status: 'complete', state: j.state }));
    return;
  }
  fs.mkdirSync(batchDir, { recursive: true });
  const files = [];
  j.payload.forEach((p, i) => {
    fs.writeFileSync(path.join(batchDir, `${i}.sql`), p.query, 'utf8');
    fs.writeFileSync(path.join(batchDir, `${i}.file`), p.file, 'utf8');
    files.push(p.file);
  });
  const invokes = [];
  let n = 0;
  for (let i = 0; i < files.length; i++) {
    for (const q of queriesForIndex(i)) {
      const out = path.join(store, `invoke-${n}.sql`);
      fs.writeFileSync(out, q, 'utf8');
      invokes.push({ n, file: files[i], path: out, bytes: q.length });
      n++;
    }
  }
  fs.writeFileSync(
    path.join(seed, '_agent-invoke-manifest.json'),
    JSON.stringify({ remaining: j.remaining, batchFiles: files, invokes }, null, 2),
    'utf8',
  );
  console.log(JSON.stringify({ status: 'batch', remaining: j.remaining, batchFiles: files, invokeCount: n }));
}

function mark() {
  const files = [];
  for (let i = 0; i < 4; i++) {
    const fp = path.join(batchDir, `${i}.file`);
    if (fs.existsSync(fp)) files.push(fs.readFileSync(fp, 'utf8').trim());
  }
  if (!files.length) {
    console.error('No staged batch files');
    process.exit(1);
  }
  run(`node .tmp/supabase-seed/mark-done.mjs ${files.map((f) => JSON.stringify(f)).join(' ')}`);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  console.log(JSON.stringify({ marked: files, failed: state.failed }));
}

function status() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(seed, 'json-chunks/manifest.json'), 'utf8'),
  );
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const all = [...manifest.productFiles, ...manifest.imageFiles];
  const pending = all.filter((f) => !state.done.includes(f) && !state.failed.some((x) => x.file === f));
  console.log(JSON.stringify({ pending: pending.length, done: state.done.length, failed: state.failed }));
}

const cmd = process.argv[2] || 'prepare';
if (cmd === 'prepare') prepare();
else if (cmd === 'mark') mark();
else if (cmd === 'status') status();
else {
  console.error('Usage: node agent-mcp-import-loop.mjs prepare|mark|status');
  process.exit(1);
}
