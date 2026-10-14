import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const DIRECT_MAX = 120_000;
const indices = process.argv.slice(2).map(Number);
const list = indices.length ? indices : [0, 1, 2, 3];

for (const i of list) {
  let query = fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8');
  if (query.length > DIRECT_MAX) {
    const b64 = Buffer.from(query, 'utf8').toString('base64');
    query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
  }
  fs.writeFileSync(path.join(dir, `_exec-query-${i}.json`), JSON.stringify({ query }), 'utf8');
  console.log(i, query.length);
}
