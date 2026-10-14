/** Print {query} JSON for MCP from a .mcp-query-*.json or payload file. */
const fs = require('fs');
const p = process.argv[2];
if (!p) {
  console.error('usage: node _exec-json-query.cjs <json-path>');
  process.exit(1);
}
const raw = fs.readFileSync(p, 'utf8');
const j = JSON.parse(raw);
const query = j.query ?? j;
if (typeof query !== 'string') {
  console.error('no query string in', p);
  process.exit(1);
}
process.stdout.write(JSON.stringify({ query }));
