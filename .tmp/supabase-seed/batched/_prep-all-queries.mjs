import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '.mcp-queries');
fs.mkdirSync(outDir, { recursive: true });

const DIRECT_MAX = 120_000;
const files = [
  '01-meta.sql',
  '02-products-00.sql',
  '02-products-05.sql',
  '02-products-10.sql',
  '02-products-15.sql',
  '03-images-00.sql',
  '03-images-06.sql',
  '03-images-12.sql',
  '03-images-18.sql',
  '03-images-24.sql',
  '03-images-30.sql',
  '03-images-36.sql',
  '03-images-42.sql',
];

for (const name of files) {
  let query = fs.readFileSync(path.join(__dirname, name), 'utf8');
  if (query.length > DIRECT_MAX) {
    const b64 = Buffer.from(query, 'utf8').toString('base64');
    query = `DO $mcp$ BEGIN EXECUTE convert_from(decode('${b64}', 'base64'), 'UTF8'); END $mcp$;`;
  }
  fs.writeFileSync(path.join(outDir, `${name}.query.txt`), query);
  console.log(name, query.length);
}
