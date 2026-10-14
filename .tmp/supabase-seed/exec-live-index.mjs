/** Print exec-live-{i}.sql path and byte length for MCP batch index 0..3 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const seed = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2] ?? '0';
const p = path.join(seed, `exec-live-${i}.sql`);
const query = fs.readFileSync(p, 'utf8');
process.stdout.write(query);
