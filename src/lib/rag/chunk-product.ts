import { createHash } from "node:crypto";

/** Product fields used for RAG text — never price or stock. */
export type RagProductInput = {
  id: string;
  sku: string;
  name: string;
  brand?: string | null;
  categoryPath?: string[] | null;
  description?: string | null;
};

export type ProductChunkDraft = {
  productId: string;
  chunkIndex: number;
  section: string;
  /** Header + section body; no price/stock. */
  content: string;
  contentHash: string;
  tokenCount: number;
};

const SECTION_TITLES = [
  "Informations techniques",
  "Spécifications techniques",
  "Contenu du package",
  "Contenu du colis",
  "Caractéristiques",
  "Spécifications",
  "Points clés",
  "Avantages",
  "Le produit en vidéo",
] as const;

/** Soft target for embedding payload (chars ≈ tokens/3 for French). */
const DEFAULT_MAX_CHARS = 1400;

const SECTION_SPLIT_RE = new RegExp(
  `(${SECTION_TITLES.map(escapeRegExp).join("|")})`,
  "gi",
);

/** Defensive: drop lines that look like live price/stock (never embed those). */
const PRICE_STOCK_LINE_RE =
  /^\s*(?:prix|tarif|stock|disponib(?:le|ilité)|quantité\s+en\s+stock)\b.*$/gim;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Rough token estimate for budgeting (not a tokenizer). */
export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 3.5));
}

export function buildProductHeader(p: RagProductInput): string {
  const brand = p.brand?.trim();
  const path = (p.categoryPath ?? []).filter(Boolean).join(" > ");
  const lines = [
    `SKU: ${p.sku}`,
    `Produit: ${p.name.trim()}`,
    brand ? `Marque: ${brand}` : null,
    path ? `Catégorie: ${path}` : null,
  ].filter((x): x is string => Boolean(x));
  return lines.join("\n");
}

function sanitizeDescription(raw: string): string {
  return raw
    .replace(PRICE_STOCK_LINE_RE, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type SectionPiece = { section: string; body: string };

/** Split long catalog copy on known section headings (often glued without newlines). */
export function splitIntoSections(description: string): SectionPiece[] {
  const text = sanitizeDescription(description);
  if (!text) return [];

  const matches = [...text.matchAll(SECTION_SPLIT_RE)];
  if (!matches.length) {
    return [{ section: "Description", body: text }];
  }

  const pieces: SectionPiece[] = [];
  const firstIdx = matches[0]!.index ?? 0;
  if (firstIdx > 0) {
    const intro = text.slice(0, firstIdx).trim();
    if (intro) pieces.push({ section: "Description", body: intro });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const start = m.index ?? 0;
    const title = m[1] ?? "Section";
    const bodyStart = start + title.length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length;
    let body = text.slice(bodyStart, end).trim();
    body = body.replace(/^[\s:;–—-]+/, "").trim();
    pieces.push({ section: normalizeSectionTitle(title), body: body || title });
  }

  return pieces.filter((p) => p.body.length > 0);
}

function normalizeSectionTitle(title: string): string {
  const hit = SECTION_TITLES.find((t) => t.toLowerCase() === title.toLowerCase());
  return hit ?? title.trim();
}

/** Split oversized section bodies on sentence boundaries when possible. */
export function splitLongBody(body: string, maxChars: number): string[] {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) return [trimmed];

  const parts: string[] = [];
  let rest = trimmed;
  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars);
    const breakAt = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("! "),
      window.lastIndexOf("? "),
      window.lastIndexOf("\n"),
      window.lastIndexOf("; "),
    );
    const cut = breakAt > maxChars * 0.4 ? breakAt + 1 : maxChars;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

export type ChunkProductOptions = {
  maxChars?: number;
};

/**
 * Build RAG chunks for one product.
 * Every chunk starts with the same product header (SKU/name/brand/category).
 * Never includes price or stock.
 */
export function chunkProduct(
  product: RagProductInput,
  options: ChunkProductOptions = {},
): ProductChunkDraft[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const header = buildProductHeader(product);
  const bodyBudget = Math.max(200, maxChars - header.length - 2);

  const description = product.description?.trim() ?? "";
  const sections = description
    ? splitIntoSections(description)
    : [{ section: "Fiche", body: product.name }];

  const drafts: ProductChunkDraft[] = [];
  let chunkIndex = 0;

  for (const { section, body } of sections) {
    const bodies = splitLongBody(body, bodyBudget);
    for (let i = 0; i < bodies.length; i++) {
      const piece = bodies[i]!;
      const label = bodies.length > 1 ? `${section} (${i + 1}/${bodies.length})` : section;
      const content = `${header}\n\n[${label}]\n${piece}`;
      drafts.push({
        productId: product.id,
        chunkIndex,
        section: label,
        content,
        contentHash: hashContent(content),
        tokenCount: estimateTokenCount(content),
      });
      chunkIndex += 1;
    }
  }

  if (!drafts.length) {
    const content = `${header}\n\n[Fiche]\n${product.name}`;
    drafts.push({
      productId: product.id,
      chunkIndex: 0,
      section: "Fiche",
      content,
      contentHash: hashContent(content),
      tokenCount: estimateTokenCount(content),
    });
  }

  return drafts;
}
