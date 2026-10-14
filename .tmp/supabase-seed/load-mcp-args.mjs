import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2];
const p = path.join(dir, 'current-batch', `_args-only-${i}.json`);
process.stdout.write(fs.readFileSync(p, 'utf8'));
