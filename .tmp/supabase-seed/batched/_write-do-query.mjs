import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const outDir = path.join(__dirname, '.mcp-chunks');
const meta = JSON.parse(fs.readFileSync(path.join(outDir, `${name}.meta.json`), 'utf8'));
const prefix = "DO $mcp$ BEGIN EXECUTE convert_from(decode('";
const suffix = "', 'base64'), 'UTF8'); END $mcp$;";
let b64 = '';
for (const fname of meta.chunks) {
  b64 += fs.readFileSync(path.join(outDir, fname), 'utf8');
}
const query = prefix + b64 + suffix;
const out = path.join(outDir, `${name}.do-query.txt`);
fs.writeFileSync(out, query, 'utf8');
const chunkSize = 45000;
for (let i = 0, p = 0; i < query.length; i += chunkSize, p++) {
  fs.writeFileSync(path.join(outDir, `${name}.do-query.part${p}.txt`), query.slice(i, i + chunkSize), 'utf8');
}
console.log(JSON.stringify({ out, len: query.length, parts: Math.ceil(query.length / chunkSize) }));
