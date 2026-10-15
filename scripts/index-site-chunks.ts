/**
 * Index site docs into site_chunks (incremental via content_hash).
 *
 *   npx tsx scripts/index-site-chunks.ts
 *   npx tsx scripts/index-site-chunks.ts --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chunkSiteDoc, chunkStores, type SiteChunkDraft, type StoreRecord } from "../src/lib/rag/chunk-site";

const EMBEDDING_DIM = 1536;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";
const EMBED_BATCH = Number(process.env.EMBED_BATCH || 32);

const DOCS: Array<{ docId: string; title: string; pagePath: string; file: string }> = [
  { docId: "faq", title: "FAQ", pagePath: "/faq", file: "src/content/faq.md" },
  { docId: "livraison", title: "Livraison", pagePath: "/livraison", file: "src/content/livraison.md" },
  { docId: "retours", title: "Retours", pagePath: "/retours", file: "src/content/retour-produit.md" },
  { docId: "fidelite", title: "Programme fidélité", pagePath: "/fidelite", file: "src/content/cgu-programme-fidelite.md" },
  { docId: "cgv", title: "Conditions générales de vente", pagePath: "/cgv", file: "src/content/conditions-generales-de-vente.md" },
];

type Existing = {
  id: string;
  doc_id: string;
  chunk_index: number;
  content_hash: string;
  has_embedding: boolean;
};

function readDotEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const file = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      let val = t.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[t.slice(0, eq).trim()] = val;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function env(name: string): string {
  return (process.env[name] ?? readDotEnv()[name] ?? "").trim();
}

async function embedBatch(apiKey: string, texts: string[]): Promise<number[][]> {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marineo.demo",
      "X-Title": "Marineo site RAG indexer",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIM,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${raw.slice(0, 400)}`);
  const json = JSON.parse(raw) as { data?: Array<{ embedding: number[]; index: number }> };
  const byIndex = new Map((json.data ?? []).map((d) => [d.index, d.embedding]));
  return texts.map((_, i) => {
    const emb = byIndex.get(i);
    if (!emb || emb.length !== EMBEDDING_DIM) {
      throw new Error(`Bad embedding at ${i}`);
    }
    return emb;
  });
}

function loadDrafts(): SiteChunkDraft[] {
  const drafts: SiteChunkDraft[] = [];
  for (const d of DOCS) {
    const full = path.resolve(d.file);
    if (!fs.existsSync(full)) {
      console.warn(`skip missing ${d.file}`);
      continue;
    }
    const body = fs.readFileSync(full, "utf8");
    drafts.push(...chunkSiteDoc({ docId: d.docId, title: d.title, pagePath: d.pagePath, body }));
  }

  const storesPath = path.resolve("src/content/stores.json");
  if (fs.existsSync(storesPath)) {
    const stores = JSON.parse(fs.readFileSync(storesPath, "utf8")) as StoreRecord[];
    drafts.push(...chunkStores(stores));
  }
  return drafts;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl = (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = env("AI_API_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  if (!apiKey && !dryRun) throw new Error("AI_API_KEY required");

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const drafts = loadDrafts();
  console.log(`Drafts: ${drafts.length}`);

  const { data: existingRows, error: exErr } = await sb
    .from("site_chunks")
    .select("id, doc_id, chunk_index, content_hash");
  if (exErr) throw new Error(exErr.message);

  const { data: withEmb, error: embErr } = await sb
    .from("site_chunks")
    .select("id")
    .not("embedding", "is", null);
  if (embErr) throw new Error(embErr.message);
  const embIds = new Set((withEmb ?? []).map((r: { id: string }) => r.id));

  const existing = new Map<string, Existing>();
  for (const row of (existingRows ?? []) as Omit<Existing, "has_embedding">[]) {
    existing.set(`${row.doc_id}:${row.chunk_index}`, {
      ...row,
      has_embedding: embIds.has(row.id),
    });
  }

  const keepKeys = new Set<string>();
  const toEmbed: Array<{ draft: SiteChunkDraft; existingId?: string }> = [];
  let skipped = 0;

  for (const draft of drafts) {
    const key = `${draft.docId}:${draft.chunkIndex}`;
    keepKeys.add(key);
    const old = existing.get(key);
    if (old && old.content_hash === draft.contentHash && old.has_embedding) {
      skipped += 1;
      continue;
    }
    toEmbed.push({ draft, ...(old?.id ? { existingId: old.id } : {}) });
  }

  const staleIds = [...existing.values()]
    .filter((e) => !keepKeys.has(`${e.doc_id}:${e.chunk_index}`))
    .map((e) => e.id);

  console.log(
    `To embed: ${toEmbed.length} | unchanged: ${skipped} | stale: ${staleIds.length}${dryRun ? " (dry-run)" : ""}`,
  );

  if (dryRun) return;

  if (staleIds.length) {
    const { error } = await sb.from("site_chunks").delete().in("id", staleIds);
    if (error) throw new Error(`delete stale: ${error.message}`);
  }

  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH);
    const vectors = await embedBatch(
      apiKey,
      batch.map((b) => b.draft.content),
    );
    const rows = batch.map((item, j) => ({
      ...(item.existingId ? { id: item.existingId } : {}),
      doc_id: item.draft.docId,
      page_path: item.draft.pagePath,
      title: item.draft.title,
      chunk_index: item.draft.chunkIndex,
      section: item.draft.section,
      content: item.draft.content,
      content_hash: item.draft.contentHash,
      embedding: vectors[j],
      token_count: item.draft.tokenCount,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await sb.from("site_chunks").upsert(rows, {
      onConflict: "doc_id,chunk_index",
    });
    if (error) throw new Error(`upsert: ${error.message}`);
    console.log(`Embedded ${Math.min(i + EMBED_BATCH, toEmbed.length)}/${toEmbed.length}`);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
