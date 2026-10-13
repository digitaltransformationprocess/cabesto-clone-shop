import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Layout, StatusBadge, productName } from "@/components/Layout";
import { categories, euro, orderTotal, products, statuses, testUsers, type Status } from "@/lib/data";
import { useStore } from "@/lib/store";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { testAiConnection, type AiConfig } from "@/lib/chat.functions";
import { defaultModels, readAiConfig, saveAiConfig } from "@/lib/ai-config";

function AiSettings() {
  const test = useServerFn(testAiConnection);
  const [c, setC] = useState<AiConfig>({ provider: "google", apiKey: "", model: defaultModels.google });
  const [res, setRes] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { const r = readAiConfig(); if (r) setC(r); }, []);
  return (
    <div className="max-w-xl space-y-4 rounded-lg border bg-card p-6">
      <h2 className="text-2xl font-bold">Assistant IA</h2>
      <p className="text-sm text-muted-foreground">Connectez le chatbot client à Google Gemini ou OpenRouter.</p>
      <div className="flex gap-2">{(["google", "openrouter"] as const).map((p) => <button key={p} onClick={() => { setC({ ...c, provider: p, model: defaultModels[p] }); setRes(null); }} className={`rounded px-4 py-2 text-sm font-bold ${c.provider === p ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{p === "google" ? "Google Gemini" : "OpenRouter"}</button>)}</div>
      <label className="block text-sm font-semibold">Clé API<input type="password" value={c.apiKey} onChange={(e) => setC({ ...c, apiKey: e.target.value.trim() })} placeholder={c.provider === "google" ? "AIza… (aistudio.google.com/apikey)" : "sk-or-… (openrouter.ai/keys)"} className="mt-1 w-full rounded border px-3 py-2 font-normal" /></label>
      <label className="block text-sm font-semibold">Modèle<input value={c.model} onChange={(e) => setC({ ...c, model: e.target.value })} className="mt-1 w-full rounded border px-3 py-2 font-normal" /></label>
      <div className="flex gap-2">
        <button onClick={() => { saveAiConfig(c); setSaved(true); setTimeout(() => setSaved(false), 2000); }} className="rounded bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">{saved ? "Enregistré ✓" : "Enregistrer"}</button>
        <button disabled={busy || !c.apiKey} onClick={async () => { setBusy(true); setRes(null); try { setRes(await test({ data: c })); } catch (e) { setRes({ ok: false, message: (e as Error).message }); } setBusy(false); }} className="rounded bg-accent px-4 py-2 text-sm font-bold text-accent-foreground disabled:opacity-50">{busy ? "Test en cours…" : "Tester la connexion"}</button>
      </div>
      {res && <p className={`rounded p-3 text-sm ${res.ok ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{res.ok ? `✓ Connecté — réponse du modèle : « ${res.message} »` : `✗ Échec : ${res.message}`}</p>}
    </div>
  );
}

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [
    { title: "Back-office — Marinéo" }, { name: "description", content: "Gestion des commandes et du catalogue." },
    { property: "og:title", content: "Back-office — Marinéo" }, { property: "og:description", content: "Espace employé et admin." },
  ] }),
  component: Admin,
});

