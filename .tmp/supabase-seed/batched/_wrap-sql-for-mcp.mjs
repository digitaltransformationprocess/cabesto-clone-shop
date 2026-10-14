/** Wrap batch SQL as DO/EXECUTE base64 one-liner for MCP (stdout or agent store). */
import fs from 'fs';
import path from 'path';

const sqlPath = process.argv[2];
const out = process.argv[3];
if (!sqlPath) {
  console.error('usage: node _wrap-sql-for-mcp.mjs <file.sql> [out.txt]');
  process.exit(1);
}
const q = fs.readFileSync(sqlPath, 'utf8');
const b64 = Buffer.from(q, 'utf8').toString('base64');
const wrapped = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
if (out) fs.writeFileSync(out, wrapped, 'utf8');
else process.stdout.write(wrapped);
if (out) console.log(JSON.stringify({ sqlLen: q.length, wrappedLen: wrapped.length, out }));
