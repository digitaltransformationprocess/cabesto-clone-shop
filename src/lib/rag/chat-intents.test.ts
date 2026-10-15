import { describe, expect, it } from "vitest";
import { detectChatIntent, requiresAuth } from "./chat-intents";
import { detectCartIntent } from "./chat-cart";

describe("detectChatIntent", () => {
  it("gates order tracking", () => {
    expect(detectChatIntent("Je veux suivre ma commande")).toBe("order_tracking");
    expect(requiresAuth("order_tracking")).toBe(true);
  });

  it("allows delivery FAQ anonymously", () => {
    expect(detectChatIntent("Quels sont les délais de livraison ?")).toBe("delivery_info");
    expect(requiresAuth("delivery_info")).toBe(false);
  });

  it("detects SAV", () => {
    expect(detectChatIntent("J'ai un problème avec une commande")).toBe("sav");
    expect(requiresAuth("sav")).toBe(true);
  });

  it("does not treat bare suivre as order", () => {
    expect(detectChatIntent("comment suivre ce guide plongée")).toBe("product");
  });
});

describe("detectCartIntent", () => {
  it("detects panier and confirm", () => {
    expect(detectCartIntent("mon panier")).toBe("view_cart");
    expect(detectCartIntent("commander")).toBe("start_checkout");
    expect(detectCartIntent("Je confirme")).toBe("confirm_order");
  });
});
