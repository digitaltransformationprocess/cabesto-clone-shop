/**
 * Conversation flow memory (client-side) for multi-turn SAV / order context.
 * Complements message history sent to the LLM.
 */

import type { SessionOrder } from "./account-assist";

export type SavStep = "idle" | "need_order" | "need_issue" | "need_details" | "ready";

export type SavIssue =
  | "endommagé"
  | "pas_reçu"
  | "retard"
  | "retour"
  | "autre";

export type SavFlow = {
  step: SavStep;
  orderId?: string;
  orderStatus?: string;
  issue?: SavIssue;
  details?: string;
};

export type ConversationMemory = {
  /** Last detected intent that opened a guided flow */
  activeFlow: "none" | "sav" | "tracking";
  sav: SavFlow;
  /** Last order id mentioned in the conversation */
  lastOrderId?: string;
};

export const emptyMemory = (): ConversationMemory => ({
  activeFlow: "none",
  sav: { step: "idle" },
});

/** Normalize "CMD 1098" / "cmd1098" / "CMD-1098" → "CMD-1098" */
export function parseOrderId(text: string): string | null {
  const m = text.match(/\bCMD\s*-?\s*(\d+)\b/i);
  if (!m?.[1]) return null;
  return `CMD-${m[1]}`;
}

/** True if the whole message is essentially just an order id */
export function isMostlyOrderId(text: string): boolean {
  const t = text.trim();
  if (!parseOrderId(t)) return false;
  return /^CMD\s*-?\s*\d+\.?$/i.test(t) || /^n[°o]?\s*CMD\s*-?\s*\d+\.?$/i.test(t);
}

export const SAV_ISSUE_OPTIONS: { id: SavIssue; label: string }[] = [
  { id: "endommagé", label: "Article endommagé" },
  { id: "pas_reçu", label: "Pas reçu / perdu" },
  { id: "retard", label: "Retard de livraison" },
  { id: "retour", label: "Demande de retour" },
  { id: "autre", label: "Autre problème" },
];

export function detectSavIssue(text: string): SavIssue | null {
  const t = text.toLowerCase();
  if (/endommag|cass[eé]|ab[iî]m[eé]|cassé/.test(t)) return "endommagé";
  if (/pas\s+re[cç]u|jamais\s+re[cç]u|perdu|manquant|absent/.test(t)) return "pas_reçu";
  if (/retard|en\s+retard|bloqu[eé]|lent/.test(t)) return "retard";
  if (/retour|r[eé]tract|échanger|echange/.test(t)) return "retour";
  if (/autre|autre\s+chose|différent/.test(t)) return "autre";
  return null;
}

export function issueLabel(issue: SavIssue): string {
  return SAV_ISSUE_OPTIONS.find((o) => o.id === issue)?.label ?? issue;
}

export function findOrder(
  orders: SessionOrder[],
  orderId: string,
): SessionOrder | undefined {
  const id = orderId.toUpperCase();
  return orders.find((o) => o.id.toUpperCase() === id);
}

export function formatSavOrderCard(order: SessionOrder): string {
  return `**Commande ${order.id}** trouvée\n- Date : ${order.date}\n- Statut : **${order.status}**\n- Transporteur : ${order.carrier}\n- Articles : ${order.itemCount}`;
}

export function buildTicketDraft(flow: SavFlow, userName: string): {
  subject: string;
  message: string;
} {
  const issue = flow.issue ? issueLabel(flow.issue) : "Réclamation";
  const subject = flow.orderId ? `${issue} — ${flow.orderId}` : issue;
  const parts = [
    `Client : ${userName}`,
    flow.orderId ? `Commande : ${flow.orderId}` : null,
    flow.orderStatus ? `Statut commande : ${flow.orderStatus}` : null,
    `Motif : ${issue}`,
    flow.details ? `Détails : ${flow.details}` : null,
  ].filter(Boolean);
  return { subject: subject.slice(0, 120), message: parts.join("\n").slice(0, 2000) };
}
