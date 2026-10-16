import { createHash } from "node:crypto";
import { estimateTokenCount, hashContent, splitLongBody } from "./chunk-product";
import { stripRecruitmentFromMarkdown } from "./rag-guardrails";

export type SiteDocInput = {
  docId: string;
  title: string;
  pagePath: string;
  body: string;
};

export type SiteChunkDraft = {
  docId: string;
  pagePath: string;
  title: string;
  chunkIndex: number;
  section: string;
  content: string;
  contentHash: string;
  tokenCount: number;
};

const DEFAULT_MAX_CHARS = 1400;

/** Split markdown on ## / ### headings when present. */
export function splitMarkdownSections(body: string): { section: string; body: string }[] {
  const text = body.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const re = /^#{2,3}\s+(.+)$/gm;
  const matches = [...text.matchAll(re)];
  if (!matches.length) {
    return [{ section: "Contenu", body: text }];
  }

  const pieces: { section: string; body: string }[] = [];
  const firstIdx = matches[0]!.index ?? 0;
  if (firstIdx > 0) {
    const intro = text.slice(0, firstIdx).trim();
    if (intro) pieces.push({ section: "Introduction", body: intro });
  }

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const title = (m[1] ?? "Section").trim();
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1]!.index ?? text.length) : text.length;
    const sectionBody = text.slice(start, end).trim();
    if (sectionBody) pieces.push({ section: title, body: sectionBody });
  }
  return pieces;
}

function buildHeader(doc: SiteDocInput, section: string): string {
  return [`Page: ${doc.title}`, `URL: ${doc.pagePath}`, `Section: ${section}`].join("\n");
}

export function chunkSiteDoc(doc: SiteDocInput, maxChars = DEFAULT_MAX_CHARS): SiteChunkDraft[] {
  const cleanedBody = stripRecruitmentFromMarkdown(doc.body);
  const sections = splitMarkdownSections(cleanedBody);
  const drafts: SiteChunkDraft[] = [];
  let chunkIndex = 0;

  for (const { section, body } of sections.length ? sections : [{ section: "Contenu", body: doc.body }]) {
    const header = buildHeader(doc, section);
    const budget = Math.max(200, maxChars - header.length - 2);
    const parts = splitLongBody(body, budget);
    for (let i = 0; i < parts.length; i++) {
      const label = parts.length > 1 ? `${section} (${i + 1}/${parts.length})` : section;
      const content = `${buildHeader(doc, label)}\n\n${parts[i]}`;
      drafts.push({
        docId: doc.docId,
        pagePath: doc.pagePath,
        title: doc.title,
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
    const content = `${buildHeader(doc, "Contenu")}\n\n${doc.title}`;
    drafts.push({
      docId: doc.docId,
      pagePath: doc.pagePath,
      title: doc.title,
      chunkIndex: 0,
      section: "Contenu",
      content,
      contentHash: createHash("sha256").update(content, "utf8").digest("hex"),
      tokenCount: estimateTokenCount(content),
    });
  }

  return drafts;
}

export type StoreRecord = {
  name: string;
  address: string;
  city: string;
  phone: string;
  universes?: string[];
  hours?: string;
};

/** One chunk per store (or small batches if needed). */
export function chunkStores(
  stores: StoreRecord[],
  pagePath = "/magasins",
  title = "Magasins",
): SiteChunkDraft[] {
  return stores.map((s, i) => {
    const universes = (s.universes ?? []).join(", ");
    const body = [
      `Magasin: ${s.name}`,
      `Adresse: ${s.address}`,
      `Ville: ${s.city}`,
      `Téléphone: ${s.phone}`,
      s.hours ? `Horaires: ${s.hours}` : null,
      universes ? `Univers: ${universes}` : null,
      `Lien: ${pagePath}`,
    ]
      .filter(Boolean)
      .join("\n");
    const content = `Page: ${title}\nURL: ${pagePath}\nSection: ${s.name}\n\n${body}`;
    return {
      docId: "magasins",
      pagePath,
      title,
      chunkIndex: i,
      section: s.name,
      content,
      contentHash: hashContent(content),
      tokenCount: estimateTokenCount(content),
    };
  });
}
