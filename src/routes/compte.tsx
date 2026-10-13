import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, StatusBadge, productName } from "@/components/Layout";
import { euro, orderTotal } from "@/lib/data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/compte")({
  head: () => ({ meta: [
    { title: "Mon compte — Marinéo" }, { name: "description", content: "Suivez vos commandes Marinéo." },
    { property: "og:title", content: "Mon compte — Marinéo" }, { property: "og:description", content: "Suivi de commandes." },
  ] }),
  component: Account,
});

function Account() {
  const { user, orders } = useStore();
  if (!user) return <Layout><p className="p-10 text-center">Veuillez vous <Link to="/connexion" className="text-accent underline">connecter</Link>.</p></Layout>;
  const mine = orders.filter((o) => o.email === user.email);
  return (
    <Layout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-primary">Bonjour {user.name}</h1>
        <h2 className="mt-8 text-lg font-bold">Mes commandes</h2>
        <div className="mt-4 space-y-3">
          {mine.length === 0 && <p className="text-muted-foreground">Aucune commande.</p>}
          {mine.map((o) => (
            <div key={o.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{o.id} <span className="text-sm font-normal text-muted-foreground">· {new Date(o.date).toLocaleDateString("fr-FR")} · {o.carrier}</span></p>
                <StatusBadge s={o.status} />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{o.items.map((i) => `${i.qty}× ${productName(i.id)}`).join(", ")}</p>
              <p className="mt-1 font-bold">{euro(orderTotal(o))}</p>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
