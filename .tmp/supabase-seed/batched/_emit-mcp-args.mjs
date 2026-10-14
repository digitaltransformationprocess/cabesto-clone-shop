/** Emit {query} JSON to stdout for one batch (agent → execute_sql). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
if (!batch) {
  console.error('usage: node _emit-mcp-args.mjs <file.sql>');
  process.exit(1);
}
const next = path.join(__dirname, '.next-query', `${batch}.json`);
let query;
if (fs.existsSync(next)) {
  query = JSON.parse(fs.readFileSync(next, 'utf8')).query;
} else {
  query = execSync(`node "${path.join(__dirname, '_extract-query.mjs')}" "${batch}"`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}
process.stdout.write(JSON.stringify({ query }));
