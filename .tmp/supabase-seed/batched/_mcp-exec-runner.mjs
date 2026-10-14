/**
 * Prints MCP tool invocation payload for user-supabase execute_sql (one batch file).
 * Agent: read stdout JSON and call CallDynamicTool with it.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) {
  console.error('Usage: node _mcp-exec-runner.mjs <file.sql>');
  process.exit(1);
}
const sqlPath = path.join(__dirname, name);
let query = fs.readFileSync(sqlPath, 'utf8');
const DIRECT_MAX = 120_000;
if (query.length > DIRECT_MAX) {
  const b64 = Buffer.from(query, 'utf8').toString('base64');
  query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
}
process.stdout.write(JSON.stringify({ namespace: 'user-supabase', toolName: 'execute_sql', arguments: { query } }));
