/**
 * Builds src/lib/catalog.json from Puppeteer scrape in data/.
 * Resolves each product onto the official category-tree (universe → … → leaf).
 * Run: node scripts/build-catalog.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const OUT = path.join(ROOT, "src", "lib", "catalog.json");

const slugify = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toMedia = (p) => {
  if (!p) return null;
  const norm = String(p).replace(/\\/g, "/");
  const m = norm.match(/data\/images\/(.+)$/);
  return m ? `/media/${m[1]}` : null;
};

/** Infer universe from Cabesto SKU prefix when topLevel is a promo bucket. */
const SKU_UNIVERSE = [
  [/^AL-/i, "alimentation"],
  [/^SU-/i, "plongee"],
  [/^PCSU-/i, "plongee"],
  [/^PCPL-/i, "plongee"],
  [/^PBSU-/i, "plongee"],
  [/^PBPL-/i, "plongee"],
  [/^PI-/i, "piscine"],
  [/^PCPI-/i, "piscine"],
  [/^NU-/i, "nautisme"],
  [/^PCNU-/i, "nautisme"],
  [/^PE-/i, "peche"],
  [/^PCPE-/i, "peche"],
  [/^NT-/i, "montagne"],
  [/^PCNT-/i, "montagne"],
  [/^GL-/i, "glisse"],
  [/^PCGL-/i, "glisse"],
  [/^TE-/i, "textile"],
];

const PROMO_TOPS = new Set([
  "selection",
  "ventes-privees",
  "bons-plans-du-moment",
  "bons-plans",
  "destockage",
  "autre",
]);

const catalog = JSON.parse(fs.readFileSync(path.join(DATA, "catalog-local.json"), "utf8"));
const treeRaw = JSON.parse(fs.readFileSync(path.join(DATA, "category-tree.json"), "utf8"));

function mapNode(node) {
  const children = (node.children || []).map(mapNode);
  const pathSlugs = (node.path || [node.slug]).map(slugify);
  return {
    slug: slugify(node.slug),
    name: node.label || node.slug,
    path: pathSlugs,
    children,
    productCount: 0,
  };
}

const universes = (treeRaw.universes || []).map(mapNode);
const universeSlugs = new Set(universes.map((u) => u.slug));

function walk(nodes, acc = []) {
  for (const n of nodes) {
    acc.push(n);
    if (n.children?.length) walk(n.children, acc);
  }
  return acc;
}
const allNodes = walk(universes);

const nodeByPathKey = new Map(allNodes.map((n) => [n.path.join("/"), n]));

function findExact(pathArr) {
  if (!pathArr.length) return null;
  return nodeByPathKey.get(pathArr.join("/")) || null;
}

function longestExistingPrefix(pathArr) {
  for (let len = pathArr.length; len >= 1; len--) {
    const node = findExact(pathArr.slice(0, len));
    if (node) return node;
  }
  return null;
}

function inferUniverse(sku, topLevel, rawPath) {
  const top = slugify(topLevel);
  let fromSku = null;
  for (const [re, uni] of SKU_UNIVERSE) {
    if (re.test(sku)) {
      fromSku = uni;
      break;
    }
  }

  // SKU prefix is more reliable than scraped topLevel (promo / wrong crumbs).
  if (fromSku) return fromSku;

  if (top && universeSlugs.has(top) && !PROMO_TOPS.has(top)) return top;

  for (const seg of rawPath) {
    if (universeSlugs.has(seg)) return seg;
  }

  if (top && universeSlugs.has(top)) return top;
  return null;
}

/**
 * Map scraped category crumbs onto the official tree.
 * Prefer structural matches under the inferred universe; avoid cross-universe leaf collisions.
 */
