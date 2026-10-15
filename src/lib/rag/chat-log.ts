/**
 * Lightweight client-side chat analytics for POC KPI (localStorage).
 * Not a substitute for a real analytics pipeline.
 */

export type ChatLogEvent = {
  at: string;
  type:
    | "message"
    | "auth_blocked"
    | "add_to_cart"
    | "view_cart"
    | "checkout_start"
    | "order_placed"
    | "ticket_created"
    | "handoff"
    | "dont_know";
  intent?: string;
  detail?: string;
};

const KEY = "marineo-chat-log-v1";
const MAX = 200;

export function logChatEvent(
  type: ChatLogEvent["type"],
  extra?: { intent?: string; detail?: string },
): void {
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || "[]") as ChatLogEvent[];
    const row: ChatLogEvent = { at: new Date().toISOString(), type };
    if (extra?.intent) row.intent = extra.intent;
    if (extra?.detail) row.detail = extra.detail.slice(0, 120);
    const next = [row, ...(Array.isArray(prev) ? prev : [])].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function readChatLog(): ChatLogEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}
