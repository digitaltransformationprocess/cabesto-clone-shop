/** stdout: {query} only for staged index (agent → execute_sql) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const query = fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8');
process.stdout.write(query);
