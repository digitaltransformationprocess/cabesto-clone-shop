/** Write one-line DO-block query for MCP (agent store). Usage: node _prepare-oneline-invoke.mjs <batch.sql> [storeDir] */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
const store =
  process.argv[3] ||
  process.env.CURSOR_AGENT_STORE_FILES_DIR ||
  path.join(__dirname, '..', '..', '..', 'agent-store-fallback');
if (!batch) {
  console.error('usage: node _prepare-oneline-invoke.mjs <file.sql> [storeDir]');
  process.exit(1);
}
const q = execSync(`node "${path.join(__dirname, '_load-next-query.mjs')}" "${batch}"`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
fs.mkdirSync(store, { recursive: true });
const safe = batch.replace(/[^a-zA-Z0-9.-]/g, '_');
const out = path.join(store, `invoke-oneline-${safe}.txt`);
fs.writeFileSync(out, q, 'utf8');
console.log(JSON.stringify({ batch, queryLen: q.length, path: out, lines: q.split('\n').length }));
