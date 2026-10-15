import { euro, products } from "@/lib/data";
import { shippingCost, SHIPPING_FREE_FROM, type Address } from "@/lib/store";

export const CHAT_CARRIERS = ["Colissimo", "Chronopost", "Mondial Relay", "Retrait magasin"] as const;
export type ChatCarrier = (typeof CHAT_CARRIERS)[number];

export type CartLine = {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  stock: number;
};

export function cartLines(cart: Record<string, number>): CartLine[] {
  return Object.entries(cart)
    .map(([id, qty]) => {
      const p = products.find((x) => x.id === id);
      if (!p || qty <= 0) return null;
      return {
        id: p.id,
        name: p.name,
        qty,
        unitPrice: p.price,
        lineTotal: p.price * qty,
        stock: p.stock,
      };
    })
    .filter((l): l is CartLine => Boolean(l));
}

export function cartSubtotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.lineTotal, 0);
}

export function formatCartReply(
  cart: Record<string, number>,
  carrier: ChatCarrier = "Colissimo",
): string {
  const lines = cartLines(cart);
  if (!lines.length) {
    return "Votre panier est vide. Cherchez un produit, puis cliquez **Ajouter** sur une carte.";
  }
  const sub = cartSubtotal(lines);
  const ship = shippingCost(sub, carrier);
  const list = lines
    .map((l) => `- **${l.name}** × ${l.qty} — ${euro(l.lineTotal)}`)
    .join("\n");
  const freeHint =
    sub < SHIPPING_FREE_FROM
      ? `\nPlus que ${euro(SHIPPING_FREE_FROM - sub)} pour la livraison offerte.`
      : "";
  return `**Votre panier**\n${list}\n\nSous-total : **${euro(sub)}**\nLivraison (${carrier}) : **${ship === 0 ? "Offerte" : euro(ship)}**\nTotal : **${euro(sub + ship)}**${freeHint}\n\nDites **commander** pour valider (démo), ou [ouvrir le panier](/panier).`;
}

export function detectCartIntent(
  text: string,
): "view_cart" | "start_checkout" | "confirm_order" | "set_carrier" | null {
  const t = text.trim();
  if (/^(je\s+)?confirme\.?$/i.test(t) || /^oui[,.]?\s*je\s+confirme\.?$/i.test(t)) {
    return "confirm_order";
  }
  if (/\b(voir\s+(mon\s+)?panier|mon\s+panier|panier)\b/i.test(t) && !/\bcommander\b/i.test(t)) {
    return "view_cart";
  }
  if (/\b(commander|passer\s+(ma\s+)?commande|valider\s+(le\s+)?panier|checkout)\b/i.test(t)) {
    return "start_checkout";
  }
  if (/^(colissimo|chronopost|mondial\s*relay|retrait\s+magasin)$/i.test(t)) {
    return "set_carrier";
  }
  return null;
}

export function parseCarrier(text: string): ChatCarrier | null {
  const t = text.trim().toLowerCase();
  if (t.includes("chrono")) return "Chronopost";
  if (t.includes("mondial")) return "Mondial Relay";
  if (t.includes("retrait") || t.includes("magasin")) return "Retrait magasin";
  if (t.includes("colissimo") || t === "colissimo") return "Colissimo";
  return null;
}

export function defaultShippingAddress(
  userName: string,
  profileShipping?: Address,
): Address {
  return (
    profileShipping ?? {
      name: userName,
      street: "12 rue de la Mer",
      zip: "13008",
      city: "Marseille",
      phone: "0600000000",
    }
  );
}

export function formatCheckoutPrompt(
  cart: Record<string, number>,
  carrier: ChatCarrier,
  addr: Address,
): string {
  const lines = cartLines(cart);
  const sub = cartSubtotal(lines);
  const ship = shippingCost(sub, carrier);
  const list = lines.map((l) => `- ${l.name} × ${l.qty}`).join("\n");
  return `**Récapitulatif (démo)**\n${list}\n\nLivraison : **${carrier}**\nAdresse : ${addr.name}, ${addr.street}, ${addr.zip} ${addr.city}\nTotal TTC : **${euro(sub + ship)}**\n\nModes : ${CHAT_CARRIERS.join(" · ")}\n\nRépondez **Je confirme** pour créer la commande (paiement simulé), ou choisissez un autre mode de livraison.`;
}
