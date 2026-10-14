/** Write {query} JSON for a staged batch file. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const dir = __dirname;
const name = process.argv[2];
const out = process.argv[3];
if (!name || !out) {
  console.error('usage: node _write-mcp-args.cjs <file.sql> <out.json>');
  process.exit(1);
}
const q = execFileSync('node', [path.join(dir, '_assemble-staged-query.cjs'), name], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
fs.writeFileSync(out, JSON.stringify({ query: q }), 'utf8');
console.log(JSON.stringify({ file: name, queryLen: q.length, out }));
