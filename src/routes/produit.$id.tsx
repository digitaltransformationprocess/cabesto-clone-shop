import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { categoryBreadcrumbs, euro, productImages, products } from "@/lib/data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/produit/$id")({
  loader: ({ params }) => {
    const p = products.find((x) => x.id === params.id);
    if (!p) throw notFound();
    return p;
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name} — Marinéo` },
      { name: "description", content: loaderData?.description ?? "" },
      { property: "og:title", content: `${loaderData?.name} — Marinéo` },
      { property: "og:description", content: loaderData?.description ?? "" },
    ],
  }),
  component: Prod,
});

function Prod() {
  const p = Route.useLoaderData();
  const { addToCart } = useStore();
  const imgs = productImages(p);
  const [active, setActive] = useState(0);
  const crumbs = categoryBreadcrumbs(p.categoryPath);

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <nav className="mb-6 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-accent">
            Accueil
          </Link>
          {crumbs.map((c) => (
            <span key={c.path.join("/")} className="flex items-center gap-1">
              <span>/</span>
              <Link to="/categorie/$" params={{ _splat: c.path.join("/") }} className="hover:text-accent">
                {c.name}
              </Link>
            </span>
          ))}
        </nav>

        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <div className="overflow-hidden rounded-xl border bg-muted">
              <img
                src={imgs[active] ?? p.cover}
                alt={p.name}
                className="aspect-square w-full object-contain bg-white"
              />
            </div>
            {imgs.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {imgs.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded border bg-white ${i === active ? "ring-2 ring-accent" : ""}`}
                  >
                    <img src={src} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-sm uppercase tracking-wide text-muted-foreground">{p.brand}</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold text-primary">{p.name}</h1>
            <p className="mt-2 text-xs text-muted-foreground">Réf. {p.id}</p>
            <p className="mt-4 text-3xl font-bold">
              {euro(p.price)}{" "}
              {p.oldPrice && <span className="text-base text-muted-foreground line-through">{euro(p.oldPrice)}</span>}
            </p>
            <p className="mt-4 leading-relaxed">{p.description}</p>
            <p className={`mt-4 text-sm font-semibold ${p.stock < 1 ? "text-destructive" : p.stock < 8 ? "text-accent" : "text-success"}`}>
              {p.stock < 1 ? "Rupture de stock" : p.stock < 8 ? `Plus que ${p.stock} en stock` : "En stock — expédié sous 24 h"}
            </p>
            <button
              disabled={p.stock < 1}
              onClick={() => addToCart(p.id)}
              className="mt-6 w-full rounded-md bg-accent py-3 font-bold text-accent-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {p.stock < 1 ? "Indisponible" : "Ajouter au panier"}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
