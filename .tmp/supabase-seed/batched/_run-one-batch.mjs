/**
 * Reads a batch SQL file and prints JSON { query } to stdout for MCP execute_sql.
 * Usage: node _run-one-batch.mjs <filename.sql>
 */
import fs from 'fs';
import path from 'path';

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const name = process.argv[2];
if (!name) {
  console.error('Usage: node _run-one-batch.mjs <file.sql>');
  process.exit(1);
}
const filePath = path.join(dir, name);
const query = fs.readFileSync(filePath, 'utf8');
process.stdout.write(JSON.stringify({ query }));
