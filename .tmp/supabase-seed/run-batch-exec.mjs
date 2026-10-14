/**
 * Execute staged batch indices via user-supabase execute_sql using CURSOR_MCP_BRIDGE_URL.
 * Usage: node run-batch-exec.mjs 0 1 2 3
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const batch = path.join(dir, 'current-batch');
const bridge = process.env.CURSOR_MCP_BRIDGE_URL;
const indices = process.argv.slice(2).map(Number);

async function execOne(i) {
  const query = fs.readFileSync(path.join(batch, `_q${i}.sql`), 'utf8');
  const file = fs.readFileSync(path.join(batch, `${i}.file`), 'utf8').trim();
  if (!bridge) {
    return { i, file, bytes: query.length, needsMcp: true };
  }
  const res = await fetch(bridge, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      namespace: 'user-supabase',
      toolName: 'execute_sql',
      arguments: { query },
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`i=${i} ${file} ${res.status} ${body.slice(0, 500)}`);
  return { i, file, body };
}

const results = await Promise.all(indices.map((i) => execOne(i)));
console.log(JSON.stringify(results, null, 2));
