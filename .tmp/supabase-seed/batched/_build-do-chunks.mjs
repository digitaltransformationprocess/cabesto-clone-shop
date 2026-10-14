import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '.mcp-chunks');
const name = process.argv[2];
if (!name) {
  console.error('usage: node _build-do-chunks.mjs <file.sql>');
  process.exit(1);
}
const sql = fs.readFileSync(path.join(__dirname, name), 'utf8');
const b64 = Buffer.from(sql, 'utf8').toString('base64');
const prefix = "DO $mcp$ BEGIN EXECUTE convert_from(decode('";
const suffix = "', 'base64'), 'UTF8'); END $mcp$;";
const maxChunk = 85000;
fs.mkdirSync(outDir, { recursive: true });
const meta = { file: name, sqlLen: sql.length, b64Len: b64.length, chunks: [] };
for (let i = 0, part = 0; i < b64.length; i += maxChunk, part++) {
  const chunk = b64.slice(i, i + maxChunk);
  const fname = `${name}.b64.part${part}.txt`;
  fs.writeFileSync(path.join(outDir, fname), chunk, 'utf8');
  meta.chunks.push(fname);
}
fs.writeFileSync(path.join(outDir, `${name}.meta.json`), JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta));
