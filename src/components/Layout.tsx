import { Link, useRouteContext } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { euro, products, type Product, productImage, type Status, useCatalog } from "@/lib/data";
import { useStore } from "@/lib/store";
import { ChatWidget } from "./ChatWidget";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <svg viewBox="0 0 40 40" className="h-9 w-9" aria-hidden>
        <circle cx="20" cy="20" r="19" className="fill-primary" />
        <path d="M6 24c4-4 8-4 12 0s8 4 12 0 6-3 6-3" className="stroke-accent" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M20 8v12M14 14h12" className="stroke-primary-foreground" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="font-display text-2xl font-extrabold tracking-tight text-primary">Marinéo</span>
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout, cart } = useStore();
  const { categories: liveCategories } = useCatalog();
  // SSR/hydrate: root beforeLoad serializes navCategories; live cache fills after mount
  const { navCategories = [] } = useRouteContext({ from: "__root__" });
  const categories = liveCategories.length > 0 ? liveCategories : navCategories;
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary py-1.5 text-center text-xs font-medium text-primary-foreground">
        Livraison offerte dès 69 € · Retours gratuits 30 jours · Site de démonstration
      </div>
      <header className="sticky top-0 z-20 border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <Logo />
          <input placeholder="Rechercher un produit, une marque…" className="hidden flex-1 rounded-full border bg-muted px-4 py-2 text-sm md:block" />
          <div className="ml-auto flex items-center gap-4 text-sm font-medium">
            {user ? (
              <>
                <Link to={user.role === "client" ? "/compte" : "/admin"} className="hover:text-accent">{user.name} <span className="text-muted-foreground">({user.role})</span></Link>
                <button onClick={logout} className="text-muted-foreground hover:text-destructive">Déconnexion</button>
              </>
            ) : <Link to="/connexion" className="hover:text-accent">Mon compte</Link>}
            <Link to="/panier" className="rounded-full bg-accent px-3 py-1 text-accent-foreground hover:opacity-90">Panier · {count}</Link>
          </div>
        </div>
        <nav className="border-t bg-secondary">
          <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto px-4 py-2 text-sm font-semibold text-secondary-foreground">
            {categories.map((c) => (
              <Link key={c.slug} to="/categorie/$" params={{ _splat: c.slug }} className="whitespace-nowrap hover:text-accent" activeProps={{ className: "text-accent" }}>{c.name}</Link>
            ))}
            <Link to="/magasins" className="ml-auto whitespace-nowrap hover:text-accent">Nos magasins</Link>
            <Link to="/faq" className="whitespace-nowrap hover:text-accent">Aide</Link>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="mt-16 bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm md:grid-cols-4">
          <div><p className="font-display text-xl font-bold">Marinéo</p><p className="mt-2 opacity-75">L'équipement de la mer, pour la pêche, le bateau et la plongée.</p></div>
          <div><p className="font-semibold">Boutique</p><ul className="mt-2 space-y-1 opacity-75">{categories.map((c) => <li key={c.slug}><Link to="/categorie/$" params={{ _splat: c.slug }}>{c.name}</Link></li>)}</ul></div>
          <div><p className="font-semibold">Service client</p><ul className="mt-2 space-y-1 opacity-75">
            <li><Link to="/faq">FAQ</Link></li><li><Link to="/livraison">Livraison</Link></li><li><Link to="/retours">Retours</Link></li><li><Link to="/magasins">Nos magasins</Link></li>
          </ul></div>
          <div><p className="font-semibold">Infos</p><ul className="mt-2 space-y-1 opacity-75">
            <li><Link to="/cgv">CGV</Link></li><li><Link to="/fidelite">Programme fidélité</Link></li>
          </ul></div>
        </div>
      </footer>
      <ChatWidget />
    </div>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const { addToCart } = useStore();
  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border bg-card transition hover:shadow-lg">
      <Link to="/produit/$id" params={{ id: p.id }} className="relative block aspect-square overflow-hidden bg-muted">
        <img src={productImage(p)} alt={p.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
        {p.oldPrice && <span className="absolute left-2 top-2 rounded bg-destructive px-2 py-0.5 text-xs font-bold text-destructive-foreground">-{Math.round((1 - p.price / p.oldPrice) * 100)}%</span>}
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{p.brand}</p>
        <Link to="/produit/$id" params={{ id: p.id }} className="mt-1 font-semibold leading-snug hover:text-accent">{p.name}</Link>
        <div className="mt-auto flex items-end justify-between pt-3">
          <div><span className="text-lg font-bold text-primary">{euro(p.price)}</span>{p.oldPrice && <span className="ml-2 text-xs text-muted-foreground line-through">{euro(p.oldPrice)}</span>}</div>
          <button onClick={() => addToCart(p.id)} className="rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground hover:opacity-90">Ajouter</button>
        </div>
      </div>
    </div>
  );
}

const statusTone: Record<Status, string> = {
  "En préparation": "bg-muted text-foreground",
  "Expédiée": "bg-secondary text-secondary-foreground",
  "En transit": "bg-accent/20 text-accent",
  "Livrée": "bg-success/20 text-success",
  "Retournée": "bg-chart-4/30 text-foreground",
  "Annulée": "bg-destructive/15 text-destructive",
};
export const StatusBadge = ({ s }: { s: Status }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusTone[s]}`}>{s}</span>;
export function productName(id: string) {
  return products.find((p) => p.id === id)?.name ?? id;
}
