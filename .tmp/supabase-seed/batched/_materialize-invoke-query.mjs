/** Write invoke-{batch}.json query to agent store .current-mcp-query.sql */
import fs from 'fs';

const batch = process.argv[2];
const store = process.env.CURSOR_AGENT_STORE_FILES_DIR;
if (!batch || !store) {
  console.error('usage: CURSOR_AGENT_STORE_FILES_DIR=... node _materialize-invoke-query.mjs <01-meta.sql>');
  process.exit(1);
}
const p = `${store}/invoke-${batch}.json`;
if (!fs.existsSync(p)) {
  console.error('missing', p);
  process.exit(1);
}
const { query } = JSON.parse(fs.readFileSync(p, 'utf8'));
const out = `${store}/.current-mcp-query.sql`;
fs.writeFileSync(out, query, 'utf8');
console.log(JSON.stringify({ batch, bytes: query.length, out }));
