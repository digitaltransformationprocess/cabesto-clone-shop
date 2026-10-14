import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
const dir = path.dirname(fileURLToPath(import.meta.url));
const { query } = JSON.parse(
  fs.readFileSync(path.join(dir, 'current-batch', `_exec-query-${i}.json`), 'utf8'),
);
fs.writeFileSync(path.join(dir, 'current-batch', `_q-only-${i}.sql`), query, 'utf8');
console.log(JSON.stringify({ i, bytes: query.length }));
