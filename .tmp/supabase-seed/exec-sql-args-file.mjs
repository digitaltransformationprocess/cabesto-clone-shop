/**
 * Reads {query} JSON file (argv[2]) and runs user-supabase execute_sql via MCP HTTP when token set.
 * Otherwise prints NEEDS_AGENT_MCP and exits 2.
 */
import fs from 'fs';

const args = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const token = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MCP_ACCESS_TOKEN;
const bridge = process.env.CURSOR_MCP_BRIDGE_URL;
const projectRef = 'dlxismvcvhbbhcaovzrz';

async function viaBridge() {
  const res = await fetch(bridge, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      namespace: 'user-supabase',
      toolName: 'execute_sql',
      arguments: args,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  console.log(text);
}

async function viaHttp() {
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
      params: { name: 'execute_sql', arguments: args },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 500)}`);
  console.log(text);
}

try {
  if (bridge) await viaBridge();
  else if (token) await viaHttp();
  else {
    console.error('NEEDS_AGENT_MCP', process.argv[2], args.query.length);
    process.exit(2);
  }
} catch (e) {
  console.error(String(e));
  process.exit(1);
}
