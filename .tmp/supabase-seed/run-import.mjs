import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), '.tmp/supabase-seed/json-chunks');
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));

function buildQuery(file) {
  const json = fs.readFileSync(path.join(dir, file), 'utf8').trim();
  let fn;
  if (file.startsWith('cat3-')) fn = 'import_categories';
  else if (file.startsWith('prod-')) fn = 'import_products';
  else if (file.startsWith('img-')) fn = 'import_product_images';
  else throw new Error('unknown: ' + file);
  return `select public.${fn}($json$${json}$json$::jsonb) as n;`;
}

const files = [
  ...manifest.catFiles,
  ...manifest.productFiles,
  ...manifest.imageFiles,
];

const outDir = path.join(process.cwd(), '.tmp/supabase-seed/queries');
fs.mkdirSync(outDir, { recursive: true });

for (const f of files) {
  const q = buildQuery(f);
  fs.writeFileSync(path.join(outDir, f.replace('.json', '.query.sql')), q, 'utf8');
}

console.log(JSON.stringify({ count: files.length, outDir }));
