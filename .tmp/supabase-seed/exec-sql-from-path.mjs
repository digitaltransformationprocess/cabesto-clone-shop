/**
 * Agent helper: read SQL file path argv[2], print {query} JSON to stdout (for CallDynamicTool).
 */
import fs from 'fs';

const p = process.argv[2];
if (!p) {
  console.error('Usage: node exec-sql-from-path.mjs <path-to.sql>');
  process.exit(1);
}
const query = fs.readFileSync(p, 'utf8');
process.stdout.write(JSON.stringify({ query }));
