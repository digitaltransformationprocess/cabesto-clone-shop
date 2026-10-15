import { createFileRoute } from "@tanstack/react-router";
import {
  createRagChatSseStream,
  type ChatMessage,
  type ChatRequestBody,
} from "@/lib/rag/chat-stream";
import type { MatchFilters } from "@/lib/rag/retrieve";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON invalide" }, { status: 400 });
        }

        const parsed = parseChatBody(body);
        if (!parsed.ok) {
          return Response.json({ error: parsed.error }, { status: 400 });
        }

        return createRagChatSseStream(parsed.value);
      },
    },
  },
});

function parseChatBody(
  body: unknown,
): { ok: true; value: ChatRequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body attendu: { messages, filters? }" };
  }
  const raw = body as Record<string, unknown>;
  const messagesRaw = raw.messages;
  if (!Array.isArray(messagesRaw) || messagesRaw.length === 0) {
    return { ok: false, error: "messages[] requis" };
  }

  const messages: ChatMessage[] = [];
  for (const m of messagesRaw.slice(-20)) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role === "user" || role === "assistant") && typeof content === "string") {
      messages.push({ role, content: content.slice(0, 8000) });
    }
  }
  if (!messages.some((m) => m.role === "user")) {
    return { ok: false, error: "Au moins un message user est requis" };
  }

  const filters = parseFilters(raw.filters);
  return { ok: true, value: { messages, ...(filters ? { filters } : {}) } };
}

function parseFilters(raw: unknown): MatchFilters | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const f = raw as Record<string, unknown>;
  const out: MatchFilters = {};

  if (typeof f.minPriceCents === "number" && Number.isFinite(f.minPriceCents)) {
    out.minPriceCents = Math.max(0, Math.floor(f.minPriceCents));
  }
  if (typeof f.maxPriceCents === "number" && Number.isFinite(f.maxPriceCents)) {
    out.maxPriceCents = Math.max(0, Math.floor(f.maxPriceCents));
  }
  if (typeof f.inStockOnly === "boolean") out.inStockOnly = f.inStockOnly;
  if (typeof f.matchCount === "number" && Number.isFinite(f.matchCount)) {
    out.matchCount = Math.min(20, Math.max(1, Math.floor(f.matchCount)));
  }
  if (typeof f.minSimilarity === "number" && Number.isFinite(f.minSimilarity)) {
    out.minSimilarity = Math.min(1, Math.max(0, f.minSimilarity));
  }
  if (Array.isArray(f.categoryPath)) {
    out.categoryPath = f.categoryPath.filter((x): x is string => typeof x === "string").slice(0, 8);
  }

  return Object.keys(out).length ? out : undefined;
}
