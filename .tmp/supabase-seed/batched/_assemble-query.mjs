/** Print full query for a batch (stdout). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const next = path.join(__dirname, '.next-query', `${name}.json`);
if (fs.existsSync(next)) {
  const { query } = JSON.parse(fs.readFileSync(next, 'utf8'));
  process.stdout.write(query);
  process.exit(0);
}
const shardDir = path.join(__dirname, '.agent-shards', name);
const meta = JSON.parse(fs.readFileSync(path.join(shardDir, 'meta.json'), 'utf8'));
let q = '';
for (const fn of meta.parts) {
  const { slice } = JSON.parse(fs.readFileSync(path.join(shardDir, fn), 'utf8'));
  q += slice;
}
process.stdout.write(q);
