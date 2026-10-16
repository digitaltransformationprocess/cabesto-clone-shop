import { describe, expect, it } from "vitest";
import {
  filterNoiseSiteChunks,
  hasUsefulSources,
  isOutOfScopeQuery,
  normalizeSearchQuery,
  stripRecruitmentFromMarkdown,
} from "./rag-guardrails";
import type { RetrievedProduct, RetrievedSiteChunk } from "./retrieve";

describe("isOutOfScopeQuery", () => {
  it("flags cars / irrelevant domains", () => {
    expect(isOutOfScopeQuery("est ce que vous vend du voiture electrique")).toBe(true);
    expect(isOutOfScopeQuery("Je cherche un masque snorkeling")).toBe(false);
  });
});

describe("normalizeSearchQuery", () => {
  it("cleans common FR fillers", () => {
    const q = normalizeSearchQuery("est ce que vous vendez du masque ?");
    expect(q.toLowerCase()).toContain("masque");
    expect(q.toLowerCase()).not.toMatch(/^est ce que/);
  });

  it("fixes electrique typo", () => {
    expect(normalizeSearchQuery("moteur electrique")).toMatch(/électrique/i);
  });
});

describe("stripRecruitmentFromMarkdown", () => {
  it("keeps détaxe / catalogue and drops postuler Q&A", () => {
    const md = `## Autre

Possédez-vous un catalogue papier ?

Nous n'avons pas de catalogue papier.

Comment postuler chez Cabesto ?

Vous pouvez postuler chez Cabesto — formulaire de recrutement LinkedIn.

Comment contacter mon magasin Cabesto ?

Vous pouvez retrouver la liste des magasins ici.
`;
    const cleaned = stripRecruitmentFromMarkdown(md);
    expect(cleaned).toMatch(/catalogue papier/i);
    expect(cleaned).toMatch(/contacter mon magasin/i);
    expect(cleaned).not.toMatch(/postuler/i);
    expect(cleaned).not.toMatch(/LinkedIn/i);
  });
});

describe("filterNoiseSiteChunks", () => {
  it("scrubs recruitment from mixed FAQ chunk without dropping détaxe", () => {
    const docs: RetrievedSiteChunk[] = [
      {
        chunkId: "1",
        docId: "faq",
        pagePath: "/faq",
        title: "FAQ",
        section: "Autre",
        content: `Page: FAQ
URL: /faq
Section: Autre

Possédez-vous un catalogue papier ?
Nous n'avons pas de catalogue papier.

Comment postuler chez Cabesto ?
Vous pouvez postuler chez Cabesto — formulaire de recrutement LinkedIn.

Comment contacter mon magasin ?
Liste des magasins sur /magasins.`,
        similarity: 0.5,
      },
      {
        chunkId: "2",
        docId: "livraison",
        pagePath: "/livraison",
        title: "Livraison",
        section: "Délais",
        content:
          "Livraison Colissimo sous 48 h ouvrées pour la France métropolitaine. Chronopost disponible.",
        similarity: 0.55,
      },
    ];
    const cleaned = filterNoiseSiteChunks(docs);
    expect(cleaned).toHaveLength(2);
    expect(cleaned[0]?.content).toMatch(/catalogue papier/i);
    expect(cleaned[0]?.content).not.toMatch(/postuler|LinkedIn/i);
    expect(cleaned[1]?.pagePath).toBe("/livraison");
  });

  it("drops pure recruitment FAQ", () => {
    const docs: RetrievedSiteChunk[] = [
      {
        chunkId: "1",
        docId: "faq",
        pagePath: "/faq",
        title: "FAQ",
        section: "Autre",
        content: "Vous pouvez postuler chez Cabesto — formulaire de recrutement LinkedIn.",
        similarity: 0.5,
      },
    ];
    expect(filterNoiseSiteChunks(docs)).toHaveLength(0);
  });
});

describe("hasUsefulSources", () => {
  it("rejects weak-only matches", () => {
    const products: RetrievedProduct[] = [
      {
        sku: "X",
        name: "X",
        priceCents: 100,
        stock: 1,
        productId: "1",
        sections: [],
        snippets: [],
        maxSimilarity: 0.2,
      },
    ];
    expect(hasUsefulSources(products, [])).toBe(false);
  });
});
