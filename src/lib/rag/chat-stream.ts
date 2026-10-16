import type { AiConfig } from "../chat.functions";
import { getServerAiConfig } from "../ai-config";
import {
  formatOrdersForPrompt,
  formatTicketsForPrompt,
  type ChatSessionPayload,
} from "./account-assist";
import {
  detectChatIntent,
  LOGIN_REQUIRED_REPLY,
  requiresAuth,
} from "./chat-intents";
import {
  buildRagContext,
  buildSiteRagContext,
  hydrateProductImages,
  retrieveAll,
  type MatchFilters,
  type RetrievedProduct,
  type RetrievedSiteChunk,
} from "./retrieve";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequestBody = {
  messages: ChatMessage[];
  filters?: MatchFilters;
  /** Client session: login + orders/tickets (localStorage demo). */
  session?: ChatSessionPayload;
};

const ENDPOINTS = {
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
} as const;

const SYSTEM_RULES = `Tu es l'assistant de la boutique Marinéo (pêche, nautisme, plongée, montagne, piscine).
Réponds en français, concis.
Tu es un assistant virtuel (pas un conseiller humain).

Règles STRICTES :
1. Tu ne réponds qu'à partir du contexte fourni : « Produits retrouvés », « Pages du site », et le cas échéant « Compte client ».
2. PRODUITS : l'interface affiche déjà des cartes (photo, prix, stock, boutons). Ta réponse texte doit être UNIQUEMENT 1 ou 2 phrases d'intro (ex. « Voici 2 options adaptées : » ou « Ces articles sont en rupture pour le moment. »).
   - INTERDIT : tableaux markdown (| ... |), listes détaillées de produits, répétition prix/stock/liens.
   - Maximum 3 produits dans le contexte — ne parle que de ceux-là.
3. Pour FAQ / livraison / retours / magasins : utilise « Pages du site », phrases courtes + un lien markdown [Titre](/chemin).
4. Pour les commandes / tickets : utilise uniquement « Compte client ». N'invente aucun statut ni numéro.
5. Ne promets jamais de remboursement. Pour le SAV, propose un ticket ; si tu as sujet + description, termine par une ligne :
[CREER_TICKET] sujet court | description détaillée
6. Si des sources utiles sont listées, réponds avec elles (ne dis pas « Je ne sais pas »).
7. Réponds « Je ne sais pas » UNIQUEMENT si aucune source utile n'est fournie.
8. N'invente rien hors contexte.
9. N'utilise JAMAIS de tableau markdown.`;

function deterministicProductAnswer(products: RetrievedProduct[]): string {
  const n = Math.min(products.length, 3);
  const allOos = products.slice(0, n).every((p) => p.stock <= 0);
  if (allOos) {
    return n === 1
      ? "Voici l'article trouvé — il est actuellement en rupture de stock."
      : `Voici ${n} articles trouvés — tous actuellement en rupture de stock.`;
  }
  return n === 1
    ? "Voici l'article le plus pertinent :"
    : `Voici ${n} options adaptées à votre recherche :`;
}

function deterministicDocAnswer(docs: RetrievedSiteChunk[]): string {
  const byPage = new Map<string, RetrievedSiteChunk>();
  for (const d of docs) {
    if (!byPage.has(d.pagePath)) byPage.set(d.pagePath, d);
  }
  return [...byPage.values()]
    .slice(0, 4)
    .map((d) => {
      const excerpt = d.content.split("\n\n").slice(1).join("\n").slice(0, 400);
      return `**${d.title}** (${d.section ?? "info"})\n${excerpt}\n→ [${d.title}](${d.pagePath})`;
    })
    .join("\n\n");
}

function isDontKnow(text: string): boolean {
  return /^je ne sais pas\.?$/i.test(text.trim());
}

function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user" && m.content.trim()) return m.content.trim();
  }
  return "";
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

async function* parseOpenAiSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = json.choices?.[0]?.delta?.content;
        if (token) yield token;
      } catch {
        /* ignore partial */
      }
    }
  }
}

async function completeOnce(
  cfg: AiConfig,
  messages: { role: string; content: string }[],
): Promise<string> {
  const res = await fetch(ENDPOINTS[cfg.provider], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "HTTP-Referer": "https://marineo.demo",
      "X-Title": "Marineo RAG chat",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: false,
      temperature: 0.2,
      // Reasoning free models spend many tokens before the visible answer
      max_tokens: 2048,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`LLM ${res.status}: ${text.slice(0, 400)}`);
  const json = JSON.parse(text) as {
    choices?: Array<{
      message?: { content?: string | null; reasoning?: string | null };
    }>;
  };
  const msg = json.choices?.[0]?.message;
  const content = (msg?.content ?? "").trim();
  if (content) return content;
  // Some free reasoning models return empty content + reasoning only
  return (msg?.reasoning ?? "").trim();
}

