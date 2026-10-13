import type { AiConfig } from "./chat.functions";

export const defaultModels = { google: "gemini-2.5-flash", openrouter: "google/gemini-2.5-flash" } as const;
const KEY = "demo-ai-config";
export const readAiConfig = (): AiConfig | null => {
  try { const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null; } catch { return null; }
};
export const saveAiConfig = (c: AiConfig) => localStorage.setItem(KEY, JSON.stringify(c));
