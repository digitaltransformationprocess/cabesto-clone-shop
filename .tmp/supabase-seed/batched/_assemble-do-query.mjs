import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '.mcp-chunks');
const name = process.argv[2];
const meta = JSON.parse(fs.readFileSync(path.join(outDir, `${name}.meta.json`), 'utf8'));
const prefix = "DO $mcp$ BEGIN EXECUTE convert_from(decode('";
const suffix = "', 'base64'), 'UTF8'); END $mcp$;";
let b64 = '';
for (const fname of meta.chunks) {
  b64 += fs.readFileSync(path.join(outDir, fname), 'utf8');
}
const query = prefix + b64 + suffix;
process.stdout.write(JSON.stringify({ len: query.length, query }));
