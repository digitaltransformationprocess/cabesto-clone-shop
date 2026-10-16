/**
 * Free OpenRouter chat models for admin switching (rate-limit fallback).
 */

export type FreeModelOption = {
  id: string;
  name: string;
  contextLength: number | null;
};

/**
 * Always offered in admin (even if not $0) — useful when free models are rate-limited.
 * Note: gpt-oss are low-cost on OpenRouter, not the `:free` tier.
 */
export const EXTRA_SWITCH_MODELS: FreeModelOption[] = [
  {
    id: "openai/gpt-oss-20b",
    name: "OpenAI: gpt-oss-20b (low-cost)",
    contextLength: 131_072,
  },
  {
    id: "openai/gpt-oss-120b",
    name: "OpenAI: gpt-oss-120b (low-cost)",
    contextLength: 131_072,
  },
];

/** Fallback if the OpenRouter catalog is unreachable */
export const FREE_MODELS_FALLBACK: FreeModelOption[] = [
  { id: "openrouter/free", name: "Free Models Router (auto)", contextLength: 200_000 },
  ...EXTRA_SWITCH_MODELS,
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "NVIDIA: Nemotron 3 Super (free)",
    contextLength: 262_144,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "NVIDIA: Nemotron 3 Ultra (free)",
    contextLength: 1_000_000,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "NVIDIA: Nemotron 3.5 Lightning (free)",
    contextLength: 1_000_000,
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "NVIDIA: Nemotron 3 Nano Omni (free)",
    contextLength: 256_000,
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Google: Gemma 4 26B A4B (free)",
    contextLength: 262_144,
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Google: Gemma 4 31B (free)",
    contextLength: 262_144,
  },
  {
    id: "cohere/north-mini-code:free",
    name: "Cohere: North Mini Code (free)",
    contextLength: 256_000,
  },
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Poolside: Laguna S 2.1 (free)",
    contextLength: 262_144,
  },
  {
    id: "poolside/laguna-xs-2.1:free",
    name: "Poolside: Laguna XS 2.1 (free)",
    contextLength: 262_144,
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots Studio: Dots3-Note Preview (free)",
    contextLength: 512_000,
  },
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LiquidAI: LFM2.5-2.6B (free)",
    contextLength: 65_536,
  },
  {
    id: "thinkingmachines/inkling:free",
    name: "Thinking Machines: Inkling (free)",
    contextLength: 1_048_576,
  },
  {
    id: "thinkingmachines/inkling-small:free",
    name: "Thinking Machines: Inkling Small (free)",
    contextLength: 1_048_576,
  },
];

const SKIP_ID_RE =
  /(rerank|embedding|embed|lyria|content-safety|whisper|tts|image|flux|stable-diffusion)/i;

type OrModel = {
  id?: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string; output_modalities?: string[] };
};

function isFreeChatModel(m: OrModel): boolean {
  const id = (m.id ?? "").trim();
  if (!id || SKIP_ID_RE.test(id)) return false;
  if (id === "openrouter/free" || id.endsWith(":free")) return true;
  const prompt = Number(m.pricing?.prompt ?? 1);
  const completion = Number(m.pricing?.completion ?? 1);
  if (!(prompt === 0 && completion === 0)) return false;
  const modality = (m.architecture?.modality ?? "").toLowerCase();
  if (modality && !modality.includes("text")) return false;
  return true;
}

let cache: { at: number; models: FreeModelOption[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;

export async function fetchOpenRouterFreeModels(
  apiKey?: string,
): Promise<{ models: FreeModelOption[]; source: "live" | "fallback" }> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return { models: cache.models, source: "live" };
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "HTTP-Referer": "https://marineo.demo",
      "X-Title": "Marineo admin",
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers,
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`models ${res.status}`);
    const json = (await res.json()) as { data?: OrModel[] };
    const models = (json.data ?? [])
      .filter(isFreeChatModel)
      .map((m) => ({
        id: m.id!,
        name: (m.name ?? m.id!).trim(),
        contextLength: typeof m.context_length === "number" ? m.context_length : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));

    const ordered = mergePinnedModels(models);

    if (ordered.length >= 3) {
      cache = { at: Date.now(), models: ordered };
      return { models: ordered, source: "live" };
    }
  } catch (e) {
    console.warn("[openrouter-free-models] catalog fetch failed", e);
  }

  return { models: FREE_MODELS_FALLBACK, source: "fallback" };
}

/** Router + gpt-oss extras first, then the rest (deduped). */
function mergePinnedModels(models: FreeModelOption[]): FreeModelOption[] {
  const byId = new Map(models.map((m) => [m.id, m]));
  const pinned: FreeModelOption[] = [];

  const router = byId.get("openrouter/free") ?? {
    id: "openrouter/free",
    name: "Free Models Router (auto)",
    contextLength: 200_000,
  };
  pinned.push(router);
  byId.delete("openrouter/free");

  for (const extra of EXTRA_SWITCH_MODELS) {
    pinned.push(byId.get(extra.id) ?? extra);
    byId.delete(extra.id);
  }

  return [...pinned, ...byId.values()];
}
