import fs from "node:fs";
import path from "node:path";

const catalog = JSON.parse(fs.readFileSync("src/lib/catalog.json", "utf8"));
const outDir = path.resolve(".tmp/supabase-seed/json-chunks");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

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

const categories = flattenTree(catalog.tree).filter((c) => c.path.length === 3);
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

function writeChunks(prefix, rows, size) {
  const files = [];
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size);
    const name = `${prefix}-${String(i).padStart(5, "0")}.json`;
    fs.writeFileSync(path.join(outDir, name), JSON.stringify(chunk));
    files.push(name);
  }
  return files;
}

const catFiles = writeChunks("cat3", categories, 60);
const productPayload = products.map(({ images, ...rest }) => rest);
const productFiles = writeChunks("prod", productPayload, 40);

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
const imageFiles = writeChunks("img", imageRows, 80);

const manifest = { outDir, catFiles, productFiles, imageFiles, counts: { categories: categories.length, products: products.length, images: imageRows.length } };
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest.counts));
console.log("files", catFiles.length + productFiles.length + imageFiles.length);
