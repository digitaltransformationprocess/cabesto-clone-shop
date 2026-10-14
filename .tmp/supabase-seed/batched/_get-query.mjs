import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) {
  console.error('Usage: node _get-query.mjs <file.sql>');
  process.exit(1);
}
const jsonPath = path.join(__dirname, '.next-query', name.replace(/[^\w.-]/g, '_') + '.json');
const { query } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
process.stdout.write(query);
