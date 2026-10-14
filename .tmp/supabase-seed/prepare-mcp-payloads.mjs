import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const batchDir = path.join(dir, 'current-batch');
for (let i = 0; i < 4; i++) {
  const sqlPath = path.join(batchDir, `${i}.sql`);
  if (!fs.existsSync(sqlPath)) break;
  const query = fs.readFileSync(sqlPath, 'utf8');
  const file = fs.readFileSync(path.join(batchDir, `${i}.file`), 'utf8').trim();
  fs.writeFileSync(path.join(dir, `_mcp-payload-${i}.json`), JSON.stringify({ file, query }), 'utf8');
}
const files = fs.readdirSync(batchDir).filter((f) => f.endsWith('.file')).length;
console.log(JSON.stringify({ count: files }));
