import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
const out = process.argv[3];
if (!batch || !out) {
  console.error('usage: node _write-mcp-payload.mjs <file.sql> <out.json>');
  process.exit(1);
}
const payload = execSync(`node "${path.join(__dirname, '_mcp-exec-runner.mjs')}" "${batch}"`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
fs.writeFileSync(out, payload, 'utf8');
const j = JSON.parse(payload);
console.log(JSON.stringify({ batch, queryLen: j.arguments.query.length, out }));
