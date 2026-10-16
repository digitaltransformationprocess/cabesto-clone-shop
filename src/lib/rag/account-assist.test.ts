import { describe, expect, it } from "vitest";
import type { Order } from "@/lib/data";
import {
  buildOrderTrackingReply,
  enrichOrderTracking,
  ordersToSession,
} from "./account-assist";

const base: Order = {
  id: "CMD-1101",
  customer: "Julie Martin",
  email: "client@test.fr",
  date: "2026-10-01",
  items: [{ id: "SKU1", qty: 1 }],
  status: "Expédiée",
  carrier: "Colissimo",
  trackingCode: "CO1101FR",
};

describe("enrichOrderTracking", () => {
  it("adds eta and tracking url for shipped orders", () => {
    const e = enrichOrderTracking(base);
    expect(e.trackingCode).toBe("CO1101FR");
    expect(e.trackingUrl).toContain("suivi.demo/track/");
    expect(e.etaWindow).toMatch(/Livraison estimée/i);
    expect(e.lastEvent).toBeTruthy();
  });
});

describe("buildOrderTrackingReply", () => {
  it("includes suivi details for a known order id", () => {
    const session = ordersToSession([base], "client@test.fr");
    const reply = buildOrderTrackingReply(session, "CMD 1101");
    expect(reply).toContain("CMD-1101");
    expect(reply).toContain("CO1101FR");
    expect(reply).toMatch(/Livraison estimée|suivi\.demo/i);
  });
});
