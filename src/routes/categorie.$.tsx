import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Layout, ProductCard } from "@/components/Layout";
import {
  categoryBreadcrumbs,
  categoryPathMatches,
  ensureCatalog,
  findCategoryByPath,
  type CategoryNode,
  type Product,
} from "@/lib/data";

function findInTree(tree: CategoryNode[], segments: string[]): CategoryNode | undefined {
  if (!segments.length) return undefined;
  let nodes = tree;
  let found: CategoryNode | undefined;
  for (const seg of segments) {
    found = nodes.find((n) => n.slug === seg);
    if (!found) return undefined;
    nodes = found.children;
  }
  return found;
}

export const Route = createFileRoute("/categorie/$")({
  loader: async ({ params }) => {
    const snap = await ensureCatalog();
    const segments = (params._splat || "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean);
    const node =
      findInTree(snap.categoryTree, segments) ?? findCategoryByPath(segments);
    if (!node) throw notFound();
    const list: Product[] = snap.products.filter((p) =>
      categoryPathMatches(p.categoryPath, node.path),
    );
    return { node, list, segments };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.node.name} — Marinéo` },
      { name: "description", content: `${loaderData?.node.name} : ${loaderData?.list.length ?? 0} produits.` },
      { property: "og:title", content: `${loaderData?.node.name} — Marinéo` },
      { property: "og:description", content: `${loaderData?.list.length ?? 0} produits.` },
    ],
  }),
  component: Cat,
});

function Cat() {
  const { node, list } = Route.useLoaderData();
  const crumbs = categoryBreadcrumbs(node.path);

  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-accent">
            Accueil
          </Link>
          {crumbs.map((c) => (
            <span key={c.path.join("/")} className="flex items-center gap-1">
              <span>/</span>
              <Link
                to="/categorie/$"
                params={{ _splat: c.path.join("/") }}
                className="hover:text-accent"
                activeOptions={{ exact: true }}
              >
                {c.name}
              </Link>
            </span>
          ))}
        </nav>

        <h1 className="font-display text-4xl font-extrabold text-primary">{node.name}</h1>
        <p className="mt-1 text-muted-foreground">
          {list.length} produit{list.length > 1 ? "s" : ""}
        </p>

        {node.children.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg font-bold text-primary">Sous-catégories</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {node.children.map((child) => (
                <Link
                  key={child.path.join("/")}
                  to="/categorie/$"
                  params={{ _splat: child.path.join("/") }}
                  className="rounded-full border bg-card px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
                >
                  {child.name}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">({child.productCount})</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
        {list.length === 0 && (
          <p className="mt-8 text-muted-foreground">Aucun produit dans cette catégorie pour le moment.</p>
        )}
      </div>
    </Layout>
  );
}
