/** Load full execute_sql query for a batch file (stdout). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
const chunkDir = path.join(__dirname, '.read-chunks', name);
const metaPath = path.join(chunkDir, 'meta.json');
if (fs.existsSync(metaPath)) {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  let q = '';
  for (let i = 0; i < meta.parts; i++) {
    const p = path.join(chunkDir, `part-${String(i).padStart(3, '0')}.txt`);
    q += fs.readFileSync(p, 'utf8');
  }
  process.stdout.write(q);
} else {
  process.stdout.write(
    execSync(`node "${path.join(__dirname, '_extract-query.mjs')}" "${name}"`, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    })
  );
}
