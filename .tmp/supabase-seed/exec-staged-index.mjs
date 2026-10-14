/**
 * Reads staged _exec-query-{i}.json and prints { query } for agent → user-supabase execute_sql.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
if (i === undefined) {
  console.error('Usage: node exec-staged-index.mjs <0-3>');
  process.exit(1);
}
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const file = fs.readFileSync(path.join(dir, `${i}.file`), 'utf8').trim();
const { query } = JSON.parse(fs.readFileSync(path.join(dir, `_exec-query-${i}.json`), 'utf8'));
process.stdout.write(JSON.stringify({ file, bytes: query.length, query }));
