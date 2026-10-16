import fs from "node:fs";
import path from "node:path";
import type { AiConfig } from "./chat.functions";

export const defaultModels = {
  google: "gemini-3.8-flash",
  openrouter: "nvidia/nemotron-3-super-120b-a12b:free",
} as const;

/** Runtime model override — NOT .env (writing .env restarts Vite and wipes the UI). */
const MODEL_OVERRIDE_PATH = path.resolve(process.cwd(), ".tmp", "ai-model.override");

function readModelOverride(): string {
  try {
    if (!fs.existsSync(MODEL_OVERRIDE_PATH)) return "";
    return fs.readFileSync(MODEL_OVERRIDE_PATH, "utf8").trim();
  } catch {
    return "";
  }
}

function writeModelOverride(model: string): void {
  const dir = path.dirname(MODEL_OVERRIDE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(MODEL_OVERRIDE_PATH, `${model}\n`, "utf8");
}

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

/** Server-only: lit la config depuis override runtime, puis `.env`. */
export function getServerAiConfig(): AiConfig | null {
  const apiKey = normalizeApiKey(env("AI_API_KEY"));
  if (!apiKey) return null;

  const provider = normalizeProvider(env("AI_PROVIDER"), apiKey);
  // Override file first (admin switch), then env
  const model = readModelOverride() || env("AI_MODEL") || defaultModels[provider];

  return { provider, apiKey, model };
}

/**
 * Persist AI_MODEL for the running server without touching `.env`
 * (editing `.env` triggers Vite full reload → page refresh + lost selection).
 */
export function setServerAiModel(modelRaw: string): { ok: true; model: string } | { ok: false; message: string } {
  const model = modelRaw.trim();
  if (!model || model.length > 200 || /[\r\n]/.test(model)) {
    return { ok: false, message: "Identifiant de modèle invalide." };
  }

  try {
    writeModelOverride(model);
    process.env["AI_MODEL"] = model;
  } catch (e) {
    console.warn("[ai-config] could not write model override", e);
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Impossible d'enregistrer le modèle.",
    };
  }

  return { ok: true, model };
}
