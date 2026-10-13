import { createFileRoute, notFound } from "@tanstack/react-router";
import { Layout, ProductCard } from "@/components/Layout";
import { categories, products } from "@/lib/data";

export const Route = createFileRoute("/categorie/$slug")({
  loader: ({ params }) => { const c = categories.find((x) => x.slug === params.slug); if (!c) throw notFound(); return c; },
  head: ({ loaderData }) => ({ meta: [
    { title: `${loaderData?.name} — Marinéo` },
    { name: "description", content: `${loaderData?.name} : ${loaderData?.tagline}.` },
    { property: "og:title", content: `${loaderData?.name} — Marinéo` },
    { property: "og:description", content: `${loaderData?.tagline}.` },
  ] }),
  component: Cat,
});

function Cat() {
  const c = Route.useLoaderData();
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="font-display text-4xl font-extrabold text-primary">{c.name}</h1>
        <p className="mt-1 text-muted-foreground">{c.tagline}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">{products.filter((p) => p.category === c.slug).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </div>
    </Layout>
  );
}
