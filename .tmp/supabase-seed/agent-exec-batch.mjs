/**
 * Stage next N exec-queue items as _single-query-{i}.sql for agent execute_sql.
 * Usage: node agent-exec-batch.mjs [N=4]
 * Does NOT advance cursor — call agent-advance-batch.mjs after successful MCP run.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const seed = path.dirname(fileURLToPath(import.meta.url));
const n = parseInt(process.argv[2] || '4', 10);
const statePath = path.join(seed, 'exec-queue-state.json');
const queuePath = path.join(seed, 'exec-queue.json');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const { queue } = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const slice = queue.slice(state.cursor, state.cursor + n);

if (!slice.length) {
  console.log(JSON.stringify({ status: 'complete', cursor: state.cursor, total: queue.length }));
  process.exit(0);
}

const staged = slice.map((item, i) => {
  const sqlPath = path.join(seed, `_single-query-${i}.sql`);
  fs.writeFileSync(sqlPath, item.query);
  fs.writeFileSync(
    path.join(seed, `_single-meta-${i}.json`),
    JSON.stringify({ file: item.file, part: item.part, parts: item.parts, bytes: item.query.length }),
  );
  return { i, file: item.file, part: item.part, parts: item.parts, sqlPath, bytes: item.query.length };
});

console.log(JSON.stringify({ status: 'staged', cursor: state.cursor, staged }, null, 2));
