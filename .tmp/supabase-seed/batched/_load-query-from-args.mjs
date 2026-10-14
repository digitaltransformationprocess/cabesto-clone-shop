/** stdout: full query string from .exec-args/<batch>.args.json */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const batch = process.argv[2];
if (!batch) {
  console.error('Usage: node _load-query-from-args.mjs <file.sql>');
  process.exit(1);
}
const argsPath = path.join(__dirname, '.exec-args', `${batch}.args.json`);
const { query } = JSON.parse(fs.readFileSync(argsPath, 'utf8'));
process.stdout.write(query);