function resolveCategoryPath(sku, topLevel, categoryPath, leafLabel) {
  const raw = (categoryPath || []).map(slugify).filter(Boolean);
  const leaf = slugify(leafLabel) || raw[raw.length - 1] || "";
  const universe = inferUniverse(sku, topLevel, raw);

  // 1) Exact path in tree — only if it sits in the inferred universe
  const exact = findExact(raw);
  if (exact && (!universe || exact.path[0] === universe)) {
    return { path: exact.path, method: "exact" };
  }

  // 2) Prepend universe when missing, take longest existing prefix
  if (universe) {
    const combined = raw[0] === universe ? raw : [universe, ...raw.filter((s) => s !== universe)];
    const exactCombined = findExact(combined);
    if (exactCombined) return { path: exactCombined.path, method: "prepend-exact" };

    const pref = longestExistingPrefix(combined);
    if (pref && pref.path.length >= 2) return { path: pref.path, method: "prepend-prefix" };

    // 3) Leaf slug unique under this universe
    if (leaf) {
      const hits = allNodes.filter((n) => n.slug === leaf && n.path[0] === universe);
      if (hits.length === 1) return { path: hits[0].path, method: "leaf-under-universe" };
      if (hits.length > 1) {
        // Prefer deepest; if raw segments help, score them
        let best = hits[0];
        let bestScore = -1;
        for (const n of hits) {
          let score = n.path.length;
          for (const seg of n.path) if (raw.includes(seg)) score += 2;
          if (score > bestScore) {
            bestScore = score;
            best = n;
          }
        }
        return { path: best.path, method: "leaf-under-universe-scored" };
      }
    }

    // 4) Ordered subsequence score within universe only
    let best = null;
    let bestScore = 0;
    for (const n of allNodes) {
      if (n.path[0] !== universe) continue;
      let i = 0;
      let score = 0;
      for (const seg of n.path.slice(1)) {
        const idx = raw.indexOf(seg, i);
        if (idx >= 0) {
          score += 3;
          i = idx + 1;
        }
      }
      if (leaf && n.slug === leaf) score += 4;
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best && bestScore >= 3) return { path: best.path, method: "score-under-universe" };

    // 5) Universe root only
    return { path: [universe], method: "universe-only" };
  }

  // No universe: keep raw longest prefix if any, else autre
  const pref = longestExistingPrefix(raw);
  if (pref) return { path: pref.path, method: "raw-prefix" };
  return { path: ["autre"], method: "fallback-autre" };
}

const products = [];
let skipped = 0;
const methodStats = {};

for (const row of catalog.products) {
  if (!row?.sku || !row.title || /pris le large/i.test(row.title)) {
    skipped++;
    continue;
  }
  if (row.price?.amount == null || row.price.amount <= 0) {
    skipped++;
    continue;
  }
  if (!row.cover) {
    skipped++;
    continue;
  }
  const coverAbs = path.join(ROOT, row.cover.replace(/\//g, path.sep));
  if (!fs.existsSync(coverAbs)) {
    skipped++;
    continue;
  }

  let detail = null;
  const detailPath = path.join(DATA, "products", `${row.sku}.json`);
  if (fs.existsSync(detailPath)) {
    try {
      detail = JSON.parse(fs.readFileSync(detailPath, "utf8"));
    } catch {
      detail = null;
    }
  }

  const images = [];
  const seen = new Set();
  const pushImg = (rel) => {
    const url = toMedia(rel);
    if (!url || seen.has(url)) return;
    const abs = path.join(ROOT, String(rel).replace(/\//g, path.sep));
    if (!fs.existsSync(abs)) return;
    seen.add(url);
    images.push(url);
  };

  if (detail?.localImages?.length) {
    for (const li of detail.localImages) {
      if (li.skipped) continue;
      pushImg(li.path);
    }
  }
  pushImg(row.cover);
  if (!images.length) {
    skipped++;
    continue;
  }

  const resolved = resolveCategoryPath(row.sku, row.topLevel, row.categoryPath, row.category);
  methodStats[resolved.method] = (methodStats[resolved.method] || 0) + 1;

  const categoryPath = resolved.path;
  const topLevel = categoryPath[0] || "autre";

  const description =
    detail?.description && !/^Achetez .+ chez Cabesto/i.test(detail.description)
      ? detail.description
      : detail?.description || row.title;

  products.push({
    id: row.sku,
    name: row.title,
    brand: row.brand || "Cabesto",
    price: Number(row.price.amount),
    description,
    stock: row.availability?.inStock ? 12 : 0,
    category: topLevel,
    categoryPath,
    cover: images[0],
    images,
  });
}

function pathMatches(productPath, catPath) {
  if (!catPath.length || productPath.length < catPath.length) return false;
  return catPath.every((seg, i) => productPath[i] === seg);
}

function countProducts(node) {
  node.productCount = products.filter((p) => pathMatches(p.categoryPath, node.path)).length;
  for (const c of node.children) countProducts(c);
}

for (const u of universes) countProducts(u);

function prune(node) {
  node.children = node.children.map(prune).filter((c) => c.productCount > 0 || c.children.length > 0);
  return node;
}

const tree = universes.map(prune).filter((u) => u.productCount > 0 || u.children.length > 0);

const payload = {
  generatedAt: new Date().toISOString(),
  source: "puppeteer",
  productCount: products.length,
  skipped,
  resolveStats: methodStats,
  tree,
  products,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload));
console.log(`Wrote ${OUT}`);
console.log(`products=${products.length} skipped=${skipped} universes=${tree.length}`);
console.log("resolveStats", methodStats);
for (const u of tree) {
  console.log(`  ${u.slug}: ${u.productCount} products, ${u.children.length} subcats`);
}