function Admin() {
  const { user, orders, setStatus, tickets, setTicketStatus } = useStore();
  const [tab, setTab] = useState("Tableau de bord");
  const [q, setQ] = useState(""); const [f, setF] = useState<Status | "">("");
  if (!user || user.role === "client") return <Layout><p className="p-10 text-center">Accès réservé. <Link to="/connexion" className="text-accent underline">Se connecter</Link></p></Layout>;
  const isAdmin = user.role === "admin";
  const tabs = ["Tableau de bord", "Commandes", "Support", ...(isAdmin ? ["Stock", "Clients", "Assistant IA"] : [])];
  const valid = orders.filter((o) => o.status !== "Annulée");
  const revenue = valid.reduce((s, o) => s + orderTotal(o), 0);
  const filtered = orders.filter((o) => (!f || o.status === f) && `${o.id} ${o.customer} ${o.email}`.toLowerCase().includes(q.toLowerCase()));
  const kpis: [string, string | number][] = [
    ["Commandes", orders.length], ["À préparer", orders.filter((o) => o.status === "En préparation").length],
    ["En livraison", orders.filter((o) => ["Expédiée", "En transit"].includes(o.status)).length], ["Tickets ouverts", tickets.filter((t) => t.status === "Ouvert").length],
    ...(isAdmin ? [["Chiffre d'affaires", euro(revenue)], ["Panier moyen", euro(revenue / (valid.length || 1))], ["Ruptures proches", products.filter((p) => p.stock < 8).length]] as [string, string | number][] : []),
  ];
  const byCat = categories.map((c) => ({ c: c.name, v: valid.reduce((s, o) => s + o.items.filter((i) => products.find((p) => p.id === i.id)!.category === c.slug).reduce((a, i) => a + products.find((p) => p.id === i.id)!.price * i.qty, 0), 0) }));
  const maxCat = Math.max(...byCat.map((b) => b.v), 1);

  const table = (list: typeof orders) => (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr>{["N°", "Client", "Date", "Articles", "Transporteur", "Total", "Statut", "Modifier"].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{list.map((o) => (
          <tr key={o.id} className="border-t">
            <td className="p-3 font-semibold">{o.id}</td><td className="p-3">{o.customer}<br /><span className="text-xs text-muted-foreground">{o.email}</span></td>
            <td className="p-3">{new Date(o.date).toLocaleDateString("fr-FR")}</td>
            <td className="p-3 text-muted-foreground">{o.items.map((i) => `${i.qty}× ${productName(i.id)}`).join(", ")}</td>
            <td className="p-3">{o.carrier}</td>
            <td className="p-3 font-bold">{euro(orderTotal(o))}</td><td className="p-3"><StatusBadge s={o.status} /></td>
            <td className="p-3"><select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as Status)} className="rounded border bg-background px-2 py-1">{statuses.map((s) => <option key={s}>{s}</option>)}</select></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );

  return (
    <Layout>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[220px_1fr]">
        <aside className="h-fit rounded-lg border bg-card p-4">
          <p className="font-display text-lg font-bold text-primary">Back-office</p>
          <p className="mb-4 text-xs capitalize text-muted-foreground">{user.name} · {user.role}</p>
          {tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={`block w-full rounded px-3 py-2 text-left text-sm ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{t}</button>)}
        </aside>
        <section className="space-y-6">
          <h1 className="font-display text-3xl font-extrabold text-primary">{tab}</h1>
          {tab === "Tableau de bord" && (<>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([k, v]) => <div key={k} className="rounded-lg border bg-card p-4"><p className="text-sm text-muted-foreground">{k}</p><p className="text-2xl font-bold text-primary">{v}</p></div>)}</div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-lg border bg-card p-4"><h2 className="font-bold">Répartition des statuts</h2>{statuses.map((s) => { const n = orders.filter((o) => o.status === s).length; return <div key={s} className="mt-2 flex items-center gap-2 text-sm"><span className="w-28">{s}</span><div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-accent" style={{ width: `${(n / orders.length) * 100}%` }} /></div><span>{n}</span></div>; })}</div>
              {isAdmin && <div className="rounded-lg border bg-card p-4"><h2 className="font-bold">Ventes par univers</h2>{byCat.map((b) => <div key={b.c} className="mt-2 flex items-center gap-2 text-sm"><span className="w-28">{b.c}</span><div className="h-2 flex-1 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${(b.v / maxCat) * 100}%` }} /></div><span>{euro(b.v)}</span></div>)}</div>}
            </div>
            <h2 className="text-lg font-bold">À préparer en priorité</h2>{table(orders.filter((o) => o.status === "En préparation"))}
          </>)}
          {tab === "Commandes" && (<>
            <div className="flex flex-wrap gap-3"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N°, client, e-mail…" className="rounded-md border bg-card px-3 py-2" />
              <select value={f} onChange={(e) => setF(e.target.value as Status | "")} className="rounded-md border bg-card px-3 py-2"><option value="">Tous les statuts</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
            {table(filtered)}
          </>)}
          {tab === "Support" && (<div className="space-y-3">{tickets.length === 0 && <p className="text-muted-foreground">Aucun ticket.</p>}{tickets.map((t) => <div key={t.id} className="flex items-start justify-between gap-4 rounded-lg border bg-card p-4"><div><p className="font-semibold">{t.id} · {t.subject}</p><p className="text-xs text-muted-foreground">{t.email} · {t.date}</p><p className="mt-1 text-sm">{t.message}</p></div><button onClick={() => setTicketStatus(t.id, t.status === "Ouvert" ? "Résolu" : "Ouvert")} className={`rounded px-3 py-1 text-xs font-bold ${t.status === "Ouvert" ? "bg-accent text-accent-foreground" : "bg-muted"}`}>{t.status}</button></div>)}</div>)}
          {tab === "Stock" && isAdmin && <ul className="divide-y rounded-lg border bg-card">{products.map((p) => <li key={p.id} className="flex justify-between p-3 text-sm"><span>{p.name} <span className="text-muted-foreground">· {p.brand} · {euro(p.price)}</span></span><span className={p.stock < 8 ? "font-bold text-destructive" : ""}>{p.stock} en stock</span></li>)}</ul>}
          {tab === "Assistant IA" && isAdmin && <AiSettings />}
          {tab === "Clients" && isAdmin && <ul className="divide-y rounded-lg border bg-card">{[...testUsers.map((u) => ({ n: u.name, e: u.email, r: u.role })), ...[...new Set(orders.map((o) => o.email))].filter((e) => !testUsers.some((u) => u.email === e)).map((e) => ({ n: orders.find((o) => o.email === e)!.customer, e, r: "client" }))].map((u) => <li key={u.e} className="flex justify-between p-3 text-sm"><span>{u.n} · {u.e}</span><span className="capitalize text-muted-foreground">{u.r} · {orders.filter((o) => o.email === u.e).length} cmd</span></li>)}</ul>}
        </section>
      </div>
    </Layout>
  );
}
