import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { infoHead } from "@/components/InfoPage";
import stores from "@/content/stores.json";

type Store = { name: string; address: string; city: string; phone: string; universes: string[]; hours: string; lat: number | null; lng: number | null };
const all = stores as Store[];
const universes = ["Nautisme", "Pêche", "Plongée", "Glisse", "Textile", "Montagne", "Alimentation", "Piscine"];

export const Route = createFileRoute("/magasins")({
  head: infoHead("Nos magasins", "Trouvez le magasin le plus proche : adresses, horaires, univers et carte."),
  component: Stores,
});

function Stores() {
  const [q, setQ] = useState("");
  const [u, setU] = useState("");
  const list = all.filter((s) => (!u || s.universes.includes(u)) && `${s.name} ${s.city}`.toLowerCase().includes(q.toLowerCase()));
  const [sel, setSel] = useState<Store>(all[0]!);
  const d = 0.02;
  const map = sel.lat ? `https://www.openstreetmap.org/export/embed.html?bbox=${sel.lng! - d},${sel.lat - d},${sel.lng! + d},${sel.lat + d}&layer=mapnik&marker=${sel.lat},${sel.lng}` : "";
  return (
    <Layout>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <h1 className="font-display text-4xl font-extrabold text-primary">Nos magasins</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">Chacun de nos magasins est pensé autour d'un univers. Nos équipes seront ravies de vous accueillir.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ville, magasin…" className="rounded-md border bg-card px-3 py-2" />
          <select value={u} onChange={(e) => setU(e.target.value)} className="rounded-md border bg-card px-3 py-2">
            <option value="">Tous les univers</option>{universes.map((x) => <option key={x}>{x}</option>)}
          </select>
          <span className="self-center text-sm text-muted-foreground">{list.length} magasins</span>
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
          <ul className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
            {list.map((s) => (
              <li key={s.name}>
                <button onClick={() => setSel(s)} className={`w-full rounded-lg border bg-card p-4 text-left hover:border-accent ${sel.name === s.name ? "border-accent ring-1 ring-accent" : ""}`}>
                  <p className="font-bold text-primary">{s.name}</p>
                  <p className="text-sm">{s.address}, {s.city}</p>
                  {s.phone && <p className="text-sm text-muted-foreground">{s.phone}</p>}
                  {s.hours && <p className="mt-1 text-xs"><b>Horaires :</b> {s.hours}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">{s.universes.map((x) => <span key={x} className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{x}</span>)}</div>
                </button>
              </li>
            ))}
          </ul>
          <div className="sticky top-32 h-[600px] overflow-hidden rounded-lg border bg-muted">
            {map ? <iframe title={sel.name} src={map} className="h-full w-full" /> : <p className="p-6">Carte indisponible</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
