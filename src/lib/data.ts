import pecheImg from "@/assets/cat-peche.jpg";
import nautismeImg from "@/assets/cat-nautisme.jpg";
import plongeeImg from "@/assets/cat-plongee.jpg";
import vetementsImg from "@/assets/cat-vetements.jpg";
import catalog from "./catalog.json";

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

const universeImages: Record<string, string> = {
  peche: pecheImg,
  nautisme: nautismeImg,
  plongee: plongeeImg,
  textile: vetementsImg,
  vetements: vetementsImg,
};

export const categoryTree = catalog.tree as CategoryNode[];
export const products = catalog.products as Product[];

const fallbackCover = (slug: string) => {
  const hit = products.find((p) => p.category === slug && p.cover);
  return hit?.cover ?? nautismeImg;
};

export const categories: Category[] = categoryTree.map((u) => ({
  slug: u.slug,
  name: u.name,
  tagline: `${u.productCount} produit${u.productCount > 1 ? "s" : ""}`,
  image: universeImages[u.slug] ?? fallbackCover(u.slug),
  path: u.path,
}));

export const productImage = (p: Product) => p.cover || p.images[0] || fallbackCover(p.category);

export const productImages = (p: Product) => (p.images?.length ? p.images : [productImage(p)]);

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

export const initialOrders: Order[] = [
  {
    id: "CMD-1042",
    customer: "Julie Martin",
    email: "client@test.fr",
    date: "2026-10-12",
    items: sampleIds.slice(0, 2).map((id, i) => ({ id, qty: i === 1 ? 2 : 1 })),
    status: "En préparation",
    carrier: "Colissimo",
  },
  {
    id: "CMD-1038",
    customer: "Julie Martin",
    email: "client@test.fr",
    date: "2026-10-08",
    items: sampleIds.slice(2, 3).map((id) => ({ id, qty: 1 })),
    status: "En transit",
    carrier: "Chronopost",
  },
  {
    id: "CMD-1021",
    customer: "Julie Martin",
    email: "client@test.fr",
    date: "2026-09-21",
    items: sampleIds.slice(3, 5).map((id) => ({ id, qty: 1 })),
    status: "Livrée",
    carrier: "Colissimo",
  },
  {
    id: "CMD-1009",
    customer: "Julie Martin",
    email: "client@test.fr",
    date: "2026-09-02",
    items: sampleIds.slice(0, 1).map((id) => ({ id, qty: 1 })),
    status: "Retournée",
    carrier: "Mondial Relay",
  },
  {
    id: "CMD-1040",
    customer: "Thomas Kerboul",
    email: "thomas@mail.fr",
    date: "2026-10-11",
    items: sampleIds.slice(5, 6).map((id) => ({ id, qty: 1 })),
    status: "Expédiée",
    carrier: "DHL",
  },
  {
    id: "CMD-1036",
    customer: "Nadia Rousseau",
    email: "nadia@mail.fr",
    date: "2026-10-06",
    items: sampleIds.slice(6, 8).map((id) => ({ id, qty: 1 })),
    status: "Livrée",
    carrier: "Transporteur",
  },
  {
    id: "CMD-1033",
    customer: "Paul Riou",
    email: "paul@mail.fr",
    date: "2026-10-03",
    items: sampleIds.slice(1, 2).map((id) => ({ id, qty: 1 })),
    status: "Annulée",
    carrier: "Colissimo",
  },
  {
    id: "CMD-1030",
    customer: "Emma Guen",
    email: "emma@mail.fr",
    date: "2026-09-29",
    items: sampleIds.slice(3, 5).map((id) => ({ id, qty: 1 })),
    status: "En transit",
    carrier: "Chronopost",
  },
].filter((o) => o.items.length > 0 && o.items.every((i) => products.some((p) => p.id === i.id)));

export const orderTotal = (o: Order) =>
  o.items.reduce((s, i) => s + (products.find((p) => p.id === i.id)?.price ?? 0) * i.qty, 0);
