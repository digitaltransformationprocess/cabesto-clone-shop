/**
 * Lightweight intent detection for chat guardrails (no LLM).
 * Account intents require an authenticated session (no OTP — site login).
 */

export type ChatIntent =
  | "product"
  | "delivery_info"
  | "returns_info"
  | "store"
  | "order_tracking"
  | "sav"
  | "handoff"
  | "general";

const ORDER_RE =
  /\b(mes\s+commandes|suivre\s+(ma\s+)?commande|suivi\s+de\s+commande|où\s+en\s+est\s+ma\s+commande|ou\s+en\s+est\s+ma\s+commande|tracking|num[eé]ro\s+de\s+commande|CMD\s*-?\s*\d+|statut\s+de\s+(ma\s+)?commande|colis\s+(en\s+retard|bloqu[eé]|perdu))\b/i;

const SAV_RE =
  /\b(r[eé]clamation|sav|garantie|endommag[eé]|cass[eé]|remboursement|ouvrir\s+un\s+ticket|cr[eé]er\s+un\s+ticket|probl[eè]me\s+avec\s+(ma|mon|une|la)|pas\s+re[cç]u|article\s+manqu(?:ant|e))\b/i;

/** Info pages — allowed anonymous */
const RETURNS_INFO_RE =
  /\b(comment\s+(faire|effectuer)\s+un\s+retour|politique\s+de\s+retour|d[eé]lai\s+de\s+retour|retourner\s+un\s+produit|conditions\s+de\s+retour)\b/i;

const DELIVERY_INFO_RE =
  /\b(d[eé]lais?\s+de\s+livraison|modes?\s+de\s+livraison|frais\s+de\s+port|livraison\s+express|chronopost|relais)\b/i;

const STORE_RE = /\b(magasin|magasins|boutique\s+physique|ouvrir\s+[aà]|horaires?\s+magasin)\b/i;

const HANDOFF_RE =
  /\b(parler\s+[aà]\s+(un\s+)?conseiller|conseiller\s+humain|agent\s+humain|service\s+client|joindre\s+un\s+humain)\b/i;

/** True when the user asks about their personal order / account — needs login */
export function requiresAuth(intent: ChatIntent): boolean {
  return intent === "order_tracking" || intent === "sav";
}

export function detectChatIntent(text: string): ChatIntent {
  const t = text.trim();
  if (!t) return "general";
  if (HANDOFF_RE.test(t)) return "handoff";
  // Info returns before SAV (anonymous FAQ)
  if (RETURNS_INFO_RE.test(t) && !SAV_RE.test(t)) return "returns_info";
  if (SAV_RE.test(t)) return "sav";
  if (ORDER_RE.test(t) && !DELIVERY_INFO_RE.test(t)) return "order_tracking";
  if (DELIVERY_INFO_RE.test(t)) return "delivery_info";
  if (STORE_RE.test(t)) return "store";
  return "product";
}

export const LOGIN_REQUIRED_REPLY =
  "Cette action concerne votre **compte** (commande ou SAV). Connectez-vous pour continuer — le catalogue, la livraison et les infos retours restent disponibles sans compte.";

export const HANDOFF_REPLY =
  "Je vous oriente vers un conseiller. Un résumé de l'échange sera joint au ticket pour que vous n'ayez pas à vous répéter.";
