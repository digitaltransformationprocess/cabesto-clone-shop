import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const shop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(shop, '.tmp/supabase-seed/current-batch');
fs.mkdirSync(outDir, { recursive: true });

const raw = execSync('node .tmp/supabase-seed/mcp-import-runner.mjs 4', {
  cwd: shop,
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});

const j = JSON.parse(raw.trim());
if (j.status === 'complete') {
  console.log(JSON.stringify({ complete: true, remaining: 0, files: [] }));
  process.exit(0);
}

const files = [];
j.payload.forEach((p, i) => {
  fs.writeFileSync(path.join(outDir, `${i}.sql`), p.query, 'utf8');
  fs.writeFileSync(path.join(outDir, `${i}.file`), p.file, 'utf8');
  files.push(p.file);
});

console.log(JSON.stringify({ complete: false, remaining: j.remaining, files }));
