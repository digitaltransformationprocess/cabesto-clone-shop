/** Prints MCP execute_sql args JSON for staged index (stdout). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2];
const query = fs.readFileSync(path.join(dir, 'current-batch', `${i}.sql`), 'utf8');
process.stdout.write(JSON.stringify({ query }));
