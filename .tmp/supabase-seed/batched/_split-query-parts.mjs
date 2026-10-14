/** Split MCP query JSON into <=65000 char parts for agent Read tool reassembly. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outRoot = path.join(__dirname, 'query-parts');
const CHUNK = 65_000;

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node _split-query-parts.mjs <file.sql> ...');
  process.exit(1);
}

fs.mkdirSync(outRoot, { recursive: true });

for (const name of files) {
  const sqlPath = path.join(__dirname, name);
  let query = fs.readFileSync(sqlPath, 'utf8');
  const DIRECT_MAX = 120_000;
  if (query.length > DIRECT_MAX) {
    const b64 = Buffer.from(query, 'utf8').toString('base64');
    query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
  }
  const base = name.replace(/[^\w.-]/g, '_');
  const dir = path.join(outRoot, base);
  fs.mkdirSync(dir, { recursive: true });
  const meta = { file: name, queryLen: query.length, parts: [] };
  for (let i = 0, p = 0; i < query.length; i += CHUNK, p++) {
    const partName = `part-${String(p).padStart(3, '0')}.txt`;
    const slice = query.slice(i, i + CHUNK);
    fs.writeFileSync(path.join(dir, partName), slice, 'utf8');
    meta.parts.push(partName);
  }
  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(meta), 'utf8');
  console.log(JSON.stringify(meta));
}
