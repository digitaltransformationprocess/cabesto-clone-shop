import type { Order, Status } from "@/lib/data";
import type { Ticket } from "@/lib/store";

export type SessionOrder = {
  id: string;
  date: string;
  status: Status;
  carrier: string;
  itemCount: number;
};

export type SessionTicket = {
  id: string;
  subject: string;
  status: string;
  date: string;
};

export type ChatSessionPayload = {
  authenticated: boolean;
  userName?: string;
  email?: string;
  orders?: SessionOrder[];
  tickets?: SessionTicket[];
};

const STATUS_HELP: Record<Status, string> = {
  "En préparation": "Votre colis n'est pas encore expédié.",
  Expédiée: "Le colis a quitté l'entrepôt.",
  "En transit": "Le transporteur achemine votre colis.",
  Livrée: "Le transporteur indique une livraison effectuée.",
  Retournée: "La commande est en parcours de retour.",
  Annulée: "Cette commande a été annulée.",
};

export function ordersToSession(orders: Order[], email: string): SessionOrder[] {
  return orders
    .filter((o) => o.email === email)
    .slice(0, 8)
    .map((o) => ({
      id: o.id,
      date: o.date,
      status: o.status,
      carrier: o.carrier,
      itemCount: o.items.reduce((s, i) => s + i.qty, 0),
    }));
}

export function ticketsToSession(tickets: Ticket[], email: string): SessionTicket[] {
  return tickets
    .filter((t) => t.email === email)
    .slice(0, 5)
    .map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      date: t.date,
    }));
}

export function formatOrdersForPrompt(orders: SessionOrder[]): string {
  if (!orders.length) return "(aucune commande sur ce compte)";
  return orders
    .map(
      (o) =>
        `- ${o.id} | ${o.date} | ${o.status} | ${o.carrier} | ${o.itemCount} article(s)`,
    )
    .join("\n");
}

export function formatTicketsForPrompt(tickets: SessionTicket[]): string {
  if (!tickets.length) return "(aucun ticket SAV)";
  return tickets
    .map((t) => `- ${t.id} | ${t.date} | ${t.status} | ${t.subject}`)
    .join("\n");
}

/** Deterministic order-tracking reply (no LLM). */
export function buildOrderTrackingReply(
  orders: SessionOrder[],
  userMessage: string,
): string {
  if (!orders.length) {
    return "Je ne trouve aucune commande sur votre compte. Vous pouvez passer commande depuis le catalogue, ou [voir mon compte](/compte).";
  }

  const idMatch = userMessage.match(/\bCMD\s*-?\s*(\d+)\b/i);
  const normalized = idMatch?.[1] ? `CMD-${idMatch[1]}` : null;

  const pick =
    (normalized && orders.find((o) => o.id.toUpperCase() === normalized)) || null;

  if (pick) {
    const help = STATUS_HELP[pick.status] ?? "";
    const anomaly =
      pick.status === "En transit"
        ? "\n\nSi le suivi n'évolue plus depuis 48 h, je peux ouvrir un ticket SAV."
        : pick.status === "Livrée"
          ? "\n\nColis déclaré livré mais absent ? Décrivez le souci et je crée un ticket."
          : "";
    return `**Commande ${pick.id}**\n- Date : ${pick.date}\n- Statut : **${pick.status}** — ${help}\n- Transporteur : ${pick.carrier}\n- Articles : ${pick.itemCount}\n\n[Voir mon compte](/compte)${anomaly}`;
  }

  const list = orders
    .slice(0, 5)
    .map((o) => `- **${o.id}** (${o.date}) — ${o.status}`)
    .join("\n");
  const example = orders[0]?.id ?? "CMD-1001";
  return `Voici vos commandes récentes :\n\n${list}\n\nIndiquez un numéro (ex. ${example}) pour le détail, ou ouvrez [Mon compte](/compte).`;
}

export function buildSavPromptHint(userMessage: string): string {
  return `Le client veut une aide SAV / réclamation. Message : « ${userMessage.slice(0, 400)} ».
Demande le motif en une phrase si besoin, puis propose de créer un ticket.
Ne promets jamais de remboursement. Si tu as assez d'info, indique clairement :
[CREER_TICKET] sujet | description
(une seule ligne, sujet court, description détaillée).`;
}
