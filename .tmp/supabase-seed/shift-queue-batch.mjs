/** Pop next N items from exec-queue.json into exec-payload-{i}.json for MCP batch. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const seed = path.dirname(fileURLToPath(import.meta.url));
const queuePath = path.join(seed, 'exec-queue.json');
const statePath = path.join(seed, 'exec-queue-state.json');
const n = parseInt(process.argv[2] || '4', 10);

const { queue } = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const state = fs.existsSync(statePath)
  ? JSON.parse(fs.readFileSync(statePath, 'utf8'))
  : { cursor: 0 };

if (state.cursor >= queue.length) {
  console.log(JSON.stringify({ status: 'complete', cursor: state.cursor, total: queue.length }));
  process.exit(0);
}

const slice = queue.slice(state.cursor, state.cursor + n);
slice.forEach((item, i) => {
  fs.writeFileSync(
    path.join(seed, `exec-payload-${i}.json`),
    JSON.stringify({
      file: item.file,
      part: item.part,
      parts: item.parts,
      query: item.query,
      bytes: item.query.length,
    }),
  );
});
state.cursor += slice.length;
state.lastBatch = slice.map((item) => ({ file: item.file, part: item.part, parts: item.parts }));
fs.writeFileSync(statePath, JSON.stringify(state, null, 2) + '\n');

console.log(
  JSON.stringify({
    status: 'batch',
    cursor: state.cursor,
    total: queue.length,
    remaining: queue.length - state.cursor,
    files: slice.map((x) => x.file),
  }),
);
