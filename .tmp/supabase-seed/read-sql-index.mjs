import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const i = process.argv[2];
process.stdout.write(fs.readFileSync(path.join(dir, `${i}.sql`), 'utf8'));
