/** Assemble staged chunks into full SQL on stdout. */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '.mcp-staged');
const name = process.argv[2];
if (!name) {
  console.error('usage: node _assemble-staged-query.cjs <file.sql>');
  process.exit(1);
}
const meta = JSON.parse(fs.readFileSync(path.join(dir, `${name}.meta.json`), 'utf8'));
let query = '';
for (const chunkPath of meta.chunks) {
  query += JSON.parse(fs.readFileSync(chunkPath, 'utf8')).part;
}
if (query.length !== meta.queryLen) {
  console.error('length mismatch', query.length, meta.queryLen);
  process.exit(1);
}
process.stdout.write(query);
