import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const seed = path.dirname(fileURLToPath(import.meta.url));
const batch = path.join(seed, 'current-batch');
const runner = path.join(seed, 'batched/_mcp-exec-runner.mjs');

for (const i of process.argv.slice(2).map(Number)) {
  const rel = `../current-batch/${i}.sql`;
  const out = execSync(`node "${runner}" "${rel}"`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(batch, `mcp-call-${i}.json`), out, 'utf8');
  const j = JSON.parse(out);
  console.log(i, j.arguments.query.length);
}
