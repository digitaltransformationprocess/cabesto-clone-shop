import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
for (let i = 0; i < 4; i++) {
  const call = JSON.parse(fs.readFileSync(path.join(dir, `mcp-call-${i}.json`), 'utf8'));
  const out = path.join(dir, `_mcp-args-only-${i}.json`);
  fs.writeFileSync(out, JSON.stringify(call.arguments));
  console.log(out, call.arguments.query.length);
}
