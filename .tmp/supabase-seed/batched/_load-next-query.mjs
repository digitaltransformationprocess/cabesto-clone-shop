/** stdout: full query string for a batch file name (e.g. 02-products-00.sql) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
if (!batch) {
  console.error('usage: node _load-next-query.mjs <file.sql>');
  process.exit(1);
}
const next = path.join(__dirname, '.next-query', `${batch}.json`);
if (fs.existsSync(next)) {
  const { query } = JSON.parse(fs.readFileSync(next, 'utf8'));
  process.stdout.write(query);
  process.exit(0);
}
const q = execSync(`node "${path.join(__dirname, '_extract-query.mjs')}" "${batch}"`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
process.stdout.write(q);
