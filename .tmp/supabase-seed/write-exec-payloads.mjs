import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const indices = process.argv.slice(2).map(Number);
for (const i of indices) {
  const sql = fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8');
  const file = fs.readFileSync(path.join(dir, `${i}.file`), 'utf8').trim();
  fs.writeFileSync(path.join(dir, `exec-payload-${i}.json`), JSON.stringify({ file, query: sql }));
  console.log(i, file, sql.length);
}
