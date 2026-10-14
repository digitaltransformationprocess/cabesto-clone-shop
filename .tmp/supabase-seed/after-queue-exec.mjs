/** Mark import-state done for files whose final queue part was in lastBatch. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const seed = path.dirname(fileURLToPath(import.meta.url));
const shop = path.resolve(seed, '../..');
const statePath = path.join(seed, 'exec-queue-state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const toMark = [];
for (const item of state.lastBatch || []) {
  if (item.part === item.parts - 1) toMark.push(item.file);
}
if (toMark.length) {
  execSync(`node .tmp/supabase-seed/mark-done.mjs ${toMark.map((f) => JSON.stringify(f)).join(' ')}`, {
    cwd: shop,
    encoding: 'utf8',
  });
}
console.log(JSON.stringify({ marked: toMark }));
