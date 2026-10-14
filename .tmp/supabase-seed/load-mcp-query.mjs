import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = process.argv[2];
const dir = path.dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(fs.readFileSync(path.join(dir, 'current-batch', `mcp-args-${i}.json`), 'utf8'));
process.stdout.write(j.query);
