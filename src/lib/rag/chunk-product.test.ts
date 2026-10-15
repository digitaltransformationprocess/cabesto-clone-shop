import { describe, expect, it } from "vitest";
import {
  buildProductHeader,
  chunkProduct,
  hashContent,
  splitIntoSections,
} from "./chunk-product";

const sample = {
  id: "11111111-1111-1111-1111-111111111111",
  sku: "SU-0004464",
  name: "Ordinateur de plongée GENIUS MARES",
  brand: "MARES",
  categoryPath: ["plongee", "ordinateurs"],
  description:
    "Intro du produit pour la plongée technique.Caractéristiques Écran couleur haute résolution. Autonomie 40 heures.Informations techniques Mode Air NITROX TRIMIX.Contenu du colis1 x Ordinateur GENIUS et cordon USB.",
};

describe("chunkProduct", () => {
  it("builds a header without price or stock", () => {
    const h = buildProductHeader(sample);
    expect(h).toContain("SKU: SU-0004464");
    expect(h).toContain("Marque: MARES");
    expect(h).toContain("Catégorie: plongee > ordinateurs");
    expect(h.toLowerCase()).not.toMatch(/prix|stock|€/);
  });

  it("splits on section titles even when glued", () => {
    const sections = splitIntoSections(sample.description);
    expect(sections.map((s) => s.section)).toEqual([
      "Description",
      "Caractéristiques",
      "Informations techniques",
      "Contenu du colis",
    ]);
  });

  it("prefixes every chunk with the product header", () => {
    const chunks = chunkProduct(sample);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    const header = buildProductHeader(sample);
    for (const c of chunks) {
      expect(c.content.startsWith(header)).toBe(true);
      expect(c.content).not.toMatch(/\bstock\b/i);
      expect(c.contentHash).toBe(hashContent(c.content));
      expect(c.productId).toBe(sample.id);
    }
    const indexes = chunks.map((c) => c.chunkIndex);
    expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
  });

  it("strips dedicated price/stock lines from description", () => {
    const chunks = chunkProduct({
      ...sample,
      description: "Bon produit.\nPrix: 12,99 €\nStock: 5\nCaractéristiques Légère.",
    });
    const joined = chunks.map((c) => c.content).join("\n");
    expect(joined).not.toMatch(/Prix:\s*12/);
    expect(joined).not.toMatch(/Stock:\s*5/);
    expect(joined).toContain("Caractéristiques");
  });

  it("splits a long real-world-like fiche across sections", () => {
    const longBody = `${"A".repeat(900)}. Suite du texte.Caractéristiques ${"B".repeat(1600)}.Informations techniques ${"C".repeat(500)}.Contenu du colis item A et item B.`;
    const chunks = chunkProduct({ ...sample, description: longBody });
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((c) => c.content.startsWith("SKU:"))).toBe(true);
    expect(chunks.some((c) => c.section.startsWith("Caractéristiques"))).toBe(true);
    expect(chunks.every((c) => c.contentHash.length === 64)).toBe(true);
  });
});
