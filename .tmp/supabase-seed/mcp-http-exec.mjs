/**
 * Execute SQL via Supabase MCP HTTP (Streamable HTTP transport).
 * Auth: SUPABASE_MCP_ACCESS_TOKEN env var, or OAuth via browser on first run.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const seed = path.dirname(fileURLToPath(import.meta.url));
const MCP_URL =
  process.env.SUPABASE_MCP_URL ||
  'https://mcp.supabase.com/mcp?project_ref=dlxismvcvhbbhcaovzrz&features=database';

async function execSql(client, query) {
  const res = await client.callTool({ name: 'execute_sql', arguments: { query } });
  return res;
}

async function main() {
  const queryPath = process.argv[2];
  const query = queryPath.endsWith('.json')
    ? JSON.parse(fs.readFileSync(queryPath, 'utf8')).query
    : fs.readFileSync(queryPath, 'utf8');

  const headers = {};
  if (process.env.SUPABASE_MCP_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.SUPABASE_MCP_ACCESS_TOKEN}`;
  }

  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), { requestInit: { headers } });
  const client = new Client({ name: 'cabesto-import', version: '1.0.0' });
  await client.connect(transport);
  const out = await execSql(client, query);
  await client.close();
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error(String(e));
  process.exit(1);
});
