import { getServerAiConfig } from "../ai-config";
import {
  filterNoiseSiteChunks,
  normalizeSearchQuery,
  trimToRelevantDocs,
  trimToRelevantProducts,
} from "./rag-guardrails";
import { getSupabaseAdmin } from "./supabase-admin";

export const EMBEDDING_DIM = 1536;

function embeddingModel(): string {
  return (process.env.EMBEDDING_MODEL || "openai/text-embedding-3-small").trim();
}

export type MatchFilters = {
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  inStockOnly?: boolean;
  categoryPath?: string[] | null;
  matchCount?: number;
  minSimilarity?: number;
};

export type RetrievedProductChunk = {
  chunkId: string;
  productId: string;
  sku: string;
  name: string;
  section: string | null;
  content: string;
  /** Live from products — never from embeddings. */
  priceCents: number;
  /** Live from products — never from embeddings. */
  stock: number;
  similarity: number;
};

export type RetrievedProduct = {
  sku: string;
  name: string;
  priceCents: number;
  stock: number;
  productId: string;
  sections: string[];
  snippets: string[];
  maxSimilarity: number;
  /** Absolute cover URL when hydrated from products.cover_path */
  imageUrl?: string;
};

export async function embedQuery(text: string): Promise<number[]> {
  const cfg = getServerAiConfig();
  if (!cfg?.apiKey) throw new Error("AI_API_KEY manquante pour les embeddings.");

  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://marineo.demo",
      "X-Title": "Marineo RAG chat",
    },
    body: JSON.stringify({
      model: embeddingModel(),
      input: text,
      dimensions: EMBEDDING_DIM,
    }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Embeddings ${res.status}: ${raw.slice(0, 300)}`);
  const json = JSON.parse(raw) as { data?: Array<{ embedding: number[] }> };
  const emb = json.data?.[0]?.embedding;
  if (!emb || emb.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding invalide (${emb?.length ?? 0} dims, attendu ${EMBEDDING_DIM})`);
  }
  return emb;
}

export type RetrievedSiteChunk = {
  chunkId: string;
  docId: string;
  pagePath: string;
  title: string;
  section: string | null;
  content: string;
  similarity: number;
};

type SiteRpcRow = {
  chunk_id: string;
  doc_id: string;
  page_path: string;
  title: string;
  section: string | null;
  content: string;
  similarity: number;
};

export async function retrieveSiteChunks(
  queryOrEmbedding: string | number[],
  opts: { matchCount?: number; minSimilarity?: number; docIds?: string[] | null } = {},
): Promise<RetrievedSiteChunk[]> {
  const embedding =
    typeof queryOrEmbedding === "string"
      ? await embedQuery(queryOrEmbedding.trim())
      : queryOrEmbedding;
  const sb = getSupabaseAdmin();
  const matchCount = opts.matchCount ?? 6;
  const minSim = opts.minSimilarity ?? 0.22;

  const { data, error } = await sb.rpc("match_site_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
    filter_doc_ids: opts.docIds ?? null,
  });
  if (error) throw new Error(`match_site_chunks: ${error.message}`);

  return ((data ?? []) as SiteRpcRow[])
    .filter((r) => (r.similarity ?? 0) >= minSim)
    .map((r) => ({
      chunkId: r.chunk_id,
      docId: r.doc_id,
      pagePath: r.page_path,
      title: r.title,
      section: r.section,
      content: r.content,
      similarity: r.similarity,
    }));
}

export function buildSiteRagContext(chunks: RetrievedSiteChunk[]): string {
  if (!chunks.length) return "";
  return chunks
    .map((c, i) => {
      return `### Doc ${i + 1}
Page: ${c.title}
URL: ${c.pagePath}
Section: ${c.section ?? "—"}

${c.content.slice(0, 1400)}`;
    })
    .join("\n\n");
}

type RpcRow = {
  chunk_id: string;
  product_id: string;
  sku: string;
  name: string;
  section: string | null;
  content: string;
  price_cents: number;
  stock: number;
  similarity: number;
};

/** Vector search + live price/stock filters via match_product_chunks. */
export async function retrieveProductChunks(
  queryOrEmbedding: string | number[],
  filters: MatchFilters = {},
): Promise<RetrievedProductChunk[]> {
  const embedding =
    typeof queryOrEmbedding === "string"
      ? await embedQuery(queryOrEmbedding.trim())
      : queryOrEmbedding;
  const sb = getSupabaseAdmin();
  const matchCount = filters.matchCount ?? 8;
  const minSim = filters.minSimilarity ?? 0.25;

  const { data, error } = await sb.rpc("match_product_chunks", {
    query_embedding: embedding,
    match_count: matchCount,
    filter_min_price_cents: filters.minPriceCents ?? null,
    filter_max_price_cents: filters.maxPriceCents ?? null,
    filter_in_stock_only: filters.inStockOnly ?? false,
    filter_category_path: filters.categoryPath ?? null,
  });

  if (error) throw new Error(`match_product_chunks: ${error.message}`);

  return ((data ?? []) as RpcRow[])
    .filter((r) => (r.similarity ?? 0) >= minSim)
    .map((r) => ({
      chunkId: r.chunk_id,
      productId: r.product_id,
      sku: r.sku,
      name: r.name,
      section: r.section,
      content: r.content,
      priceCents: r.price_cents,
      stock: r.stock,
      similarity: r.similarity,
    }));
}

