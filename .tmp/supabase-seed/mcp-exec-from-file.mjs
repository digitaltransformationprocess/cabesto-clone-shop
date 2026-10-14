/**
 * Reads staged SQL and prints JSON for user-supabase execute_sql (agent passes to CallDynamicTool).
 * Usage: node mcp-exec-from-file.mjs <index>
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
if (i === undefined) {
  console.error('Usage: node mcp-exec-from-file.mjs <0|1|2|3>');
  process.exit(1);
}
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const sql = fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8');
const file = fs.readFileSync(path.join(dir, `${i}.file`), 'utf8').trim();
process.stdout.write(JSON.stringify({ file, bytes: sql.length, query: sql }));
