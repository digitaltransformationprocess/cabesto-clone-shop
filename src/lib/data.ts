import peche from "@/assets/cat-peche.jpg";
import nautisme from "@/assets/cat-nautisme.jpg";
import plongee from "@/assets/cat-plongee.jpg";
import vetements from "@/assets/cat-vetements.jpg";

export type Category = { slug: string; name: string; tagline: string; image: string };
export const categories: Category[] = [
  { slug: "peche", name: "Pêche", tagline: "Cannes, moulinets, leurres", image: peche },
  { slug: "nautisme", name: "Nautisme", tagline: "Sécurité, mouillage, accastillage", image: nautisme },
  { slug: "plongee", name: "Plongée", tagline: "Masques, palmes, ordinateurs", image: plongee },
  { slug: "vetements", name: "Vêtements", tagline: "Cirés, bottes, polaires", image: vetements },
];

export type Product = { id: string; category: string; name: string; brand: string; price: number; oldPrice?: number; description: string; stock: number };
export const products: Product[] = [
  { id: "p1", category: "peche", name: "Canne spinning Mer 2,70 m", brand: "Ocealis", price: 89.9, oldPrice: 109.9, description: "Canne carbone légère pour le lancer en bord de mer, puissance 10-40 g, action rapide.", stock: 14 },
  { id: "p2", category: "peche", name: "Moulinet frein avant 4000", brand: "Ocealis", price: 64.5, description: "Moulinet 6 roulements inox, bobine aluminium, traité eau salée.", stock: 22 },
  { id: "p3", category: "peche", name: "Coffret 12 leurres souples", brand: "Fishline", price: 24.9, description: "Assortiment de shads 9 cm en coloris naturels et flashy, têtes plombées incluses.", stock: 40 },
  { id: "p4", category: "nautisme", name: "Gilet autogonflant 150N", brand: "SeaSafe", price: 79.0, oldPrice: 95.0, description: "Gilet automatique homologué CE, harnais intégré, déclenchement par pastille hydrosoluble.", stock: 18 },
  { id: "p5", category: "nautisme", name: "Ancre soc de charrue 10 kg", brand: "Marinox", price: 119.0, description: "Ancre galvanisée à fort pouvoir de tenue, idéale bateaux de 7 à 10 m.", stock: 6 },
  { id: "p6", category: "nautisme", name: "Pare-battage cylindrique x2", brand: "Marinox", price: 34.9, description: "Lot de 2 défenses PVC souple 15x58 cm avec oeillets renforcés.", stock: 30 },
  { id: "p7", category: "plongee", name: "Masque panoramique Vision", brand: "AbyssPro", price: 49.9, description: "Jupe silicone hypoallergénique, verre trempé, large champ de vision.", stock: 25 },
  { id: "p8", category: "plongee", name: "Palmes chaussantes Glide", brand: "AbyssPro", price: 59.0, description: "Palmes polypropylène nervurées, rendement élevé pour la randonnée et l'apnée.", stock: 12 },
  { id: "p9", category: "plongee", name: "Ordinateur de plongée Nitrox", brand: "DeepTrack", price: 299.0, oldPrice: 349.0, description: "Écran haute lisibilité, modes air/nitrox/apnée, carnet de plongée intégré.", stock: 4 },
  { id: "p10", category: "vetements", name: "Veste de quart Offshore", brand: "Bordée", price: 189.0, description: "Ciré respirant 3 couches, capuche haute visibilité, poignets néoprène.", stock: 9 },
  { id: "p11", category: "vetements", name: "Bottes de pont antidérapantes", brand: "Bordée", price: 69.9, description: "Caoutchouc naturel, semelle non marquante, doublure confort.", stock: 16 },
  { id: "p12", category: "vetements", name: "Polaire marine zippée", brand: "Bordée", price: 44.9, oldPrice: 54.9, description: "Polaire 300 g chaude et légère, séchage rapide.", stock: 35 },
];

export const productImage = (p: Product) => categories.find((c) => c.slug === p.category)!.image;
export const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export type Role = "client" | "employe" | "admin";
export type User = { email: string; password: string; name: string; role: Role };
export const testUsers: User[] = [
  { email: "client@test.fr", password: "client123", name: "Julie Martin", role: "client" },
  { email: "employe@test.fr", password: "employe123", name: "Marc Le Gall", role: "employe" },
  { email: "admin@test.fr", password: "admin123", name: "Sophie Admin", role: "admin" },
];

export const statuses = ["En préparation", "Expédiée", "En transit", "Livrée", "Retournée", "Annulée"] as const;
export type Status = (typeof statuses)[number];
export type Order = { id: string; customer: string; email: string; date: string; items: { id: string; qty: number }[]; status: Status; carrier: string; shipping?: { name: string; street: string; zip: string; city: string; phone: string } };
export const initialOrders: Order[] = [
  { id: "CMD-1042", customer: "Julie Martin", email: "client@test.fr", date: "2026-10-12", items: [{ id: "p1", qty: 1 }, { id: "p3", qty: 2 }], status: "En préparation", carrier: "Colissimo" },
  { id: "CMD-1038", customer: "Julie Martin", email: "client@test.fr", date: "2026-10-08", items: [{ id: "p4", qty: 1 }], status: "En transit", carrier: "Chronopost" },
  { id: "CMD-1021", customer: "Julie Martin", email: "client@test.fr", date: "2026-09-21", items: [{ id: "p12", qty: 1 }, { id: "p11", qty: 1 }], status: "Livrée", carrier: "Colissimo" },
  { id: "CMD-1009", customer: "Julie Martin", email: "client@test.fr", date: "2026-09-02", items: [{ id: "p7", qty: 1 }], status: "Retournée", carrier: "Mondial Relay" },
  { id: "CMD-1040", customer: "Thomas Kerboul", email: "thomas@mail.fr", date: "2026-10-11", items: [{ id: "p9", qty: 1 }], status: "Expédiée", carrier: "DHL" },
  { id: "CMD-1036", customer: "Nadia Rousseau", email: "nadia@mail.fr", date: "2026-10-06", items: [{ id: "p5", qty: 1 }, { id: "p6", qty: 2 }], status: "Livrée", carrier: "Transporteur" },
  { id: "CMD-1033", customer: "Paul Riou", email: "paul@mail.fr", date: "2026-10-03", items: [{ id: "p10", qty: 1 }], status: "Annulée", carrier: "Colissimo" },
  { id: "CMD-1030", customer: "Emma Guen", email: "emma@mail.fr", date: "2026-09-29", items: [{ id: "p8", qty: 1 }, { id: "p7", qty: 1 }], status: "En transit", carrier: "Chronopost" },
];
export const orderTotal = (o: Order) => o.items.reduce((s, i) => s + products.find((p) => p.id === i.id)!.price * i.qty, 0);