const SITE_INTENT_RE =
  /\b(faq|livraison|livrer|délai|delai|retour(?:ner|s)?|rembours\w*|magasin|boutiques?|horaires?|adresse|fidélit[eé]|fidelite|cgv|paiement|colissimo|chronopost|mondial\s*relay|contacter|sav)\b/i;

export function isSiteIntent(query: string): boolean {
  return SITE_INTENT_RE.test(query);
}

/** One embed, dual retrieval (products + site docs). */
export async function retrieveAll(
  query: string,
  filters: MatchFilters = {},
): Promise<{ products: RetrievedProduct[]; docs: RetrievedSiteChunk[]; siteIntent: boolean }> {
  const cleaned = normalizeSearchQuery(query);
  const embedding = await embedQuery(cleaned);
  const siteIntent = isSiteIntent(cleaned);
  const [productChunks, rawDocs] = await Promise.all([
    retrieveProductChunks(embedding, {
      ...filters,
      // Site questions: keep a light product signal only if clearly product-related.
      matchCount: siteIntent ? Math.min(filters.matchCount ?? 3, 3) : (filters.matchCount ?? 8),
      // Raised floors to avoid weak semantic matches (e.g. FAQ RH on product questions)
      minSimilarity: siteIntent
        ? Math.max(filters.minSimilarity ?? 0.38, 0.38)
        : (filters.minSimilarity ?? 0.32),
    }),
    retrieveSiteChunks(embedding, {
      matchCount: siteIntent ? 8 : 4,
      // Product asks: only keep very strong site hits (avoid weak FAQ bleed)
      minSimilarity: filters.minSimilarity ?? (siteIntent ? 0.28 : 0.4),
    }),
  ]);

  const docs = trimToRelevantDocs(
    filterNoiseSiteChunks(rawDocs),
    siteIntent ? 0.28 : 0.4,
    siteIntent ? 4 : 2,
  );
  const products = siteIntent
    ? []
    : trimToRelevantProducts(groupChunksByProduct(productChunks), 0.34, 3);

  return { products, docs, siteIntent };
}

/** Attach live cover URLs for chat product cards. */
export async function hydrateProductImages(
  products: RetrievedProduct[],
): Promise<RetrievedProduct[]> {
  if (!products.length) return products;
  const sb = getSupabaseAdmin();
  const skus = [...new Set(products.map((p) => p.sku))];
  const { data, error } = await sb.from("products").select("sku, cover_path").in("sku", skus);
  if (error) {
    console.warn("[rag] hydrateProductImages:", error.message);
    return products;
  }
  const bySku = new Map(
    ((data ?? []) as Array<{ sku: string; cover_path: string | null }>).map((r) => [
      r.sku,
      r.cover_path || "",
    ]),
  );
  return products.map((p) => {
    const url = bySku.get(p.sku) || "";
    return url ? { ...p, imageUrl: url } : p;
  });
}

export function groupChunksByProduct(chunks: RetrievedProductChunk[]): RetrievedProduct[] {
  const map = new Map<string, RetrievedProduct>();
  for (const c of chunks) {
    const cur = map.get(c.sku);
    if (!cur) {
      map.set(c.sku, {
        sku: c.sku,
        name: c.name,
        priceCents: c.priceCents,
        stock: c.stock,
        productId: c.productId,
        sections: c.section ? [c.section] : [],
        snippets: [c.content],
        maxSimilarity: c.similarity,
      });
    } else {
      if (c.section && !cur.sections.includes(c.section)) cur.sections.push(c.section);
      if (cur.snippets.length < 3) cur.snippets.push(c.content);
      cur.maxSimilarity = Math.max(cur.maxSimilarity, c.similarity);
      // Prefer freshest live values (all same product)
      cur.priceCents = c.priceCents;
      cur.stock = c.stock;
    }
  }
  return [...map.values()].sort((a, b) => b.maxSimilarity - a.maxSimilarity);
}

export function formatEuroFromCents(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/** Context block for the LLM — prices/stock are live RPC values only. */
export function buildRagContext(products: RetrievedProduct[]): string {
  if (!products.length) return "";
  return products
    .map((p, i) => {
      const price = formatEuroFromCents(p.priceCents);
      const stockLabel = p.stock > 0 ? `${p.stock} en stock` : "rupture de stock";
      const body = p.snippets.map((s) => s.slice(0, 1200)).join("\n---\n");
      return `### Produit ${i + 1}
SKU: ${p.sku}
Nom: ${p.name}
Prix (live): ${price} (${p.priceCents} centimes)
Stock (live): ${stockLabel}
Lien: /produit/${p.sku}

Extrait catalogue (sans prix/stock embarqués) :
${body}`;
    })
    .join("\n\n");
}