async function openUpstreamStream(
  cfg: AiConfig,
  messages: { role: string; content: string }[],
): Promise<ReadableStream<Uint8Array>> {
  const res = await fetch(ENDPOINTS[cfg.provider], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "HTTP-Referer": "https://marineo.demo",
      "X-Title": "Marineo RAG chat",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 2048,
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0, 400)}`);
  }
  return res.body;
}

export async function createRagChatSseStream(body: ChatRequestBody): Promise<Response> {
  const encoder = new TextEncoder();
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const query = lastUserMessage(messages);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(sse(obj)));
      try {
        if (!query) {
          send({ type: "error", message: "Message utilisateur manquant." });
          controller.close();
          return;
        }

        const cfg = getServerAiConfig();
        if (!cfg) {
          send({
            type: "error",
            message: "Assistant non configuré (AI_API_KEY manquante côté serveur).",
          });
          controller.close();
          return;
        }

        const intent = detectChatIntent(query);
        const session = body.session;
        const authed = Boolean(session?.authenticated);

        if (requiresAuth(intent) && !authed) {
          send({ type: "meta", products: [], docs: [], intent, authRequired: true });
          send({ type: "token", text: LOGIN_REQUIRED_REPLY });
          send({ type: "done" });
          controller.close();
          return;
        }

        const accountMode = authed && (intent === "order_tracking" || intent === "sav");

        const retrieved = accountMode
          ? { products: [] as RetrievedProduct[], docs: [] as RetrievedSiteChunk[], siteIntent: false }
          : await retrieveAll(query, body.filters ?? {});
        const products = accountMode
          ? retrieved.products
          : await hydrateProductImages(retrieved.products);
        const docs = retrieved.docs;
        const siteIntent = retrieved.siteIntent;

        const publicProducts = products.map((p) => ({
          sku: p.sku,
          name: p.name,
          priceCents: p.priceCents,
          stock: p.stock,
          similarity: Number(p.maxSimilarity.toFixed(4)),
          ...(p.imageUrl ? { imageUrl: p.imageUrl } : {}),
        }));
        const publicDocs = docs.map((d) => ({
          docId: d.docId,
          title: d.title,
          pagePath: d.pagePath,
          section: d.section,
          similarity: Number(d.similarity.toFixed(4)),
        }));
        send({
          type: "meta",
          products: publicProducts,
          docs: publicDocs,
          siteIntent,
          intent,
          authRequired: false,
        });

        const ordersCtx = formatOrdersForPrompt(session?.orders ?? []);
        const ticketsCtx = formatTicketsForPrompt(session?.tickets ?? []);
        const accountCtx = accountMode
          ? `Client : ${session?.userName ?? "?"} (${session?.email ?? "?"})\nCommandes :\n${ordersCtx}\nTickets SAV :\n${ticketsCtx}`
          : "";

        if (!products.length && !docs.length && !accountMode) {
          send({ type: "token", text: "Je ne sais pas" });
          send({ type: "done" });
          controller.close();
          return;
        }

        const productCtx = buildRagContext(products);
        const siteCtx = buildSiteRagContext(docs);
        const focus = accountMode
          ? intent === "sav"
            ? "Priorité: SAV — utilise « Compte client ». Pas de promesse de remboursement. Propose [CREER_TICKET] si assez d'info."
            : "Priorité: suivi de commande — utilise uniquement « Compte client »."
          : siteIntent
            ? "Priorité: répondre avec « Pages du site » (FAQ, livraison, retours, magasins…)."
            : "Priorité: répondre avec les produits si la question porte sur un article.";
        const system = `${SYSTEM_RULES}

${focus}

## Produits retrouvés
${productCtx || "(aucun)"}

## Pages du site
${siteCtx || "(aucune)"}

## Compte client
${accountCtx || "(non connecté / non applicable)"}`;

        const llmMessages = [
          { role: "system", content: system },
          ...messages.slice(-10).map((m) => ({
            role: m.role,
            content: String(m.content ?? ""),
          })),
        ];

        let assembled = "";
        try {
          const upstream = await openUpstreamStream(cfg, llmMessages);
          for await (const token of parseOpenAiSse(upstream)) {
            assembled += token;
            send({ type: "token", text: token });
          }
        } catch (streamErr) {
          console.warn("[api/chat] stream failed, fallback non-stream", streamErr);
        }

        if (!assembled.trim()) {
          const full = await completeOnce(cfg, llmMessages);
          assembled = full;
          if (full) send({ type: "token", text: full });
        }

        if (!assembled.trim() || isDontKnow(assembled)) {
          const parts = siteIntent
            ? [
                docs.length ? deterministicDocAnswer(docs) : "",
                products.length ? deterministicProductAnswer(products) : "",
              ]
            : [
                products.length ? deterministicProductAnswer(products) : "",
                docs.length ? deterministicDocAnswer(docs) : "",
              ];
          const safe = parts.filter(Boolean).join("\n\n") || "Je ne sais pas";
          send({
            type: "token",
            text: assembled.trim() && isDontKnow(assembled) ? `\n\n${safe}` : safe,
          });
        }

        send({ type: "done" });
        controller.close();
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        try {
          send({ type: "error", message });
        } catch {
          /* closed */
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export type { RetrievedProduct, MatchFilters };
