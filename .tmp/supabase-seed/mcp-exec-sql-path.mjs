/**
 * Reads SQL file path argv[2], calls Supabase MCP execute_sql if SUPABASE_ACCESS_TOKEN set.
 * Token: same OAuth as Cursor user-supabase (from env or ~/.cursor mcp auth).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const query = fs.readFileSync(process.argv[2], 'utf8');
const projectRef = 'dlxismvcvhbbhcaovzrz';
const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MCP_ACCESS_TOKEN;
if (!token) {
  console.error('No SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}
const url = `https://mcp.supabase.com/mcp?project_ref=${projectRef}&features=database`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'execute_sql', arguments: { query } },
  }),
});
const text = await res.text();
if (!res.ok) {
  console.error(text.slice(0, 800));
  process.exit(1);
}
console.log(text);
