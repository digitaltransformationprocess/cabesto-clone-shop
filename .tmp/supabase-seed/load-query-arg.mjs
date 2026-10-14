import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2];
const sql = fs.readFileSync(path.join(dir, 'current-batch', `${i}.sql`), 'utf8');
process.stdout.write(JSON.stringify({ query: sql }));
