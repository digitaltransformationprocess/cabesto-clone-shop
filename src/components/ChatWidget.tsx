import { useEffect, useRef, useState } from "react";
import { chatWithAi } from "@/lib/chat.functions";
import { categories, euro, orderTotal, products } from "@/lib/data";
import { shippingCost, SHIPPING_FREE_FROM, useStore } from "@/lib/store";

type Msg = { role: "user" | "assistant"; content: string };
const quick = ["Trouver un produit", "Suivre ma commande", "Retourner un article", "Délais de livraison"];

function render(text: string) {
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g).map((p, j) => {
      const l = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (l) return <a key={j} href={l[2]} className="font-semibold text-accent underline">{l[1]}</a>;
      const b = p.match(/^\*\*([^*]+)\*\*$/);
      return b ? <b key={j}>{b[1]}</b> : p;
    });
    return <p key={i} className={line.trim().startsWith("-") || line.trim().startsWith("*") ? "pl-2" : ""}>{parts}</p>;
  });
}

export function ChatWidget() {
  const { user, orders, cart } = useStore();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  const context = () => {
    const cat = products
      .filter((p) => p.stock > 0)
      .slice(0, 60)
      .map((p) => `- ${p.id} | ${p.name} | ${p.brand} | ${categories.find((c) => c.slug === p.category)?.name ?? p.category} | ${euro(p.price)} | stock ${p.stock}`)
      .join("\n");
    const mine = user ? orders.filter((o) => o.email === user.email) : [];
    const ord = mine.map((o) => `- ${o.id} du ${o.date} | statut ${o.status} | ${o.carrier}${["Expédiée", "En transit", "Livrée"].includes(o.status) ? ` | suivi ${o.carrier.slice(0, 2).toUpperCase()}${o.id.replace("CMD-", "")}FR` : ""} | total ${euro(orderTotal(o))} | articles : ${o.items.map((i) => `${i.qty}× ${products.find((p) => p.id === i.id)?.name}`).join(", ")}`).join("\n");
    const cartTxt = Object.entries(cart).map(([id, q]) => `${q}× ${products.find((p) => p.id === id)?.name}`).join(", ") || "vide";
    return `## Client\n${user ? `${user.name} (${user.email}), connecté` : "Visiteur non connecté (pour les commandes, l'inviter à se connecter via /connexion)"}\nPanier : ${cartTxt}\nFrais de port : gratuits dès ${SHIPPING_FREE_FROM} €, sinon Colissimo ${euro(shippingCost(0, "Colissimo"))}, Chronopost ${euro(shippingCost(0, "Chronopost"))}, retrait magasin gratuit.\n\n## Commandes du client\n${ord || "aucune"}\n\n## Catalogue (extrait stock — id | nom | marque | catégorie | prix | stock)\n${cat}`;
  };

  const ask = async (text: string) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user" as const, content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      // Appel direct (sans useServerFn) pour éviter qu'une erreur serveur
      // ne remonte jusqu'à l'error boundary de la page (vu hors navigateur Cursor).
      const r = await chatWithAi({ messages: next, context: context() });
      setMsgs([...next, { role: "assistant", content: r.ok ? r.reply : `⚠️ ${r.reply}` }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMsgs([
        ...next,
        {
          role: "assistant",
          content: `⚠️ Impossible de joindre l'assistant (${msg}). Vérifie AI_API_KEY dans .env, puis Ctrl+Shift+R.`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[560px] max-h-[75vh] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div><p className="font-display font-bold">Capitaine Marinéo ⚓</p><p className="text-xs opacity-80">{user ? `Bonjour ${user.name.split(" ")[0]}` : "Assistant boutique"}</p></div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="text-xl">×</button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {msgs.length === 0 && (
              <div>
                <p className="rounded-lg bg-muted p-3">Bonjour ! Je peux vous aider à trouver un produit, suivre une commande ou organiser un retour.</p>
                <div className="mt-3 flex flex-wrap gap-2">{quick.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-full border border-accent px-3 py-1 text-xs font-semibold text-accent hover:bg-accent hover:text-accent-foreground">{q}</button>)}</div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "ml-8 rounded-lg bg-primary p-3 text-primary-foreground" : "mr-4 space-y-1"}>{m.role === "user" ? m.content : render(m.content)}</div>
            ))}
            {busy && <p className="animate-pulse text-muted-foreground">L'assistant écrit…</p>}
            <div ref={end} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t p-3">
            <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Votre question…" className="flex-1 rounded-full border bg-muted px-4 py-2 text-sm" />
            <button disabled={busy} className="rounded-full bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-50">Envoyer</button>
          </form>
        </div>
      )}
      <button onClick={() => setOpen(!open)} aria-label="Assistant" className="fixed bottom-4 right-4 z-50 grid h-16 w-16 place-items-center rounded-full bg-accent text-2xl text-accent-foreground shadow-xl">{open ? "×" : "💬"}</button>
    </>
  );
}
