/**
 * Reads {query} from JSON path argv[2], prints result placeholder.
 * Agent must call user-supabase execute_sql with that query — this script only validates JSON.
 */
import fs from 'fs';

const p = process.argv[2];
if (!p) {
  console.error('Usage: node mcp-exec-from-json.mjs <path-to-{query}.json>');
  process.exit(1);
}
const { query } = JSON.parse(fs.readFileSync(p, 'utf8'));
if (!query?.length) {
  console.error('empty query');
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, bytes: query.length, head: query.slice(0, 60) }));
