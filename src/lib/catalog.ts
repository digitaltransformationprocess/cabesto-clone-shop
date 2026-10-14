import pecheImg from "@/assets/cat-peche.jpg";
import nautismeImg from "@/assets/cat-nautisme.jpg";
import plongeeImg from "@/assets/cat-plongee.jpg";
import vetementsImg from "@/assets/cat-vetements.jpg";
import { getSupabase } from "./supabase";
import type { Category, CategoryNode, Order, Product } from "./data";

type DbCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  name: string;
  path: string[];
  product_count: number;
  sort_order: number;
};

type DbProductRow = {
  sku: string;
  name: string;
  description: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  stock: number;
  cover_path: string | null;
  category_path: string[] | null;
  brand_name: string | null;
  images: Array<{ path: string; position?: number; is_cover?: boolean }> | null;
};

const universeImages: Record<string, string> = {
  peche: pecheImg,
  nautisme: nautismeImg,
  plongee: plongeeImg,
  textile: vetementsImg,
  vetements: vetementsImg,
};

export type CatalogSnapshot = {
  products: Product[];
  categoryTree: CategoryNode[];
  categories: Category[];
  initialOrders: Order[];
};

let cache: CatalogSnapshot | null = null;
let loading: Promise<CatalogSnapshot> | null = null;

