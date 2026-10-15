import fs from "node:fs";
import path from "node:path";
import type { AiConfig } from "./chat.functions";

export const defaultModels = {
  google: "gemini-3.8-flash",
  openrouter: "nemotron-3-ultra-550b-a55b:free",
} as const;

/** Parse simple KEY=VALUE from .env (sans dépendance dotenv). */
function readDotEnvFile(): Record<string, string> {
  try {
    const file = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(file)) return {};
    const out: Record<string, string> = {};
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function env(name: string): string {
  // Priorité aux secrets injectés par la plateforme, puis au .env local.
  const fromProcess = (process.env[name] ?? "").trim();
  if (fromProcess) return fromProcess;
  const file = readDotEnvFile();
  return (file[name] ?? "").trim();
}

function normalizeProvider(raw: string, apiKey: string): AiConfig["provider"] {
  const p = raw.toLowerCase().replace(/[^a-z]/g, "");
  if (p === "openrouter" || p === "openrouters" || p.startsWith("openrouter")) return "openrouter";
  if (p === "google" || p === "gemini") return "google";
  // Auto-detect from key prefix
  if (apiKey.startsWith("sk-or-")) return "openrouter";
  if (apiKey.startsWith("AIza")) return "google";
  return "google";
}

function normalizeApiKey(raw: string): string {
  // Corrige les typos fréquents : ":sk-or-...", "Bearer xxx"
  let key = raw.trim();
  if (key.toLowerCase().startsWith("bearer ")) key = key.slice(7).trim();
  while (key.startsWith(":") || key.startsWith("=")) key = key.slice(1).trim();
  return key;
}

/** Server-only: lit la config depuis `.env` (AI_PROVIDER, AI_API_KEY, AI_MODEL). */
export function getServerAiConfig(): AiConfig | null {
  const apiKey = normalizeApiKey(env("AI_API_KEY"));
  if (!apiKey) return null;

  const provider = normalizeProvider(env("AI_PROVIDER"), apiKey);
  let model = env("AI_MODEL") || defaultModels[provider];

  // OpenRouter attend souvent "org/model" — si l'utilisateur met juste le slug free, on laisse tel quel
  if (provider === "openrouter" && model && !model.includes("/") && !model.includes(":")) {
    // keep as-is; user may use short ids
  }

  return { provider, apiKey, model };
}
