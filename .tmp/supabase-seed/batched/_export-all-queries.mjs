import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir =
  process.argv[2] ||
  path.join(__dirname, '.mcp-queries');
fs.mkdirSync(outDir, { recursive: true });

const batches = [
  '01-meta.sql',
  '02-products-00.sql',
  '02-products-05.sql',
  '02-products-10.sql',
  '02-products-15.sql',
  '03-images-00.sql',
  '03-images-06.sql',
  '03-images-12.sql',
  '03-images-18.sql',
  '03-images-24.sql',
  '03-images-30.sql',
  '03-images-36.sql',
  '03-images-42.sql',
];

for (const b of batches) {
  const q = execSync(`node "${path.join(__dirname, '_extract-query.mjs')}" "${b}"`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(outDir, `${b}.query.txt`), q, 'utf8');
  console.log(b, q.length);
}
