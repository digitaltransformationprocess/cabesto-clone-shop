import type { ChatSessionPayload } from "./account-assist";

export type ChatUiMessage = { role: "user" | "assistant"; content: string };

export type RagMetaProduct = {
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  similarity: number;
  imageUrl?: string;
};

export type StreamChatHandlers = {
  onMeta?: (products: RagMetaProduct[]) => void;
  onToken?: (text: string) => void;
  /** Replace the whole assistant buffer (e.g. after "Je ne sais pas" → catalog reply). */
  onReplace?: (text: string) => void;
  onDone?: () => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
  session?: ChatSessionPayload;
};

type SseEvent =
  | { type: "meta"; products: RagMetaProduct[] }
  | { type: "token"; text: string }
  | { type: "replace"; text: string }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Client-side consumer for POST /api/chat (SSE).
 * No API keys — only same-origin fetch.
 */
export async function streamRagChat(
  messages: ChatUiMessage[],
  handlers: StreamChatHandlers = {},
): Promise<void> {
  const cleanMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      messages: cleanMessages,
      filters: { inStockOnly: false, matchCount: 8 },
      session: handlers.session ?? { authenticated: false },
    }),
    ...(handlers.signal ? { signal: handlers.signal } : {}),
  });

  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      /* ignore */
    }
    handlers.onError?.(msg);
    return;
  }

  if (!res.body) {
    handlers.onError?.("Réponse vide du serveur");
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      let evt: SseEvent;
      try {
        evt = JSON.parse(payload) as SseEvent;
      } catch {
        continue;
      }
      if (evt.type === "meta") handlers.onMeta?.(evt.products ?? []);
      else if (evt.type === "token") handlers.onToken?.(evt.text ?? "");
      else if (evt.type === "replace") handlers.onReplace?.(evt.text ?? "");
      else if (evt.type === "error") handlers.onError?.(evt.message || "Erreur assistant");
      else if (evt.type === "done") handlers.onDone?.();
    }
  }
}
