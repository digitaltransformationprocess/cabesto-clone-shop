/**
 * Relevance / out-of-scope guards for RAG chat.
 * Prevents weak matches (e.g. recruitment FAQ) from polluting product answers.
 */

import type { RetrievedProduct, RetrievedSiteChunk } from "./retrieve";

/** Topics clearly outside Marinéo / Cabesto leisure catalog */
const OUT_OF_SCOPE_RE =
  /\b(voiture|auto(?:mobile)?s?|v[eé]hicule|tesla|camion|moto(?!r\s*hors[\s-]?bord)|scooter\s+(?!sous)|immobilier|appartement|assurance\s+vie|crypto|bitcoin|iphone|samsung\s+galaxy|ordinateur\s+portable|pc\s+gamer)\b/i;

/** Site chunks that are rarely useful for shoppers */
const NOISE_DOC_RE =
  /\b(recrut(?:ement|er)|postuler|offre\s+d['’]emploi|linkedin|candidature|rh\b|ressources\s+humaines|contrat\s+de\s+travail)\b/i;

export const OUT_OF_CATALOG_REPLY =
  "Je ne trouve pas cela dans notre catalogue. Marinéo / Cabesto propose surtout du matériel de **pêche, nautisme, plongée, montagne, piscine et alimentation**. Reformulez avec un produit ou une categorie de loisirs, ou demandez livraison / retours / magasins.";

export function isOutOfScopeQuery(query: string): boolean {
  return OUT_OF_SCOPE_RE.test(query);
}

/** Light FR cleanup before embedding (typos / filler). */
export function normalizeSearchQuery(query: string): string {
  let q = query.trim().replace(/\s+/g, " ");
  q = q
    .replace(/\bvend(?:ez|re)?\s+du\b/gi, "vendez des")
    .replace(/\best[\s-]?ce\s+que\s+(vous|tu)\s+/gi, "")
    .replace(/\bavez[\s-]?vous\s+/gi, "")
    .replace(/\belectrique\b/gi, "électrique")
    .replace(/\bsnorkelling\b/gi, "snorkeling")
    .replace(/[?¿]+$/g, "")
    .trim();
  return q || query.trim();
}

/**
 * Remove RH / recrutement Q&A blocks from markdown before indexing,
 * so mixed FAQ sections (e.g. ## Autre) keep useful answers without RH pollution.
 */
export function stripRecruitmentFromMarkdown(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const isHeading = /^#{1,3}\s/.test(trimmed);
    const isQuestion = /\?\s*$/.test(trimmed) && trimmed.length > 0 && trimmed.length < 160;
    if (skipping) {
      if (isHeading || (isQuestion && !NOISE_DOC_RE.test(trimmed))) {
        skipping = false;
      } else {
        continue;
      }
    }
    if (isQuestion && NOISE_DOC_RE.test(trimmed)) {
      skipping = true;
      continue;
    }
    if (
      !skipping &&
      NOISE_DOC_RE.test(trimmed) &&
      /\b(linkedin|formulaire de recrutement|postuler chez|page LinkedIn)\b/i.test(trimmed)
    ) {
      continue;
    }
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** True when the chunk is (almost) only recruitment noise. */
export function isNoiseSiteChunk(c: RetrievedSiteChunk): boolean {
  const scrubbed = stripRecruitmentFromMarkdown(c.content);
  if (scrubbed.length >= 80) return false;
  const blob = `${c.title} ${c.section ?? ""} ${c.pagePath} ${c.content}`;
  return NOISE_DOC_RE.test(blob);
}

function siteChunkBodyOnly(content: string): string {
  return content
    .replace(/^Page:\s*.*$/gim, "")
    .replace(/^URL:\s*.*$/gim, "")
    .replace(/^Section:\s*.*$/gim, "")
    .trim();
}

/** Scrub RH paragraphs; drop chunks that have nothing useful left. */
export function filterNoiseSiteChunks(docs: RetrievedSiteChunk[]): RetrievedSiteChunk[] {
  return docs
    .map((d) => ({ ...d, content: stripRecruitmentFromMarkdown(d.content) }))
    .filter((d) => siteChunkBodyOnly(d.content).length >= 40);
}

/** Keep only chunks above a floor; drop the long tail of weak matches. */
export function filterByMinSimilarity<T extends { similarity: number }>(
  items: T[],
  minSim: number,
): T[] {
  return items.filter((i) => i.similarity >= minSim);
}

export function topSimilarity(
  products: RetrievedProduct[],
  docs: RetrievedSiteChunk[],
): number {
  const p = products[0]?.maxSimilarity ?? 0;
  const d = docs[0]?.similarity ?? 0;
  return Math.max(p, d);
}

/**
 * True when retrieve results are strong enough to answer (or to use deterministic fallback).
 * Weak docs alone should not override "Je ne sais pas".
 */
export function hasUsefulSources(
  products: RetrievedProduct[],
  docs: RetrievedSiteChunk[],
  opts: { productMin?: number; docMin?: number } = {},
): boolean {
  const productMin = opts.productMin ?? 0.34;
  const docMin = opts.docMin ?? 0.32;
  if (products.some((p) => p.maxSimilarity >= productMin)) return true;
  if (docs.some((d) => d.similarity >= docMin)) return true;
  return false;
}

export function trimToRelevantProducts(
  products: RetrievedProduct[],
  minSim = 0.34,
  max = 3,
): RetrievedProduct[] {
  return products.filter((p) => p.maxSimilarity >= minSim).slice(0, max);
}

export function trimToRelevantDocs(
  docs: RetrievedSiteChunk[],
  minSim = 0.32,
  max = 4,
): RetrievedSiteChunk[] {
  const cleaned = filterNoiseSiteChunks(docs).filter((d) => d.similarity >= minSim);
  // One chunk per page max (avoid FAQ spam)
  const byPage = new Map<string, RetrievedSiteChunk>();
  for (const d of cleaned) {
    const prev = byPage.get(d.pagePath);
    if (!prev || d.similarity > prev.similarity) byPage.set(d.pagePath, d);
  }
  return [...byPage.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, max);
}
