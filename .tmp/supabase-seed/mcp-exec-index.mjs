/** Prints {file, query} for staged batch index — agent passes query to user-supabase execute_sql */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2];
if (i == null) {
  console.error('Usage: node mcp-exec-index.mjs <0-3>');
  process.exit(1);
}
const batch = path.join(dir, 'current-batch');
const query = fs.readFileSync(path.join(batch, `${i}.sql`), 'utf8');
const file = fs.readFileSync(path.join(batch, `${i}.file`), 'utf8').trim();
process.stdout.write(JSON.stringify({ file, query }));
