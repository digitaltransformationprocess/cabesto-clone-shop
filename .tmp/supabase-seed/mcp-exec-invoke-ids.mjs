/**
 * Prints invoke ids + byte sizes for agent MCP batch (use print-invoke-query.mjs per id).
 * Usage: node mcp-exec-invoke-ids.mjs 1 2-0 2-1 ...
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
for (const id of process.argv.slice(2)) {
  const p = path.join(dir, `_invoke-${id}.json`);
  if (!fs.existsSync(p)) {
    console.error('missing', p);
    process.exit(1);
  }
  const { query } = JSON.parse(fs.readFileSync(p, 'utf8'));
  console.log(JSON.stringify({ id, bytes: query.length }));
}
