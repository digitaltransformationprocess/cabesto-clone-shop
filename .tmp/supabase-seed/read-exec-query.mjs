import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
const p = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch', `_exec-query-${i}.json`);
process.stdout.write(JSON.parse(fs.readFileSync(p, 'utf8')).query);
