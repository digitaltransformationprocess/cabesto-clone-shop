/** stdout: {"query":...} for one batch (agent → CallDynamicTool user-supabase execute_sql) */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
const store = process.argv[3] || process.env.CURSOR_AGENT_STORE_FILES_DIR;
if (!batch || !store) {
  console.error('usage: node _emit-query-json.mjs <batch.sql> [storeDir]');
  process.exit(1);
}
const safe = batch.replace(/[^a-zA-Z0-9.-]/g, '_');
const p = path.join(store, `invoke-oneline-${safe}.txt`);
const query = fs.readFileSync(p, 'utf8');
process.stdout.write(JSON.stringify({ query }));
