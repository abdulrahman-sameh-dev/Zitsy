import { describe, expect, it } from "vitest";

import { buildCartView, emptyCartView, type CartItemRecord } from "@/lib/cart/view";

function item(overrides: {
  id?: string;
  quantity?: number;
  unitPriceMinor?: number;
  priceMinor?: number;
  isEnabled?: boolean;
  isAvailable?: boolean;
  visible?: boolean;
}): CartItemRecord {
  return {
    id: overrides.id ?? "ci_1",
    quantity: overrides.quantity ?? 1,
    unitPriceMinor: overrides.unitPriceMinor ?? 1000,
    currency: "GBP",
    variant: {
      id: "var_1",
      title: "11oz / Black",
      priceMinor: overrides.priceMinor ?? 1000,
      currency: "GBP",
      isEnabled: overrides.isEnabled ?? true,
      isAvailable: overrides.isAvailable ?? true,
      product: {
        id: "prd_1",
        slug: "test-product",
        title: "Test Product",
        visible: overrides.visible ?? true,
        images: [{ src: "https://example.test/a.jpg" }],
      },
    },
  };
}

describe("buildCartView", () => {
  it("returns an empty view with the fallback currency", () => {
    expect(emptyCartView("GBP")).toMatchObject({
      lines: [],
      totalQuantity: 0,
      subtotalMinor: 0,
      currency: "GBP",
      canCheckout: false,
    });
  });

  it("uses the current variant price, not the recorded snapshot", () => {
    const view = buildCartView(
      { items: [item({ unitPriceMinor: 800, priceMinor: 1000, quantity: 2 })] },
      "GBP",
    );
    expect(view.lines[0].unitPriceMinor).toBe(1000);
    expect(view.lines[0].recordedPriceMinor).toBe(800);
    expect(view.lines[0].lineTotalMinor).toBe(2000);
    expect(view.subtotalMinor).toBe(2000);
    expect(view.lines[0].priceChanged).toBe(true);
    expect(view.priceChanged).toBe(true);
  });

  it("does not flag a price change when the price is unchanged", () => {
    const view = buildCartView({ items: [item({})] }, "GBP");
    expect(view.lines[0].priceChanged).toBe(false);
    expect(view.priceChanged).toBe(false);
  });

  it("marks disabled, unavailable and hidden variants unavailable with a reason", () => {
    const view = buildCartView(
      {
        items: [
          item({ id: "a", isEnabled: false }),
          item({ id: "b", isAvailable: false }),
          item({ id: "c", visible: false }),
        ],
      },
      "GBP",
    );
    expect(view.lines.map((l) => l.unavailableReason)).toEqual([
      "variant_disabled",
      "variant_unavailable",
      "product_hidden",
    ]);
    expect(view.hasUnavailable).toBe(true);
    expect(view.canCheckout).toBe(false);
  });

  it("excludes unavailable lines from the subtotal but counts every quantity", () => {
    const view = buildCartView(
      {
        items: [
          item({ id: "ok", quantity: 2, priceMinor: 500 }),
          item({ id: "bad", quantity: 3, priceMinor: 900, isAvailable: false }),
        ],
      },
      "GBP",
    );
    expect(view.subtotalMinor).toBe(1000);
    expect(view.availableQuantity).toBe(2);
    expect(view.totalQuantity).toBe(5);
    expect(view.hasUnavailable).toBe(true);
    expect(view.canCheckout).toBe(false);
  });

  it("allows checkout only when every line is available and at least one exists", () => {
    const view = buildCartView({ items: [item({}), item({ id: "2" })] }, "GBP");
    expect(view.canCheckout).toBe(true);
  });
});