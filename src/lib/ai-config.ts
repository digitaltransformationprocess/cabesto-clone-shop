import type { AiConfig } from "./chat.functions";

export const defaultModels = {
  google: "gemini-3.8-flash",
  openrouter: "nemotron-3-ultra-550b-a55b:free",
} as const;

function env(name: string): string {
  const meta = import.meta.env as Record<string, string | undefined>;
  return (meta[name] ?? "").trim();
}

function normalizeProvider(raw: string, apiKey: string): AiConfig["provider"] {
  const p = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (p === "openrouter" || p === "openrouters" || p.startsWith("openrouter")) return "openrouter";
  if (p === "google" || p === "gemini") return "google";
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("AIza")) return "google";
  return "google";
}

function normalizeApiKey(raw: string): string {
  let key = raw.trim();
  if (key.toLowerCase().startsWith("bearer ")) key = key.slice(7).trim();
  while (key.startsWith(":") || key.startsWith("=")) key = key.slice(1).trim();
  return key;
}

/** Client config from Vite env (`AI_*` or `VITE_AI_*`). */
export function getAiConfig(): AiConfig | null {
  const apiKey = normalizeApiKey(env("VITE_AI_API_KEY") || env("AI_API_KEY"));
  if (!apiKey) return null;

  const provider = normalizeProvider(env("VITE_AI_PROVIDER") || env("AI_PROVIDER"), apiKey);
  const model = env("VITE_AI_MODEL") || env("AI_MODEL") || defaultModels[provider];

  return { provider, apiKey, model };
}
