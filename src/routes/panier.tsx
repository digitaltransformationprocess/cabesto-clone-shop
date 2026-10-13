import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { euro, productImage, products } from "@/lib/data";
import { shippingCost, SHIPPING_FREE_FROM, useStore, type Address } from "@/lib/store";

export const Route = createFileRoute("/panier")({
  head: () => ({ meta: [
    { title: "Mon panier — Marinéo" }, { name: "description", content: "Votre panier et la validation de commande." },
    { property: "og:title", content: "Mon panier — Marinéo" }, { property: "og:description", content: "Panier et paiement." },
  ] }),
  component: Cart,
});

const carriers = ["Colissimo", "Chronopost", "Mondial Relay", "Retrait magasin"];

function Cart() {
  const { cart, setQty, user, placeOrder, profile } = useStore();
  const nav = useNavigate();
  const lines = Object.entries(cart)
    .map(([id, qty]) => ({ p: products.find((x) => x.id === id), qty }))
    .filter((l): l is { p: (typeof products)[number]; qty: number } => Boolean(l.p));
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const [carrier, setCarrier] = useState<string>(carriers[0]!);
  const ship = shippingCost(subtotal, carrier);
  const [addr, setAddr] = useState<Address>(profile.shipping ?? { name: user?.name ?? "", street: "", zip: "", city: "", phone: "" });
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState("");

  if (done) return <Layout><div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="font-display text-3xl font-extrabold text-primary">Merci !</h1><p className="mt-3">Votre commande <b>{done}</b> est en préparation.</p><Link to="/compte" className="mt-6 inline-block rounded-md bg-primary px-5 py-2 font-bold text-primary-foreground">Suivre mes commandes</Link></div></Layout>;

  const submit = () => {
    if (!user) return nav({ to: "/connexion" });
    if (carrier !== "Retrait magasin" && (!addr.street || !addr.zip || !addr.city)) return setErr("Adresse de livraison incomplète");
    const o = placeOrder(carrier, addr);
    if (o) setDone(o.id);
  };

  return (
    <Layout>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-4xl font-extrabold text-primary">Mon panier</h1>
        {lines.length === 0 ? (
          <p className="mt-6">Votre panier est vide. <Link to="/" className="text-accent underline">Continuer mes achats</Link></p>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
            <ul className="divide-y rounded-lg border bg-card">
              {lines.map(({ p, qty }) => (
                <li key={p.id} className="flex items-center gap-4 p-4">
                  <img src={productImage(p)} alt={p.name} className="h-20 w-20 rounded object-cover" />
                  <div className="flex-1"><p className="text-xs uppercase text-muted-foreground">{p.brand}</p><Link to="/produit/$id" params={{ id: p.id }} className="font-semibold hover:text-accent">{p.name}</Link><p className="text-sm">{euro(p.price)}</p></div>
                  <div className="flex items-center rounded border">
                    <button onClick={() => setQty(p.id, qty - 1)} className="px-3 py-1">−</button><span className="w-8 text-center">{qty}</span><button onClick={() => setQty(p.id, Math.min(qty + 1, p.stock))} className="px-3 py-1">+</button>
                  </div>
                  <p className="w-24 text-right font-bold">{euro(p.price * qty)}</p>
                  <button onClick={() => setQty(p.id, 0)} className="text-sm text-destructive">Retirer</button>
                </li>
              ))}
            </ul>
            <aside className="h-fit space-y-4 rounded-lg border bg-card p-5">
              <h2 className="text-lg font-bold">Livraison</h2>
              {carriers.map((c) => <label key={c} className="flex items-center justify-between text-sm"><span><input type="radio" checked={carrier === c} onChange={() => setCarrier(c)} className="mr-2" />{c}</span><span>{shippingCost(subtotal, c) === 0 ? "Offert" : euro(shippingCost(subtotal, c))}</span></label>)}
              {carrier !== "Retrait magasin" && user && (
                <div className="grid gap-2">
                  {(["name", "street", "zip", "city", "phone"] as const).map((k) => <input key={k} value={addr[k]} onChange={(e) => setAddr({ ...addr, [k]: e.target.value })} placeholder={{ name: "Nom", street: "Adresse", zip: "Code postal", city: "Ville", phone: "Téléphone" }[k]} className="rounded border px-3 py-1.5 text-sm" />)}
                </div>
              )}
              {subtotal < SHIPPING_FREE_FROM && <p className="text-xs text-accent">Plus que {euro(SHIPPING_FREE_FROM - subtotal)} pour la livraison offerte</p>}
              <div className="space-y-1 border-t pt-3 text-sm">
                <p className="flex justify-between"><span>Sous-total</span><span>{euro(subtotal)}</span></p>
                <p className="flex justify-between"><span>Livraison</span><span>{ship === 0 ? "Offert" : euro(ship)}</span></p>
                <p className="flex justify-between text-lg font-bold"><span>Total TTC</span><span>{euro(subtotal + ship)}</span></p>
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <button onClick={submit} className="w-full rounded-md bg-accent py-3 font-bold text-accent-foreground">{user ? "Valider et payer (démo)" : "Se connecter pour commander"}</button>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
}
