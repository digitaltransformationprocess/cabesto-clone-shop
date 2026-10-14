/** stdout: full SQL from _q-{id}.txt or _invoke-{id}.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!id) {
  console.error('Usage: node read-query-path.mjs <id e.g. 2-1>');
  process.exit(1);
}
const qPath = path.join(dir, `_q-${id}.txt`);
const invPath = path.join(dir, `_invoke-${id}.json`);
let query;
if (fs.existsSync(qPath)) query = fs.readFileSync(qPath, 'utf8');
else if (fs.existsSync(invPath)) query = JSON.parse(fs.readFileSync(invPath, 'utf8')).query;
else {
  console.error('missing', id);
  process.exit(1);
}
process.stdout.write(query);
