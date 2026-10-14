import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
for (let i = 0; i < 4; i++) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, `out-args-${i}.json`), 'utf8'));
  fs.writeFileSync(path.join(dir, `_exec-query-${i}.txt`), j.query, 'utf8');
  console.log(i, j.query.length);
}
