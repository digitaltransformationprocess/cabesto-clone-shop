/**
 * Writes execute_sql arguments for exec-payload-{index}.json to mcp-arg-out.json (agent reads & calls MCP).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const seed = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2] ?? '0';
const src = path.join(seed, `exec-payload-${i}.json`);
const out = path.join(seed, 'mcp-arg-out.json');
const { query, file, part, parts } = JSON.parse(fs.readFileSync(src, 'utf8'));
fs.writeFileSync(out, JSON.stringify({ query, meta: { file, part, parts, index: i } }));
console.log(JSON.stringify({ out, bytes: query.length, file, part }));
