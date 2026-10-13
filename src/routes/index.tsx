import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, ProductCard } from "@/components/Layout";
import { categories, products } from "@/lib/data";
import hero from "@/assets/cat-nautisme.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Marinéo — Pêche, nautisme et plongée" },
    { name: "description", content: "Boutique d'équipement marin : pêche, nautisme, plongée et vêtements de mer." },
    { property: "og:title", content: "Marinéo — Pêche, nautisme et plongée" },
    { property: "og:description", content: "Boutique d'équipement marin : pêche, nautisme, plongée et vêtements de mer." },
  ] }),
  component: Index,
});

function Index() {
  return (
    <Layout>
      <section className="bg-hero text-primary-foreground">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <p className="font-semibold uppercase tracking-widest text-accent">Nouvelle saison</p>
            <h1 className="mt-3 font-display text-5xl font-extrabold leading-tight">Tout pour prendre le large.</h1>
            <p className="mt-4 max-w-md opacity-85">Plus de 1 000 références sélectionnées pour la pêche, le bateau et la plongée.</p>
            <Link to="/categorie/$slug" params={{ slug: "nautisme" }} className="mt-6 inline-block rounded-md bg-accent px-6 py-3 font-bold text-accent-foreground">Découvrir</Link>
          </div>
          <img src={hero} alt="Équipement nautique" className="rounded-xl shadow-2xl" />
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="font-display text-2xl font-bold text-primary">Nos univers</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {categories.map((c) => (
            <Link key={c.slug} to="/categorie/$slug" params={{ slug: c.slug }} className="group relative overflow-hidden rounded-lg">
              <img src={c.image} alt={c.name} className="aspect-[4/5] w-full object-cover transition group-hover:scale-105" />
              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-primary/90 to-transparent p-4 text-primary-foreground">
                <p className="font-display text-xl font-bold">{c.name}</p><p className="text-xs opacity-80">{c.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4">
        <h2 className="font-display text-2xl font-bold text-primary">Meilleures ventes</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">{products.filter((p) => p.oldPrice).concat(products.slice(0, 4)).slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>
    </Layout>
  );
}
