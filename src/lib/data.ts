import nautismeImg from "@/assets/cat-nautisme.jpg";
import { ensureCatalog as fetchCatalogFromSupabase } from "./catalog";

export type CategoryNode = {
  slug: string;
  name: string;
  path: string[];
  children: CategoryNode[];
  productCount: number;
};

export type Product = {
  id: string;
  category: string;
  categoryPath: string[];
  name: string;
  brand: string;
  price: number;
  oldPrice?: number;
  description: string;
  stock: number;
  cover: string;
  images: string[];
};

/** Top-level universes for nav / home (from category-tree). */
export type Category = { slug: string; name: string; tagline: string; image: string; path: string[] };

/** Filled by `ensureCatalog()` from Supabase (root beforeLoad). */
export const products: Product[] = [];
export const categoryTree: CategoryNode[] = [];
export const categories: Category[] = [];
export let initialOrders: Order[] = [];

/** Load catalogue from Supabase into the exported arrays (idempotent / cached). */
export async function ensureCatalog() {
  const snap = await fetchCatalogFromSupabase();
  products.splice(0, products.length, ...snap.products);
  categoryTree.splice(0, categoryTree.length, ...snap.categoryTree);
  categories.splice(0, categories.length, ...snap.categories);
  initialOrders = snap.initialOrders;
  return snap;
}

const fallbackCover = (slug: string) => {
  const hit = products.find((p) => p.category === slug && p.cover);
  return hit?.cover ?? nautismeImg;
};

/** Storage URLs are already absolute; keep helper for any leftover /media paths. */
export function mediaUrl(src: string): string {
  if (!src || src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) {
    return src;
  }
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
  if (base && src.startsWith("/media/")) {
    return `${base}/storage/v1/object/public/product-media/${src.slice("/media/".length)}`;
  }
  return src;
}

export const productImage = (p: Product) =>
  mediaUrl(p.cover || p.images[0] || fallbackCover(p.category));

export const productImages = (p: Product) =>
  (p.images?.length ? p.images : [p.cover || fallbackCover(p.category)]).map(mediaUrl);

export const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function findCategoryByPath(segments: string[]): CategoryNode | undefined {
  if (!segments.length) return undefined;
  let nodes = categoryTree;
  let found: CategoryNode | undefined;
  for (const seg of segments) {
    found = nodes.find((n) => n.slug === seg);
    if (!found) return undefined;
    nodes = found.children;
  }
  return found;
}

export function categoryPathMatches(productPath: string[], catPath: string[]) {
  if (!catPath.length || productPath.length < catPath.length) return false;
  return catPath.every((seg, i) => productPath[i] === seg);
}

/** Products whose resolved categoryPath is this node or a descendant. */
export function productsInCategory(catPath: string[]): Product[] {
  if (!catPath.length) return products;
  return products.filter((p) => categoryPathMatches(p.categoryPath, catPath));
}

export function categoryBreadcrumbs(catPath: string[]) {
  const crumbs: { name: string; path: string[] }[] = [];
  let nodes = categoryTree;
  const acc: string[] = [];
  for (const seg of catPath) {
    const node = nodes.find((n) => n.slug === seg);
    if (!node) break;
    acc.push(node.slug);
    crumbs.push({ name: node.name, path: [...acc] });
    nodes = node.children;
  }
  return crumbs;
}

export type Role = "client" | "employe" | "admin";
export type User = { email: string; password: string; name: string; role: Role };
export const testUsers: User[] = [
  { email: "client@test.fr", password: "client123", name: "Julie Martin", role: "client" },
  { email: "employe@test.fr", password: "employe123", name: "Marc Le Gall", role: "employe" },
  { email: "admin@test.fr", password: "admin123", name: "Sophie Admin", role: "admin" },
];

export const statuses = ["En préparation", "Expédiée", "En transit", "Livrée", "Retournée", "Annulée"] as const;
export type Status = (typeof statuses)[number];
export type Order = {
  id: string;
  customer: string;
  email: string;
  date: string;
  items: { id: string; qty: number }[];
  status: Status;
  carrier: string;
  shipping?: { name: string; street: string; zip: string; city: string; phone: string };
};

export const orderTotal = (o: Order) =>
  o.items.reduce((s, i) => s + (products.find((p) => p.id === i.id)?.price ?? 0) * i.qty, 0);
