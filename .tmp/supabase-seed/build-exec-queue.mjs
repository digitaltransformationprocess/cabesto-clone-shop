/** Build flat queue of SQL strings for all pending chunks (stdout JSON array). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const seed = path.dirname(fileURLToPath(import.meta.url));
const shop = path.resolve(seed, '../..');
const qdir = path.join(seed, 'queries');
const statePath = path.join(seed, 'import-state.json');
const manifest = JSON.parse(fs.readFileSync(path.join(seed, 'json-chunks/manifest.json'), 'utf8'));

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const allFiles = [...manifest.productFiles, ...manifest.imageFiles];
const pending = allFiles.filter((f) => !state.done.includes(f) && !state.failed.some((x) => x.file === f));

const queue = [];
for (const file of pending) {
  const base = file.replace('.json', '');
  const sql = fs.readFileSync(path.join(qdir, `${base}.query.sql`), 'utf8');
  const MCP_SAFE = 45_000;
  if (sql.length <= MCP_SAFE) {
    queue.push({ file, part: 0, parts: 1, query: sql });
    continue;
  }
  const m = sql.match(/select public\.import_(products|product_images)\(\$json\$(.*)\$json\$::jsonb\)/s);
  if (!m) throw new Error(`parse fail ${file}`);
  const fn = m[1];
  const items = JSON.parse(m[2]);
  const chunkSize = 10;
  const parts = Math.ceil(items.length / chunkSize);
  for (let c = 0, n = 0; c < items.length; c += chunkSize, n++) {
    const slice = items.slice(c, c + chunkSize);
    queue.push({
      file,
      part: n,
      parts,
      query: `select public.import_${fn}($json$${JSON.stringify(slice)}$json$::jsonb) as n;`,
    });
  }
}

const outPath = path.join(seed, 'exec-queue.json');
fs.writeFileSync(outPath, JSON.stringify({ pendingFiles: pending.length, execCount: queue.length, queue }), 'utf8');
console.log(JSON.stringify({ pendingFiles: pending.length, execCount: queue.length, outPath }));
