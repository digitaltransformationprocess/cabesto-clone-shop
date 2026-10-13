import { createServerFn } from "@tanstack/react-start";

export type AiConfig = { provider: "google" | "openrouter"; apiKey: string; model: string };
type Msg = { role: "user" | "assistant"; content: string };

const ENDPOINTS = {
  google: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
};

async function callAi(cfg: AiConfig, messages: { role: string; content: string }[]) {
  if (!cfg.apiKey) throw new Error("Aucune clé API configurée par l'administrateur.");
  const res = await fetch(ENDPOINTS[cfg.provider], {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}`, "HTTP-Referer": "https://marineo.demo", "X-Title": "Marineo" },
    body: JSON.stringify({ model: cfg.model, messages }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try { const j = JSON.parse(text); msg = (Array.isArray(j) ? j[0] : j)?.error?.message ?? msg; } catch { /* brut */ }
    throw new Error(`Erreur ${res.status} : ${msg}`);
  }
  const j = JSON.parse(text);
  return (j.choices?.[0]?.message?.content as string) ?? "";
}

export const testAiConnection = createServerFn({ method: "POST" })
  .inputValidator((d: AiConfig) => d)
  .handler(async ({ data }) => {
    try {
      const r = await callAi(data, [{ role: "user", content: "Réponds uniquement : OK" }]);
      return { ok: true, message: r.trim().slice(0, 100) || "Réponse vide" };
    } catch (e) {
      return { ok: false, message: (e as Error).message };
    }
  });

export const chatWithAi = createServerFn({ method: "POST" })
  .inputValidator((d: { config: AiConfig; messages: Msg[]; context: string }) => d)
  .handler(async ({ data }) => {
    const [faq, livraison, retours] = await Promise.all([
      import("@/content/faq.md?raw"), import("@/content/livraison.md?raw"), import("@/content/retour-produit.md?raw"),
    ]);
    const system = `Tu es l'assistant de la boutique Marinéo (matériel marin : pêche, nautisme, plongée, vêtements). Réponds en français, de façon courte et utile, en markdown.
Règles : les faits (prix, stock, statut de commande, transporteur, n° de suivi) viennent UNIQUEMENT des données ci-dessous ; n'invente jamais. Si une info manque, dis-le et propose le Support Client (onglet « Support Client » du compte) ou le 01 89 61 14 22. Pour un produit, donne nom, prix, stock et le lien markdown [voir](/produit/ID). Pour une commande, le client doit être connecté ; ne parle jamais des commandes d'un autre client.

${data.context}

## Livraison
${livraison.default.slice(0, 6000)}

## Retours
${retours.default.slice(0, 4000)}

## FAQ
${faq.default.slice(0, 12000)}`;
    try {
      const reply = await callAi(data.config, [{ role: "system", content: system }, ...data.messages.slice(-20)]);
      return { ok: true, reply };
    } catch (e) {
      return { ok: false, reply: (e as Error).message };
    }
  });
