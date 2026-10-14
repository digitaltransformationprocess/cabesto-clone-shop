import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const batch = path.join(dir, 'current-batch');
for (let i = 0; i < 4; i++) {
  const q = fs.readFileSync(path.join(batch, `${i}.sql`), 'utf8');
  fs.writeFileSync(path.join(batch, `exec-args-${i}.json`), JSON.stringify({ query: q }), 'utf8');
}
