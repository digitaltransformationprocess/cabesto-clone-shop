/** stdout: JSON.parse query from out-args-{index}.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const j = JSON.parse(fs.readFileSync(path.join(dir, `out-args-${i}.json`), 'utf8'));
process.stdout.write(j.query);
