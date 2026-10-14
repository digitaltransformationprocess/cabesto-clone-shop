import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const i = process.argv[2];
const p = path.join(path.dirname(fileURLToPath(import.meta.url)), `exec-payload-${i}.json`);
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
process.stdout.write(j.query);
