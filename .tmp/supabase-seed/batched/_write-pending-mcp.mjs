/** Write {file, query} for one batch (raw or DO-wrapped) for agent MCP execute_sql. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) {
  console.error('Usage: node _write-pending-mcp.mjs <file.sql>');
  process.exit(1);
}
const sqlPath = path.join(__dirname, name);
let query = fs.readFileSync(sqlPath, 'utf8');
const DIRECT_MAX = 120_000;
if (query.length > DIRECT_MAX) {
  const b64 = Buffer.from(query, 'utf8').toString('base64');
  query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
}
const out = path.join(__dirname, '.pending-mcp.json');
fs.writeFileSync(out, JSON.stringify({ file: name, queryLen: query.length, query }), 'utf8');
console.log(JSON.stringify({ file: name, queryLen: query.length, out }));
