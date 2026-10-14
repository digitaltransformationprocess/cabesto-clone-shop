/** Split staged index SQL into chunk query files. Usage: node split-sql-chunks.mjs <index> [chunkSize=8] */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2];
const chunkSize = parseInt(process.argv[3] || '8', 10);
const sql = fs.readFileSync(path.join(dir, 'current-batch', `${i}.sql`), 'utf8');
const m = sql.match(/select public\.import_products\(\$json\$(.*)\$json\$::jsonb\)/s);
if (!m) throw new Error(`parse fail index ${i}`);
const products = JSON.parse(m[1]);
const outDir = path.join(dir, 'current-batch', `chunks-${i}`);
fs.mkdirSync(outDir, { recursive: true });
const files = [];
for (let c = 0; c < products.length; c += chunkSize) {
  const slice = products.slice(c, c + chunkSize);
  const q = `select public.import_products($json$${JSON.stringify(slice)}$json$::jsonb) as n;`;
  const name = `part-${String(c / chunkSize).padStart(3, '0')}.sql`;
  fs.writeFileSync(path.join(outDir, name), q, 'utf8');
  files.push(name);
}
console.log(JSON.stringify({ index: i, parts: files.length, dir: outDir, files }));
