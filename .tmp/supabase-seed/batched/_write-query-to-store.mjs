/** Write assembled MCP query for one batch to agent store (UTF-8). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
const storeDir = process.argv[3];
if (!batch || !storeDir) {
  console.error('Usage: node _write-query-to-store.mjs <file.sql> <agent-store-dir>');
  process.exit(1);
}

const sqlPath = path.join(__dirname, batch);
let query = fs.readFileSync(sqlPath, 'utf8');
const DIRECT_MAX = 120_000;
if (query.length > DIRECT_MAX) {
  const b64 = Buffer.from(query, 'utf8').toString('base64');
  query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
}

const safe = batch.replace(/[^\w.-]/g, '_');
const out = path.join(storeDir, `query-${safe}.txt`);
fs.writeFileSync(out, query, 'utf8');
console.log(JSON.stringify({ batch, queryLen: query.length, out }));
