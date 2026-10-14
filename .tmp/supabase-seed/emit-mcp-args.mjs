import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
for (let i = 0; i < 4; i++) {
  const sqlPath = path.join(dir, `${i}.sql`);
  if (!fs.existsSync(sqlPath)) break;
  const query = fs.readFileSync(sqlPath, 'utf8');
  fs.writeFileSync(path.join(dir, `mcp-args-${i}.json`), JSON.stringify({ query }), 'utf8');
  fs.writeFileSync(path.join(dir, `mcp-args-${i}.file`), fs.readFileSync(path.join(dir, `${i}.file`), 'utf8').trim(), 'utf8');
}
console.log('emitted');
