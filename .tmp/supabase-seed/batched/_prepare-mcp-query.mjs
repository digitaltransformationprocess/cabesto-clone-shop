/**
 * Reads a .sql batch file and writes MCP execute_sql args JSON (UTF-8).
 * Usage: node _prepare-mcp-query.mjs <file.sql> [out.json]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const out =
  process.argv[3] ||
  path.join(__dirname, `.mcp-query-${name.replace(/[^\w.-]/g, '_')}.json`);

if (!name) {
  console.error('Usage: node _prepare-mcp-query.mjs <file.sql> [out.json]');
  process.exit(1);
}

const filePath = path.join(__dirname, name);
let query = fs.readFileSync(filePath, 'utf8');

// For very large payloads, wrap as DO+base64 (still one logical batch file).
const DIRECT_MAX = 120_000;
if (query.length > DIRECT_MAX) {
  const b64 = Buffer.from(query, 'utf8').toString('base64');
  query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
}

fs.writeFileSync(out, JSON.stringify({ query }), 'utf8');
console.log(JSON.stringify({ file: name, sqlLen: query.length, out }));
