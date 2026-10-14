import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const i = parseInt(process.argv[2] || '0', 10);
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'current-batch');
const j = JSON.parse(fs.readFileSync(path.join(dir, `mcp-args-${i}.json`), 'utf8'));
process.stdout.write(j.query);
