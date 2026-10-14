/**
 * Reads exec-payload-{i}.json and runs user-supabase execute_sql via Cursor MCP bridge.
 * Requires CURSOR_MCP_BRIDGE_URL or falls back to printing payload paths for agent.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const indices = process.argv.slice(2).map(Number);
if (!indices.length) {
  console.error('Usage: node run-exec-payloads.mjs 0 1 2 3');
  process.exit(1);
}

const bridge = process.env.CURSOR_MCP_BRIDGE_URL;
if (!bridge) {
  for (const i of indices) {
    const p = path.join(dir, `exec-payload-${i}.json`);
    const { file, query } = JSON.parse(fs.readFileSync(p, 'utf8'));
    console.log(JSON.stringify({ i, file, queryBytes: query.length, needsMcp: true }));
  }
  process.exit(0);
}

async function execOne(i) {
  const p = path.join(dir, `exec-payload-${i}.json`);
  const { file, query } = JSON.parse(fs.readFileSync(p, 'utf8'));
  const res = await fetch(bridge, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool: 'execute_sql', arguments: { query } }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`i=${i} file=${file} ${res.status} ${body.slice(0, 500)}`);
  return { i, file, body };
}

const results = await Promise.all(indices.map((i) => execOne(i)));
console.log(JSON.stringify(results, null, 2));
