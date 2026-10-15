/**
 * Index product_chunks embeddings (incremental via content_hash).
 *
 *   npx tsx scripts/index-product-chunks.ts
 *   npx tsx scripts/index-product-chunks.ts --limit=50
 *   npx tsx scripts/index-product-chunks.ts --dry-run
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AI_API_KEY
 * Embeddings: OpenRouter openai/text-embedding-3-small → vector(1536)
 * Never embeds price/stock (chunkProduct header excludes them).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chunkProduct, type ProductChunkDraft, type RagProductInput } from "../src/lib/rag/chunk-product";

const EMBEDDING_DIM = 1536;
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small";
const EMBED_BATCH = Number(process.env.EMBED_BATCH || 32);
const PRODUCT_PAGE = 500;

type DbProduct = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category_path: string[] | null;
  brands: { name: string } | { name: string }[] | null;
};

type ExistingChunk = {
  id: string;
  product_id: string;
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

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${name}=`));
  return hit ? hit.slice(name.length + 1) : undefined;
}

function brandName(brands: DbProduct["brands"]): string | null {
  if (!brands) return null;
  if (Array.isArray(brands)) return brands[0]?.name ?? null;
  return brands.name ?? null;
}

async function embedBatch(apiKey: string, texts: string[]): Promise<number[][]> {
  if (!texts.length) return [];
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marineo.demo",
      "X-Title": "Marineo RAG indexer",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: EMBEDDING_DIM,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`Embeddings ${res.status}: ${raw.slice(0, 400)}`);
  }
  const json = JSON.parse(raw) as {
    data?: Array<{ embedding: number[]; index: number }>;
  };
  const data = json.data ?? [];
  const byIndex = new Map(data.map((d) => [d.index, d.embedding]));
  return texts.map((_, i) => {
    const emb = byIndex.get(i);
    if (!emb || emb.length !== EMBEDDING_DIM) {
      throw new Error(`Missing/invalid embedding at index ${i} (got ${emb?.length ?? 0} dims)`);
    }
    return emb;
  });
}

async function fetchAllProducts(
  sb: ReturnType<typeof createClient>,
  limit: number | null,
): Promise<RagProductInput[]> {
  const out: RagProductInput[] = [];
  for (let from = 0; ; from += PRODUCT_PAGE) {
    const to = from + PRODUCT_PAGE - 1;
    const { data, error } = await sb
      .from("products")
      .select("id, sku, name, description, category_path, brands(name)")
      .eq("is_active", true)
      .order("sku", { ascending: true })
      .range(from, to);
    if (error) throw new Error(`products: ${error.message}`);
    const rows = (data ?? []) as DbProduct[];
    for (const r of rows) {
      out.push({
        id: r.id,
        sku: r.sku,
        name: r.name,
        brand: brandName(r.brands),
        categoryPath: r.category_path,
        description: r.description,
      });
      if (limit != null && out.length >= limit) return out;
    }
    if (rows.length < PRODUCT_PAGE) break;
  }
  return out;
}

async function fetchExistingChunks(
  sb: ReturnType<typeof createClient>,
  productIds: string[],
): Promise<Map<string, ExistingChunk[]>> {
  const map = new Map<string, ExistingChunk[]>();
  const chunkSize = 200;
  for (let i = 0; i < productIds.length; i += chunkSize) {
    const slice = productIds.slice(i, i + chunkSize);
    // Avoid downloading full vectors: only metadata + null-check via filter pairs.
    const { data, error } = await sb
      .from("product_chunks")
      .select("id, product_id, chunk_index, content_hash")
      .in("product_id", slice);
    if (error) throw new Error(`product_chunks: ${error.message}`);

    const { data: withEmb, error: embErr } = await sb
      .from("product_chunks")
      .select("id")
      .in("product_id", slice)
      .not("embedding", "is", null);
    if (embErr) throw new Error(`product_chunks emb: ${embErr.message}`);
    const embIds = new Set((withEmb ?? []).map((r: { id: string }) => r.id));

    for (const row of (data ?? []) as Omit<ExistingChunk, "has_embedding">[]) {
      const list = map.get(row.product_id) ?? [];
      list.push({ ...row, has_embedding: embIds.has(row.id) });
      map.set(row.product_id, list);
    }
  }
  return map;
}

async function main() {
  const dryRun = argFlag("--dry-run");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Number(limitRaw) : null;

  const supabaseUrl = (env("SUPABASE_URL") || env("VITE_SUPABASE_URL")).replace(/\/$/, "");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const apiKey = env("AI_API_KEY");

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in .env (server-only — never use VITE_ prefix)",
    );
  }
  if (!apiKey && !dryRun) throw new Error("Missing AI_API_KEY for embeddings");

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`Loading products${limit ? ` (limit ${limit})` : ""}…`);
  const products = await fetchAllProducts(sb, limit);
  console.log(`Products: ${products.length}`);

  const existing = await fetchExistingChunks(
    sb,
    products.map((p) => p.id),
  );

  type WorkItem = {
    product: RagProductInput;
    draft: ProductChunkDraft;
    existingId?: string;
  };

  const toEmbed: WorkItem[] = [];
  let skipped = 0;
  let deleted = 0;

  for (const product of products) {
    const drafts = chunkProduct(product);
    const prev = existing.get(product.id) ?? [];
    const byIndex = new Map(prev.map((c) => [c.chunk_index, c]));
    const keepIndexes = new Set<number>();

    for (const draft of drafts) {
      keepIndexes.add(draft.chunkIndex);
      const old = byIndex.get(draft.chunkIndex);
      if (old && old.content_hash === draft.contentHash && old.has_embedding) {
        skipped += 1;
        continue;
      }
      toEmbed.push({ product, draft, existingId: old?.id });
    }

    const staleIds = prev.filter((c) => !keepIndexes.has(c.chunk_index)).map((c) => c.id);
    if (staleIds.length && !dryRun) {
      const { error } = await sb.from("product_chunks").delete().in("id", staleIds);
      if (error) throw new Error(`delete stale: ${error.message}`);
      deleted += staleIds.length;
    } else {
      deleted += staleIds.length;
    }
  }

  console.log(
    `To embed: ${toEmbed.length} | unchanged: ${skipped} | stale removed: ${deleted}${dryRun ? " (dry-run)" : ""}`,
  );

  if (dryRun || !toEmbed.length) {
    console.log("Done.");
    return;
  }

  let upserted = 0;
  for (let i = 0; i < toEmbed.length; i += EMBED_BATCH) {
    const batch = toEmbed.slice(i, i + EMBED_BATCH);
    const vectors = await embedBatch(
      apiKey,
      batch.map((b) => b.draft.content),
    );

    const rows = batch.map((item, j) => ({
      id: item.existingId || crypto.randomUUID(),
      product_id: item.draft.productId,
      chunk_index: item.draft.chunkIndex,
      section: item.draft.section,
      content: item.draft.content,
      content_hash: item.draft.contentHash,
      embedding: vectors[j],
      token_count: item.draft.tokenCount,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await sb.from("product_chunks").upsert(rows, {
      onConflict: "product_id,chunk_index",
    });
    if (error) throw new Error(`upsert: ${error.message}`);

    upserted += rows.length;
    console.log(`Embedded ${Math.min(i + EMBED_BATCH, toEmbed.length)}/${toEmbed.length}`);
  }

  console.log(`Upserted ${upserted} chunks. Done.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
