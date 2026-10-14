/** Split staged {i}.sql import into smaller chunk SQL files for MCP execute_sql. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const i = process.argv[2];
const chunkSize = Number(process.argv[3] || 10);
const sql = fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8');
const m = sql.match(/select public\.import_products\(\$json\$(.*)\$json\$::jsonb\)/s);
if (!m) {
  console.error('parse failed');
  process.exit(1);
}
const products = JSON.parse(m[1]);
const outDir = path.join(dir, `chunks-${i}`);
fs.mkdirSync(outDir, { recursive: true });
const chunks = [];
for (let c = 0, n = 0; c < products.length; c += chunkSize, n++) {
  const slice = products.slice(c, c + chunkSize);
  const q = `select public.import_products($json$${JSON.stringify(slice)}$json$::jsonb) as n;`;
  const fp = path.join(outDir, `part-${n}.sql`);
  fs.writeFileSync(fp, q, 'utf8');
  fs.writeFileSync(path.join(outDir, `part-${n}.json`), JSON.stringify({ query: q }), 'utf8');
  chunks.push({ n, count: slice.length, bytes: q.length, file: fp });
}
console.log(JSON.stringify({ index: i, total: products.length, chunks }, null, 2));
