/** Split batch query into JSON shards for agent MCP invoke. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) {
  console.error('usage: node _split-for-agent.mjs <file.sql>');
  process.exit(1);
}
const query = execSync(`node "${path.join(__dirname, '_extract-query.mjs')}" "${name}"`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const outDir = path.join(__dirname, '.agent-shards', name);
fs.mkdirSync(outDir, { recursive: true });
const CHUNK = 85000;
const parts = [];
for (let i = 0, n = 0; i < query.length; i += CHUNK, n++) {
  const fn = `shard-${String(n).padStart(3, '0')}.json`;
  const slice = query.slice(i, i + CHUNK);
  fs.writeFileSync(path.join(outDir, fn), JSON.stringify({ slice }));
  parts.push(fn);
}
fs.writeFileSync(
  path.join(outDir, 'meta.json'),
  JSON.stringify({ file: name, queryLen: query.length, parts })
);
console.log(JSON.stringify({ file: name, queryLen: query.length, parts: parts.length, outDir }));
