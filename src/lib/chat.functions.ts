import { getAiConfig } from "./ai-config";

export type AiConfig = { provider: "google" | "openrouter"; apiKey: string; model: string };
export type AiPublicStatus = {
  configured: boolean;
  provider: AiConfig["provider"] | null;
  model: string | null;
};

type Msg = { role: "user" | "assistant"; content: string };

const ENDPOINTS = {
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

function asText(mod: unknown): string {
  if (typeof mod === "string") return mod;
  if (mod && typeof mod === "object" && "default" in mod) {
    const d = (mod as { default: unknown }).default;
    if (typeof d === "string") return d;
  }
  return "";
}

async function loadContentDocs() {
  const [faq, livraison, retours] = await Promise.all([
    import("@/content/faq.md?raw"),
    import("@/content/livraison.md?raw"),
    import("@/content/retour-produit.md?raw"),
  ]);
  return {
    faq: asText(faq),
    livraison: asText(livraison),
    retours: asText(retours),
  };
}

async function callAi(cfg: AiConfig, messages: { role: string; content: string }[]) {
  if (!cfg.apiKey) throw new Error("Aucune clé API configurée. Renseigne AI_API_KEY (ou VITE_AI_API_KEY) dans .env.");
  const res = await fetch(ENDPOINTS[cfg.provider], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
      "HTTP-Referer": "https://marineo.demo",
      "X-Title": "Marineo",
    },
    body: JSON.stringify({ model: cfg.model, messages }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 400);
    try {
      const j = JSON.parse(text);
      msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg;
    } catch {
      /* brut */
    }
    if (res.status === 429) {
      throw new Error(
        "Quota API dépassé. Attends un peu, change de modèle dans .env, ou utilise OpenRouter (AI_PROVIDER=openrouter).",
      );
    }
    throw new Error(`Erreur ${res.status} : ${msg}`);
  }
  const j = JSON.parse(text);
  return (j.choices?.[0]?.message?.content as string) ?? "";
}

export async function getAiStatus(): Promise<AiPublicStatus> {
  const cfg = getAiConfig();
  if (!cfg) return { configured: false, provider: null, model: null };
  return { configured: true, provider: cfg.provider, model: cfg.model };
}

export async function testAiConnection() {
  const cfg = getAiConfig();
  if (!cfg) {
    return {
      ok: false,
      message:
        "AI_API_KEY manquante dans .env. Copie .env.example vers .env et renseigne la clé, puis redémarre npm run dev.",
    };
  }
  try {
    const r = await callAi(cfg, [{ role: "user", content: "Réponds uniquement : OK" }]);
    return { ok: true, message: r.trim().slice(0, 100) || "Réponse vide" };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function chatWithAi(input: { messages: Msg[]; context: string }) {
  try {
    const cfg = getAiConfig();
    if (!cfg) {
      return {
        ok: false as const,
        reply:
          "L'assistant n'est pas configuré. Ajoute `AI_API_KEY` dans `.env`, puis redémarre `npm run dev`.",
      };
    }

    const docs = await loadContentDocs();
    const messages = Array.isArray(input.messages) ? input.messages : [];
    const context = typeof input.context === "string" ? input.context : "";

    const system = `Tu es l'assistant de la boutique Marinéo (matériel marin : pêche, nautisme, plongée, vêtements). Réponds en français, de façon courte et utile, en markdown.
Règles : les faits (prix, stock, statut de commande, transporteur, n° de suivi) viennent UNIQUEMENT des données ci-dessous ; n'invente jamais. Si une info manque, dis-le et propose le Support Client (onglet « Support Client » du compte) ou le 01 89 61 14 22. Pour un produit, donne nom, prix, stock et le lien markdown [voir](/produit/ID). Pour une commande, le client doit être connecté ; ne parle jamais des commandes d'un autre client.

${context.slice(0, 20000)}

## Livraison
${docs.livraison.slice(0, 4000)}

## Retours
${docs.retours.slice(0, 3000)}

## FAQ
${docs.faq.slice(0, 8000)}`;

    const reply = await callAi(cfg, [
      { role: "system", content: system },
      ...messages.slice(-12).map((m) => ({
        role: m.role,
        content: String(m.content ?? ""),
      })),
    ]);
    return { ok: true as const, reply: reply || "Je n'ai pas pu formuler de réponse." };
  } catch (e) {
    console.error("[chatWithAi]", e);
    return { ok: false as const, reply: (e as Error).message || "Erreur assistant IA" };
  }
}