async function fetchAllCategories(): Promise<DbCategory[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("categories")
    .select("id, parent_id, slug, name, path, product_count, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`categories: ${error.message}`);
  return (data ?? []) as DbCategory[];
}

async function fetchAllProducts(): Promise<DbProductRow[]> {
  const sb = getSupabase();
  const pageSize = 1000;
  const rows: DbProductRow[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await sb
      .from("v_products_catalog")
      .select(
        "sku, name, description, price_cents, compare_at_price_cents, stock, cover_path, category_path, brand_name, images",
      )
      .eq("is_active", true)
      .order("sku", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`products: ${error.message}`);
    const chunk = (data ?? []) as DbProductRow[];
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return rows;
}

function buildTree(flat: DbCategory[]): CategoryNode[] {
  const byPath = new Map<string, CategoryNode>();
  const sorted = [...flat].sort(
    (a, b) => a.path.length - b.path.length || a.sort_order - b.sort_order,
  );

  for (const row of sorted) {
    byPath.set(row.path.join("/"), {
      slug: row.slug,
      name: row.name,
      path: row.path,
      children: [],
      productCount: row.product_count,
    });
  }

  const roots: CategoryNode[] = [];
  for (const row of sorted) {
    const node = byPath.get(row.path.join("/"))!;
    if (row.path.length === 1) {
      roots.push(node);
      continue;
    }
    const parent = byPath.get(row.path.slice(0, -1).join("/"));
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

function mapProduct(row: DbProductRow): Product {
  const categoryPath = row.category_path ?? [];
  const imagePaths = (row.images ?? [])
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((i) => i.path)
    .filter(Boolean);
  const cover = row.cover_path || imagePaths[0] || "";
  return {
    id: row.sku,
    name: row.name,
    brand: row.brand_name || "",
    description: row.description || "",
    price: row.price_cents / 100,
    ...(row.compare_at_price_cents != null
      ? { oldPrice: row.compare_at_price_cents / 100 }
      : {}),
    stock: row.stock,
    category: categoryPath[0] || "",
    categoryPath,
    cover,
    images: imagePaths.length ? imagePaths : cover ? [cover] : [],
  };
}

function buildInitialOrders(products: Product[]): Order[] {
  const pick = (...ids: string[]) => ids.filter((id) => products.some((p) => p.id === id));
  const sampleIds = pick(
    products[0]?.id ?? "",
    products[1]?.id ?? "",
    products[2]?.id ?? "",
    products.find((p) => p.category === "plongee")?.id ?? "",
    products.find((p) => p.category === "nautisme")?.id ?? "",
    products.find((p) => p.category === "peche")?.id ?? "",
    products.find((p) => p.category === "montagne")?.id ?? "",
    products.find((p) => p.category === "piscine")?.id ?? "",
  );

  return [
    {
      id: "CMD-1042",
      customer: "Julie Martin",
      email: "client@test.fr",
      date: "2026-10-12",
      items: sampleIds.slice(0, 2).map((id, i) => ({ id, qty: i === 1 ? 2 : 1 })),
      status: "En préparation" as const,
      carrier: "Colissimo",
    },
    {
      id: "CMD-1038",
      customer: "Julie Martin",
      email: "client@test.fr",
      date: "2026-10-08",
      items: sampleIds.slice(2, 3).map((id) => ({ id, qty: 1 })),
      status: "En transit" as const,
      carrier: "Chronopost",
    },
    {
      id: "CMD-1021",
      customer: "Julie Martin",
      email: "client@test.fr",
      date: "2026-09-21",
      items: sampleIds.slice(3, 5).map((id) => ({ id, qty: 1 })),
      status: "Livrée" as const,
      carrier: "Colissimo",
    },
    {
      id: "CMD-1009",
      customer: "Julie Martin",
      email: "client@test.fr",
      date: "2026-09-02",
      items: sampleIds.slice(0, 1).map((id) => ({ id, qty: 1 })),
      status: "Retournée" as const,
      carrier: "Mondial Relay",
    },
    {
      id: "CMD-1040",
      customer: "Thomas Kerboul",
      email: "thomas@mail.fr",
      date: "2026-10-11",
      items: sampleIds.slice(5, 6).map((id) => ({ id, qty: 1 })),
      status: "Expédiée" as const,
      carrier: "DHL",
    },
    {
      id: "CMD-1036",
      customer: "Nadia Rousseau",
      email: "nadia@mail.fr",
      date: "2026-10-06",
      items: sampleIds.slice(6, 8).map((id) => ({ id, qty: 1 })),
      status: "Livrée" as const,
      carrier: "Transporteur",
    },
    {
      id: "CMD-1033",
      customer: "Paul Riou",
      email: "paul@mail.fr",
      date: "2026-10-03",
      items: sampleIds.slice(1, 2).map((id) => ({ id, qty: 1 })),
      status: "Annulée" as const,
      carrier: "Colissimo",
    },
    {
      id: "CMD-1030",
      customer: "Emma Guen",
      email: "emma@mail.fr",
      date: "2026-09-29",
      items: sampleIds.slice(3, 5).map((id) => ({ id, qty: 1 })),
      status: "En transit" as const,
      carrier: "Chronopost",
    },
  ].filter((o) => o.items.length > 0 && o.items.every((i) => products.some((p) => p.id === i.id)));
}

async function fetchSnapshot(): Promise<CatalogSnapshot> {
  const [flatCats, rows] = await Promise.all([fetchAllCategories(), fetchAllProducts()]);
  const categoryTree = buildTree(flatCats);
  const products = rows.map(mapProduct);
  const categories: Category[] = categoryTree.map((u) => {
    const hit = products.find((p) => p.category === u.slug && p.cover);
    return {
      slug: u.slug,
      name: u.name,
      tagline: `${u.productCount} produit${u.productCount > 1 ? "s" : ""}`,
      image: universeImages[u.slug] ?? hit?.cover ?? nautismeImg,
      path: u.path,
    };
  });
  return {
    products,
    categoryTree,
    categories,
    initialOrders: buildInitialOrders(products),
  };
}

/** Load catalog from Supabase (cached). Safe to call from root beforeLoad. */
export async function ensureCatalog(): Promise<CatalogSnapshot> {
  if (cache) return cache;
  if (!loading) {
    loading = fetchSnapshot()
      .then((snap) => {
        cache = snap;
        return snap;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

export function getCatalogCache() {
  return cache;
}

export function isCatalogLoaded() {
  return cache != null;
}
