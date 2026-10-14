import fs from 'fs';
import path from 'path';

const root = path.join(process.cwd(), '.tmp/supabase-seed');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'json-chunks/manifest.json'), 'utf8'));
const jdir = path.join(root, 'json-chunks');
const outDir = path.join(root, 'queries');

function merge(files, fn) {
  const all = [];
  for (const f of files) {
    const chunk = JSON.parse(fs.readFileSync(path.join(jdir, f), 'utf8'));
    all.push(...chunk);
  }
  const json = JSON.stringify(all);
  const query = `select public.${fn}($json$${json}$json$::jsonb) as n;`;
  return { count: all.length, query };
}

const prod = merge(manifest.productFiles, 'import_products');
const img = merge(manifest.imageFiles, 'import_product_images');

fs.writeFileSync(path.join(outDir, 'ALL-prod.query.sql'), prod.query, 'utf8');
fs.writeFileSync(path.join(outDir, 'ALL-img.query.sql'), img.query, 'utf8');
console.log(JSON.stringify({ products: prod.count, images: img.count, prodQueryLen: prod.query.length, imgQueryLen: img.query.length }));
