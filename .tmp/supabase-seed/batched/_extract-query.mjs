/** Print SQL query for one batch file (stdout). Uses _mcp-exec-runner logic. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) {
  console.error('usage: node _extract-query.mjs <file.sql>');
  process.exit(1);
}
const next = path.join(__dirname, '.next-query', `${name}.json`);
if (fs.existsSync(next)) {
  const { query } = JSON.parse(fs.readFileSync(next, 'utf8'));
  process.stdout.write(query);
  process.exit(0);
}
const sqlPath = path.join(__dirname, name);
let query = fs.readFileSync(sqlPath, 'utf8');
const DIRECT_MAX = 120_000;
if (query.length > DIRECT_MAX) {
  const b64 = Buffer.from(query, 'utf8').toString('base64');
  query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
}
process.stdout.write(query);
