/** Stage one batch SQL file as JSON chunks for agent MCP execute_sql (UTF-8). */
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const name = process.argv[2];
if (!name) {
  console.error('usage: node _stage-mcp-query.cjs <file.sql>');
  process.exit(1);
}
const query = fs.readFileSync(path.join(dir, name), 'utf8');
const outDir = path.join(dir, '.mcp-staged');
fs.mkdirSync(outDir, { recursive: true });
const base = name.replace(/[^\w.-]/g, '_');
const chunkSize = 85000;
const chunks = [];
for (let i = 0, n = 0; n < query.length; n += chunkSize, i++) {
  const part = query.slice(n, n + chunkSize);
  const chunkPath = path.join(outDir, `${base}.chunk${i}.json`);
  fs.writeFileSync(chunkPath, JSON.stringify({ part }), 'utf8');
  chunks.push(chunkPath);
}
const metaPath = path.join(outDir, `${base}.meta.json`);
fs.writeFileSync(
  metaPath,
  JSON.stringify({ file: name, queryLen: query.length, chunks }, null, 2),
  'utf8'
);
console.log(JSON.stringify({ file: name, queryLen: query.length, chunks: chunks.length, metaPath }));
