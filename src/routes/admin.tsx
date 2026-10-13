import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout, StatusBadge, productName } from "@/components/Layout";
import { euro, orderTotal, products, statuses, testUsers, type Status } from "@/lib/data";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Back-office — Marinéo" }, { name: "description", content: "Gestion des commandes et du catalogue." },
    { property: "og:title", content: "Back-office — Marinéo" }, { property: "og:description", content: "Espace employé et admin." },
  ] }),
  component: Admin,
});

function Admin() {
  const { user, orders, setStatus } = useStore();
  if (!user || user.role === "client") return <Layout><p className="p-10 text-center">Accès réservé. <Link to="/connexion" className="text-accent underline">Se connecter</Link></p></Layout>;
  const isAdmin = user.role === "admin";
  const revenue = orders.filter((o) => o.status !== "Annulée").reduce((s, o) => s + orderTotal(o), 0);
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-primary">Back-office <span className="text-base font-medium text-muted-foreground">({user.role})</span></h1>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[["Commandes", orders.length], ["À expédier", orders.filter((o) => o.status === "En préparation").length], ["En livraison", orders.filter((o) => ["Expédiée", "En transit"].includes(o.status)).length], ...(isAdmin ? [["Chiffre d'affaires", euro(revenue)]] : [])].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-bold text-primary">{v}</p></div>
          ))}
        </div>
        <h2 className="mt-10 text-lg font-bold">Commandes</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left"><tr>{["N°", "Client", "Date", "Articles", "Total", "Statut", "Modifier"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
            <tbody>{orders.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-semibold">{o.id}</td><td className="p-3">{o.customer}</td>
                <td className="p-3">{new Date(o.date).toLocaleDateString("fr-FR")}</td>
                <td className="p-3 text-muted-foreground">{o.items.map((i) => `${i.qty}× ${productName(i.id)}`).join(", ")}</td>
                <td className="p-3 font-bold">{euro(orderTotal(o))}</td><td className="p-3"><StatusBadge s={o.status} /></td>
                <td className="p-3"><select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as Status)} className="rounded border bg-background px-2 py-1">{statuses.map((s) => <option key={s}>{s}</option>)}</select></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        {isAdmin && (
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div><h2 className="text-lg font-bold">Stock produits</h2><ul className="mt-3 divide-y rounded-lg border bg-card">{products.map((p) => <li key={p.id} className="flex justify-between p-3 text-sm"><span>{p.name}</span><span className={p.stock < 8 ? "font-bold text-destructive" : ""}>{p.stock}</span></li>)}</ul></div>
            <div><h2 className="text-lg font-bold">Utilisateurs</h2><ul className="mt-3 divide-y rounded-lg border bg-card">{testUsers.map((u) => <li key={u.email} className="flex justify-between p-3 text-sm"><span>{u.name} · {u.email}</span><span className="capitalize text-muted-foreground">{u.role}</span></li>)}</ul></div>
          </div>
        )}
      </div>
    </Layout>
  );
}
