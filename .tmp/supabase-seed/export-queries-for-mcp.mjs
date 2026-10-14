import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'agent-query-export');
fs.mkdirSync(outDir, { recursive: true });
for (let i = 0; i < 4; i++) {
  const q = fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8');
  const argsPath = path.join(outDir, `args-${i}.json`);
  fs.writeFileSync(argsPath, JSON.stringify({ query: q }));
  console.log(argsPath, q.length);
}
