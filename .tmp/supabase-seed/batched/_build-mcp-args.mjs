import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
const out = process.argv[3];
if (!batch) {
  console.error('usage: node _build-mcp-args.mjs <file.sql> [out.json]');
  process.exit(1);
}
const query = execSync(`node "${path.join(__dirname, '_extract-query.mjs')}" "${batch}"`, {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});
const payload = { query };
const json = JSON.stringify(payload);
if (out) fs.writeFileSync(out, json);
else process.stdout.write(json);
