/**
 * Read {query} JSON from argv[2], write args-only JSON for agent CallDynamicTool.
 * Usage: node _exec-args-json.mjs <args.json> <out.json>
 */
import fs from 'fs';

const inPath = process.argv[2];
const outPath = process.argv[3];
if (!inPath || !outPath) {
  console.error('usage: node _exec-args-json.mjs <args.json> <out.json>');
  process.exit(1);
}
const args = JSON.parse(fs.readFileSync(inPath, 'utf8'));
fs.writeFileSync(outPath, JSON.stringify(args), 'utf8');
console.log(JSON.stringify({ queryLen: args.query.length, out: outPath }));
