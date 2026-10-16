import type { Order, Status } from "@/lib/data";
import type { Ticket } from "@/lib/store";

function parseOrderIdLocal(text: string): string | null {
  const m = text.match(/\bCMD\s*-?\s*(\d+)\b/i);
  return m?.[1] ? `CMD-${m[1]}` : null;
}

export type SessionOrder = {
  id: string;
  date: string;
  status: Status;
  carrier: string;
  itemCount: number;
  trackingCode?: string;
  trackingUrl?: string;
  etaWindow?: string;
  lastEvent?: string;
};

export type SessionTicket = {
  id: string;
  subject: string;
  status: string;
  date: string;
  priority?: string;
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

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

function formatFrDay(d: Date): string {
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

/** Derive demo tracking code / URL / ETA from order fields. */
export function enrichOrderTracking(o: Order): Pick<
  SessionOrder,
  "trackingCode" | "trackingUrl" | "etaWindow" | "lastEvent"
> {
  const code =
    o.trackingCode ||
    `${o.carrier.slice(0, 2).toUpperCase()}${o.id.replace(/\D/g, "")}FR`;
  const shipped = ["Expédiée", "En transit", "Livrée"].includes(o.status);
  const ordered = new Date(o.date);
  const base = Number.isNaN(ordered.getTime()) ? new Date() : ordered;

  let etaWindow: string | undefined;
  let lastEvent: string | undefined;
  let trackingUrl: string | undefined;

  if (o.status === "En préparation") {
    etaWindow = "Expédition estimée sous 24 à 48 h ouvrées (donnée système de test)";
    lastEvent = "Commande prise en charge en entrepôt";
  } else if (o.status === "Expédiée" || o.status === "En transit") {
    const start = addBusinessDays(base, 2);
    const end = addBusinessDays(base, 4);
    etaWindow = `Livraison estimée : entre ${formatFrDay(start)} et ${formatFrDay(end)}`;
    lastEvent =
      o.status === "Expédiée"
        ? `Colis remis à ${o.carrier}`
        : `En cours d'acheminement chez ${o.carrier}`;
    trackingUrl = `https://suivi.demo/track/${encodeURIComponent(code)}`;
  } else if (o.status === "Livrée") {
    lastEvent = "Livraison déclarée effectuée";
    trackingUrl = `https://suivi.demo/track/${encodeURIComponent(code)}`;
  }

  return {
    ...(shipped || o.trackingCode ? { trackingCode: code } : {}),
    ...(trackingUrl ? { trackingUrl } : {}),
    ...(etaWindow ? { etaWindow } : {}),
    ...(lastEvent ? { lastEvent } : {}),
  };
}

/** Anomaly hints from status + order age (POC thresholds, demo). */
export function trackingAnomalyHint(order: SessionOrder): string {
  const ordered = new Date(order.date);
  const ageDays = Number.isNaN(ordered.getTime())
    ? 0
    : Math.floor((Date.now() - ordered.getTime()) / (24 * 3600 * 1000));

  if (order.status === "En transit" && ageDays >= 5) {
    return "\n\n**Anomalie possible** : aucun nouvel événement significatif depuis plusieurs jours (seuil démo 48 h / âge). Je peux ouvrir un ticket de suivi transporteur.";
  }
  if (order.status === "Expédiée" && ageDays >= 6) {
    return "\n\n**Retard possible** : la fenêtre estimée semble dépassée. Souhaitez-vous ouvrir une demande ?";
  }
  if (order.status === "Livrée") {
    return "\n\nColis déclaré livré mais absent ou endommagé ? Décrivez le souci et je crée un ticket prioritaire.";
  }
  if (order.status === "En transit") {
    return "\n\nSi le suivi n'évolue plus depuis 48 h, je peux ouvrir un ticket SAV.";
  }
  return "";
}

export function ordersToSession(orders: Order[], email: string): SessionOrder[] {
  return orders
    .filter((o) => o.email === email)
    .slice(0, 8)
    .map((o) => {
      const extra = enrichOrderTracking(o);
      return {
        id: o.id,
        date: o.date,
        status: o.status,
        carrier: o.carrier,
        itemCount: o.items.reduce((s, i) => s + i.qty, 0),
        ...extra,
      };
    });
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
      ...(t.priority ? { priority: t.priority } : {}),
    }));
}

export function formatOrdersForPrompt(orders: SessionOrder[]): string {
  if (!orders.length) return "(aucune commande sur ce compte)";
  return orders
    .map((o) => {
      const bits = [
        o.id,
        o.date,
        o.status,
        o.carrier,
        `${o.itemCount} article(s)`,
        o.trackingCode ? `suivi=${o.trackingCode}` : null,
        o.etaWindow ? `eta=${o.etaWindow}` : null,
      ].filter(Boolean);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");
}

export function formatTicketsForPrompt(tickets: SessionTicket[]): string {
  if (!tickets.length) return "(aucun ticket SAV)";
  return tickets
    .map(
      (t) =>
        `- ${t.id} | ${t.date} | ${t.status}${t.priority ? ` | ${t.priority}` : ""} | ${t.subject}`,
    )
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

  const normalized = parseOrderIdLocal(userMessage);

  const pick =
    (normalized && orders.find((o) => o.id.toUpperCase() === normalized)) || null;

  if (pick) {
    const help = STATUS_HELP[pick.status] ?? "";
    const lines = [
      `**Commande ${pick.id}**`,
      `- Date : ${pick.date}`,
      `- Statut : **${pick.status}** — ${help}`,
      `- Transporteur : ${pick.carrier}`,
      `- Articles : ${pick.itemCount}`,
    ];
    if (pick.lastEvent) lines.push(`- Dernier événement : ${pick.lastEvent}`);
    if (pick.etaWindow) lines.push(`- ${pick.etaWindow}`);
    if (pick.trackingCode) {
      lines.push(`- N° de suivi : **${pick.trackingCode}**`);
    }
    if (pick.trackingUrl) {
      lines.push(`- Lien de suivi (démo) : [suivre mon colis](${pick.trackingUrl})`);
    }
    lines.push("", "[Voir mon compte](/compte)");
    return lines.join("\n") + trackingAnomalyHint(pick);
  }

  const list = orders
    .slice(0, 5)
    .map((o) => {
      const eta = o.etaWindow ? ` · ${o.etaWindow.replace(/^Livraison estimée : /i, "")}` : "";
      return `- **${o.id}** (${o.date}) — ${o.status}${eta}`;
    })
    .join("\n");
  const example = orders[0]?.id ?? "CMD-1101";
  return `Voici vos commandes récentes :\n\n${list}\n\nIndiquez un numéro (ex. ${example}) pour le détail, le n° de suivi et la fenêtre estimée, ou ouvrez [Mon compte](/compte).`;
}

export function buildSavPromptHint(userMessage: string): string {
  return `Le client veut une aide SAV / réclamation. Message : « ${userMessage.slice(0, 400)} ».
Demande le motif en une phrase si besoin, puis propose de créer un ticket.
Ne promets jamais de remboursement. Si tu as assez d'info, indique clairement :
[CREER_TICKET] sujet | description
(une seule ligne, sujet court, description détaillée).`;
}
