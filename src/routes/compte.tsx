import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Layout, StatusBadge, productName } from "@/components/Layout";
import { euro, orderTotal, statuses } from "@/lib/data";
import { useStore, type Address } from "@/lib/store";

export const Route = createFileRoute("/compte")({
  head: () => ({ meta: [
    { title: "Mon compte — Marinéo" }, { name: "description", content: "Tableau de bord client : commandes, adresses, support." },
    { property: "og:title", content: "Mon compte — Marinéo" }, { property: "og:description", content: "Suivi de commandes." },
  ] }),
  component: Account,
});

const tabs = ["Tableau de bord", "Informations du compte", "Carnet d'adresses", "Mes commandes", "Support Client"] as const;
type Tab = (typeof tabs)[number];
const empty: Address = { name: "", street: "", zip: "", city: "", phone: "" };

const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`rounded-lg border bg-card p-6 shadow-sm ${className}`}>{children}</div>;

function Account() {
  const { user, orders, logout, profile, updateProfile, tickets, addTicket } = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>("Tableau de bord");
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<"billing" | "shipping" | null>(null);
  const [form, setForm] = useState<Address>(empty);
  const [t, setT] = useState({ subject: "", message: "" });
  if (!user) return <Layout><p className="p-10 text-center">Veuillez vous <Link to="/connexion" className="text-accent underline">connecter</Link>.</p></Layout>;
  const mine = orders.filter((o) => o.email === user.email);
  const myTickets = tickets.filter((x) => x.email === user.email);

  const addrBlock = (k: "billing" | "shipping", label: string) => (
    <Card>
      <h3 className="text-lg font-semibold">{label}</h3>
      {edit === k ? (
        <form className="mt-3 grid gap-2" onSubmit={(e) => { e.preventDefault(); updateProfile({ [k]: form }); setEdit(null); }}>
          {(Object.keys(empty) as (keyof Address)[]).map((f) => <input key={f} required={f !== "phone"} value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} placeholder={{ name: "Nom", street: "Adresse", zip: "Code postal", city: "Ville", phone: "Téléphone" }[f]} className="rounded border px-3 py-1.5 text-sm" />)}
          <button className="rounded bg-primary py-1.5 text-sm font-bold text-primary-foreground">Enregistrer</button>
        </form>
      ) : (
        <>
          {profile[k] ? <p className="mt-3 text-sm leading-6">{profile[k]!.name}<br />{profile[k]!.street}<br />{profile[k]!.zip} {profile[k]!.city}<br />{profile[k]!.phone}</p> : <p className="mt-3 text-sm text-muted-foreground">Vous n'avez pas défini d'adresse par défaut.</p>}
          <button onClick={() => { setForm(profile[k] ?? { ...empty, name: user.name }); setEdit(k); }} className="mt-3 text-sm hover:text-accent">Modifier l'adresse →</button>
        </>
      )}
    </Card>
  );

  const ordersList = (list = mine) => (
    <div className="space-y-3">
      {list.length === 0 && <p className="text-muted-foreground">Aucune commande.</p>}
      {list.map((o) => {
        const step = Math.min(statuses.indexOf(o.status), 3);
        return (
          <Card key={o.id} className="p-4">
            <button onClick={() => setOpen(open === o.id ? null : o.id)} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
              <p className="font-semibold">{o.id} <span className="text-sm font-normal text-muted-foreground">· {new Date(o.date).toLocaleDateString("fr-FR")} · {o.carrier}</span></p>
              <span className="flex items-center gap-3"><b>{euro(orderTotal(o))}</b><StatusBadge s={o.status} /></span>
            </button>
            {open === o.id && (
              <div className="mt-4 border-t pt-4 text-sm">
                {!["Annulée", "Retournée"].includes(o.status) && (
                  <ol className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
                    {statuses.slice(0, 4).map((s, i) => <li key={s} className={`rounded py-1.5 ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{s}</li>)}
                  </ol>
                )}
                <ul className="space-y-1">{o.items.map((i) => <li key={i.id}>{i.qty}× {productName(i.id)}</li>)}</ul>
                {o.shipping && <p className="mt-2 text-muted-foreground">Livraison : {o.shipping.street}, {o.shipping.zip} {o.shipping.city}</p>}
                {["Expédiée", "En transit", "Livrée"].includes(o.status) && (
                  <p className="mt-2">
                    N° de suivi :{" "}
                    <b>{o.trackingCode || `${o.carrier.slice(0, 2).toUpperCase()}${o.id.replace("CMD-", "")}FR`}</b>
                  </p>
                )}
                {o.status === "Livrée" && <Link to="/retours" className="mt-2 inline-block text-accent underline">Retourner un article</Link>}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );

  return (
    <Layout>
      <div className="bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-10">
          <h1 className="text-center font-display text-5xl font-extrabold text-primary">Mon compte</h1>
          <div className="mt-10 grid gap-8 lg:grid-cols-[300px_1fr]">
            <aside className="h-fit rounded-lg border bg-card p-6 shadow-sm">
              <p className="border-b pb-4 text-xl">Mon compte</p>
              <ul className="mt-4 space-y-3">
                {tabs.map((x) => <li key={x}><button onClick={() => setTab(x)} className={tab === x ? "font-bold text-foreground" : "text-success hover:underline"}>{x}</button></li>)}
                <li><Link to="/panier" className="text-success hover:underline">Mon panier</Link></li>
                <li><button onClick={() => { logout(); nav({ to: "/" }); }} className="font-bold text-success">Me déconnecter</button></li>
              </ul>
            </aside>
            <section className="space-y-6">
              {(tab === "Tableau de bord" || tab === "Informations du compte") && (
                <>
                  <h2 className="text-3xl">Informations du compte</h2>
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card><div className="flex gap-5"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-muted text-2xl">👤</span><div><h3 className="text-lg font-semibold">Informations de contact</h3><p className="mt-2">{user.name}<br />{user.email}</p><p className="mt-3 text-sm">Modifier le mot de passe →</p></div></div></Card>
                    <Card><div className="flex gap-5"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-muted text-2xl">✉️</span><div><h3 className="text-lg font-semibold">Lettres d'information</h3><p className="mt-2">{profile.newsletter ? "Vous êtes inscrit à notre lettre d'informations." : "Vous n'êtes pas inscrit à notre lettre d'informations."}</p><button onClick={() => updateProfile({ newsletter: !profile.newsletter })} className="mt-3 text-sm hover:text-accent">{profile.newsletter ? "Se désinscrire" : "S'inscrire"} →</button></div></div></Card>
                  </div>
                </>
              )}
              {(tab === "Tableau de bord" || tab === "Carnet d'adresses") && (
                <>
                  <Card className="flex items-center justify-between py-4"><h2 className="text-3xl">Carnet d'adresses</h2></Card>
                  <div className="grid gap-6 md:grid-cols-2">{addrBlock("billing", "Adresse de facturation par défaut")}{addrBlock("shipping", "Adresse de livraison par défaut")}</div>
                </>
              )}
              {tab === "Tableau de bord" && (<><h2 className="text-3xl">Commandes récentes</h2>{ordersList(mine.slice(0, 3))}</>)}
              {tab === "Mes commandes" && (<><h2 className="text-3xl">Mes commandes</h2>{ordersList()}</>)}
              {tab === "Support Client" && (
                <>
                  <h2 className="text-3xl">Support Client</h2>
                  <Card>
                    <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); addTicket(t.subject, t.message); setT({ subject: "", message: "" }); }}>
                      <select required value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} className="rounded border px-3 py-2"><option value="">Motif…</option>{["Suivi de commande", "Retour / remboursement", "Produit défectueux", "Annulation de commande", "Autre"].map((x) => <option key={x}>{x}</option>)}</select>
                      <textarea required value={t.message} onChange={(e) => setT({ ...t, message: e.target.value })} placeholder="Votre message" rows={4} className="rounded border px-3 py-2" />
                      <button className="rounded bg-primary py-2 font-bold text-primary-foreground">Envoyer</button>
                    </form>
                  </Card>
                  {myTickets.map((x) => (
                    <Card key={x.id} className="p-4">
                      <p className="font-semibold">
                        {x.id} · {x.subject}{" "}
                        <span className="text-sm text-muted-foreground">({x.status})</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[x.priority, x.targetSla, x.orderId, x.channel].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{x.message}</p>
                    </Card>
                  ))}
                </>
              )}
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
