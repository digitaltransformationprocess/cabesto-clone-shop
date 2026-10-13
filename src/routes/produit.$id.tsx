import { createFileRoute, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { euro, productImage, products } from "@/lib/data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/produit/$id")({
  loader: ({ params }) => { const p = products.find((x) => x.id === params.id); if (!p) throw notFound(); return p; },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.name} — Marinéo` },
    { name: "description", content: loaderData?.description ?? "" },
    { property: "og:title", content: `${loaderData?.name} — Marinéo` },
    { property: "og:description", content: loaderData?.description ?? "" },
  ] }),
  component: Prod,
});

function Prod() {
  const p = Route.useLoaderData();
  const { addToCart } = useStore();
  return (
    <Layout>
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 md:grid-cols-2">
        <img src={productImage(p)} alt={p.name} className="rounded-xl border" />
        <div>
          <p className="text-sm uppercase tracking-wide text-muted-foreground">{p.brand}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-primary">{p.name}</h1>
          <p className="mt-4 text-3xl font-bold">{euro(p.price)} {p.oldPrice && <span className="text-base text-muted-foreground line-through">{euro(p.oldPrice)}</span>}</p>
          <p className="mt-4 leading-relaxed">{p.description}</p>
          <p className={`mt-4 text-sm font-semibold ${p.stock < 8 ? "text-accent" : "text-success"}`}>{p.stock < 8 ? `Plus que ${p.stock} en stock` : "En stock — expédié sous 24 h"}</p>
          <button onClick={() => addToCart(p.id)} className="mt-6 w-full rounded-md bg-accent py-3 font-bold text-accent-foreground hover:opacity-90">Ajouter au panier</button>
        </div>
      </div>
    </Layout>
  );
}
