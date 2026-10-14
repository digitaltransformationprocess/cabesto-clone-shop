import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const batch = path.join(dir, 'current-batch');
for (const i of process.argv.slice(2).map(Number)) {
  const q = fs.readFileSync(path.join(batch, `${i}.sql`), 'utf8');
  const b64 = Buffer.from(q, 'utf8').toString('base64');
  const sql = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
  fs.writeFileSync(path.join(batch, `_do${i}.json`), JSON.stringify({ query: sql }));
  console.log(i, 'doLen', sql.length);
}
