/** Emit CallDynamicTool payload for staged index (stdout JSON). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv[2];
const args = JSON.parse(
  fs.readFileSync(path.join(dir, 'current-batch', `mcp-call-${i}.json`), 'utf8'),
);
process.stdout.write(JSON.stringify({ namespace: args.namespace, toolName: args.toolName, arguments: args.arguments }));
