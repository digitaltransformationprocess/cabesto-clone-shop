/** Split batch query into agent-store part files (<=90k) for Read + single execute_sql. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
const store = process.argv[3] || process.env.CURSOR_AGENT_STORE_FILES_DIR;
if (!batch || !store) {
  console.error('usage: node _write-query-chunks-for-mcp.mjs <file.sql> [agent-store-dir]');
  process.exit(1);
}
const q = execSync(`node "${path.join(__dirname, '_load-next-query.mjs')}" "${batch}"`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
fs.mkdirSync(store, { recursive: true });
const safe = batch.replace(/[^a-zA-Z0-9.-]/g, '_');
const slice = 90000;
const parts = [];
for (let i = 0; i * slice < q.length; i++) {
  const name = `mcp-query-${safe}-part-${String(i).padStart(3, '0')}.txt`;
  const content = q.slice(i * slice, (i + 1) * slice);
  fs.writeFileSync(path.join(store, name), content, 'utf8');
  parts.push({ name, len: content.length });
}
const manifest = { batch, queryLen: q.length, parts };
fs.writeFileSync(path.join(store, `mcp-query-${safe}-manifest.json`), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest));
