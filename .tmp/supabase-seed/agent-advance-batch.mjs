/** After MCP success: advance exec-queue cursor by N and mark completed files. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const seed = path.dirname(fileURLToPath(import.meta.url));
const shop = path.resolve(seed, '../..');
const n = parseInt(process.argv[2] || '4', 10);
const statePath = path.join(seed, 'exec-queue-state.json');
const queuePath = path.join(seed, 'exec-queue.json');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const { queue } = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const slice = queue.slice(state.cursor, state.cursor + n);
state.cursor += slice.length;
state.lastBatch = slice.map((item) => ({ file: item.file, part: item.part, parts: item.parts }));
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

const toMark = [];
for (const item of slice) {
  if (item.part === item.parts - 1 && !toMark.includes(item.file)) toMark.push(item.file);
}
if (toMark.length) {
  execSync(`node .tmp/supabase-seed/mark-done.mjs ${toMark.map((f) => JSON.stringify(f)).join(' ')}`, {
    cwd: shop,
    encoding: 'utf8',
  });
}
console.log(JSON.stringify({ advanced: n, cursor: state.cursor, marked: toMark }));
