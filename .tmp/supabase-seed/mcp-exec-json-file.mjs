/**
 * Execute one {query} JSON file via user-supabase execute_sql.
 * Requires CURSOR_MCP_BRIDGE_URL (same contract as run-exec-payloads.mjs).
 * Usage: node mcp-exec-json-file.mjs <path-to.json>
 */
import fs from 'fs';

const bridge = process.env.CURSOR_MCP_BRIDGE_URL;
const p = process.argv[2];
if (!p) {
  console.error('Usage: node mcp-exec-json-file.mjs <file.json>');
  process.exit(1);
}
const { query } = JSON.parse(fs.readFileSync(p, 'utf8'));
if (!bridge) {
  console.log(JSON.stringify({ needsMcp: true, bytes: query.length, path: p }));
  process.exit(0);
}
const res = await fetch(bridge, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ tool: 'execute_sql', arguments: { query } }),
});
const body = await res.text();
if (!res.ok) throw new Error(`${res.status} ${body.slice(0, 500)}`);
console.log(body);
