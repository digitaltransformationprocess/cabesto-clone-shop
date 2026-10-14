/** Print SQL for index — agent passes to user-supabase execute_sql */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const sql = fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8');
const file = fs.readFileSync(path.join(dir, `${i}.file`), 'utf8').trim();
process.stdout.write(JSON.stringify({ file, bytes: sql.length, query: sql }));
