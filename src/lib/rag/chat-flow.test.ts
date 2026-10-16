import { describe, expect, it } from "vitest";
import {
  detectSavIssue,
  isMostlyOrderId,
  parseOrderId,
  savPriorityForIssue,
} from "./chat-flow";

describe("parseOrderId", () => {
  it("normalizes spaced and compact ids", () => {
    expect(parseOrderId("CMD 1098")).toBe("CMD-1098");
    expect(parseOrderId("cmd1098")).toBe("CMD-1098");
    expect(parseOrderId("CMD-1098")).toBe("CMD-1098");
    expect(parseOrderId("n° CMD 1101 svp")).toBe("CMD-1101");
  });

  it("returns null when absent", () => {
    expect(parseOrderId("masque snorkeling")).toBeNull();
  });
});

describe("isMostlyOrderId", () => {
  it("detects bare order messages", () => {
    expect(isMostlyOrderId("CMD 1098")).toBe(true);
    expect(isMostlyOrderId("CMD-1098")).toBe(true);
    expect(isMostlyOrderId("problème CMD 1098")).toBe(false);
  });
});

describe("detectSavIssue", () => {
  it("maps common motifs", () => {
    expect(detectSavIssue("Article endommagé")).toBe("endommagé");
    expect(detectSavIssue("pas reçu")).toBe("pas_reçu");
    expect(detectSavIssue("retard de livraison")).toBe("retard");
  });
});

describe("savPriorityForIssue", () => {
  it("assigns POC priorities", () => {
    expect(savPriorityForIssue("endommagé")).toEqual({
      priority: "P2",
      targetSla: "1 jour ouvré",
    });
    expect(savPriorityForIssue("retour").priority).toBe("P3");
    expect(savPriorityForIssue("autre").priority).toBe("P4");
  });
});
