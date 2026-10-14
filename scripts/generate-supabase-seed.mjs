import fs from "node:fs";
import path from "node:path";

const catalog = JSON.parse(fs.readFileSync("src/lib/catalog.json", "utf8"));
const outDir = path.resolve(".tmp/supabase-seed");
fs.mkdirSync(outDir, { recursive: true });

function slugify(s) {
  return (
    String(s || "unknown")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "unknown"
  );
}

function flattenTree(nodes, acc = []) {
  for (const n of nodes) {
    acc.push({
      slug: n.slug,
      name: n.name,
      path: n.path,
      product_count: n.productCount ?? 0,
      sort_order: acc.length,
    });
    if (n.children?.length) flattenTree(n.children, acc);
  }
  return acc;
}

const categories = flattenTree(catalog.tree);
const brandNames = [...new Set(catalog.products.map((p) => p.brand).filter(Boolean))].sort();
const brands = brandNames.map((name) => ({ name, slug: slugify(name) }));

const slugCount = new Map();
for (const b of brands) {
  const base = b.slug;
  const n = (slugCount.get(base) || 0) + 1;
  slugCount.set(base, n);
  if (n > 1) b.slug = `${base}-${n}`;
}

const products = catalog.products.map((p) => ({
  sku: p.id,
  name: p.name,
  brand: p.brand || null,
  category_path: p.categoryPath || [],
  description: p.description || "",
  price_cents: Math.round(Number(p.price || 0) * 100),
  compare_at_price_cents: p.oldPrice != null ? Math.round(Number(p.oldPrice) * 100) : null,
  stock: Number(p.stock || 0),
  cover_path: p.cover || null,
  images: Array.isArray(p.images) ? p.images : [],
}));

function sqlJson(value) {
  return `$json$${JSON.stringify(value)}$json$`;
}

const files = [];

{
  const sql = `-- brands
insert into public.brands (name, slug)
select x->>'name', x->>'slug'
from jsonb_array_elements(${sqlJson(brands)}) as x
on conflict (name) do update set slug = excluded.slug;
`;
  const f = path.join(outDir, "01-brands.sql");
  fs.writeFileSync(f, sql);
  files.push(f);
}

{
  const byDepth = new Map();
  for (const c of categories) {
    const d = c.path.length;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(c);
  }
  for (const depth of [...byDepth.keys()].sort((a, b) => a - b)) {
    const rows = byDepth.get(depth);
    const sql = `-- categories depth ${depth}
insert into public.categories (parent_id, slug, name, path, product_count, sort_order)
select
  case when jsonb_array_length(x->'path') = 1 then null
       else (
         select id from public.categories p
         where p.path = (
           select array_agg(e order by ord)
           from jsonb_array_elements_text(x->'path') with ordinality t(e, ord)
           where ord < jsonb_array_length(x->'path')
         )
       )
  end,
  x->>'slug',
  x->>'name',
  array(select jsonb_array_elements_text(x->'path')),
  coalesce((x->>'product_count')::int, 0),
  coalesce((x->>'sort_order')::int, 0)
from jsonb_array_elements(${sqlJson(rows)}) as x
on conflict (path) do update set
  name = excluded.name,
  product_count = excluded.product_count,
  sort_order = excluded.sort_order,
  parent_id = excluded.parent_id;
`;
    const f = path.join(outDir, `02-categories-d${depth}.sql`);
    fs.writeFileSync(f, sql);
    files.push(f);
  }
}

const productChunk = 80;
for (let i = 0; i < products.length; i += productChunk) {
  const chunk = products.slice(i, i + productChunk).map(({ images, ...rest }) => rest);
  const sql = `-- products ${i}-${i + chunk.length}
insert into public.products (
  sku, name, brand_id, category_id, category_path, description,
  price_cents, compare_at_price_cents, stock, cover_path, metadata
)
select
  x->>'sku',
  x->>'name',
  b.id,
  c.id,
  coalesce(array(select jsonb_array_elements_text(x->'category_path')), '{}'),
  coalesce(x->>'description', ''),
  coalesce((x->>'price_cents')::int, 0),
  nullif(x->>'compare_at_price_cents', '')::int,
  coalesce((x->>'stock')::int, 0),
  nullif(x->>'cover_path', ''),
  jsonb_build_object('source', 'cabesto-catalog')
from jsonb_array_elements(${sqlJson(chunk)}) as x
left join public.brands b on b.name = x->>'brand'
left join public.categories c on c.path = array(select jsonb_array_elements_text(x->'category_path'))
on conflict (sku) do update set
  name = excluded.name,
  brand_id = excluded.brand_id,
  category_id = excluded.category_id,
  category_path = excluded.category_path,
  description = excluded.description,
  price_cents = excluded.price_cents,
  compare_at_price_cents = excluded.compare_at_price_cents,
  stock = excluded.stock,
  cover_path = excluded.cover_path,
  metadata = excluded.metadata,
  updated_at = now();
`;
  const f = path.join(outDir, `03-products-${String(i).padStart(4, "0")}.sql`);
  fs.writeFileSync(f, sql);
  files.push(f);
}

const imageRows = [];
for (const p of products) {
  const imgs = p.images.length ? p.images : p.cover_path ? [p.cover_path] : [];
  imgs.forEach((imgPath, position) => {
    imageRows.push({
      sku: p.sku,
      path: imgPath,
      position,
      is_cover: Boolean(p.cover_path ? imgPath === p.cover_path : position === 0),
      alt: p.name,
    });
  });
}

const imageChunk = 150;
for (let i = 0; i < imageRows.length; i += imageChunk) {
  const chunk = imageRows.slice(i, i + imageChunk);
  const sql = `-- images ${i}-${i + chunk.length}
insert into public.product_images (product_id, path, alt, position, is_cover)
select p.id, x->>'path', x->>'alt', coalesce((x->>'position')::int, 0), coalesce((x->>'is_cover')::boolean, false)
from jsonb_array_elements(${sqlJson(chunk)}) as x
join public.products p on p.sku = x->>'sku'
on conflict (product_id, path) do update set
  alt = excluded.alt,
  position = excluded.position,
  is_cover = excluded.is_cover;
`;
  const f = path.join(outDir, `04-images-${String(i).padStart(5, "0")}.sql`);
  fs.writeFileSync(f, sql);
  files.push(f);
}

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(
    {
      brands: brands.length,
      categories: categories.length,
      products: products.length,
      images: imageRows.length,
      files: files.map((f) => path.basename(f)),
    },
    null,
    2,
  ),
);

console.log(
  JSON.stringify(
    {
      outDir,
      brands: brands.length,
      categories: categories.length,
      products: products.length,
      images: imageRows.length,
      files: files.length,
    },
    null,
    2,
  ),
);
