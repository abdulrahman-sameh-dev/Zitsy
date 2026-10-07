import { describe, expect, it } from "vitest";

import {
  charmPriceMinor,
  markupFloorMinor,
  pricingFromCost,
  toStoreMinor,
} from "@/lib/pricing";

describe("toStoreMinor", () => {
  it("converts Printify source-currency minor units into store currency", () => {
    // USD -> GBP at 0.754: $10.00 -> £7.54
    expect(toStoreMinor(1000)).toBe(754);
  });

  it("converts exactly once (source currency is not treated as store currency)", () => {
    // $10.00 must become £7.54, never £10.00 and never double-converted.
    expect(toStoreMinor(1000, "USD")).toBe(754);
    expect(toStoreMinor(1000, "USD")).not.toBe(1000);
    expect(toStoreMinor(754, "GBP")).toBe(754);
  });

  it("fails safely when no FX rate is configured", () => {
    expect(() => toStoreMinor(1000, "JPY")).toThrow();
  });
});

describe("charmPriceMinor", () => {
  it("rounds up to the next .99", () => {
    expect(charmPriceMinor(1000)).toBe(1099);
    expect(charmPriceMinor(1001)).toBe(1099);
    expect(charmPriceMinor(1100)).toBe(1199);
  });

  it("never rounds a computed floor down", () => {
    for (const floor of [1, 50, 99, 100, 1300, 1400, 1886]) {
      expect(charmPriceMinor(floor)).toBeGreaterThanOrEqual(floor);
    }
  });

  it("returns 0 for non-positive input", () => {
    expect(charmPriceMinor(0)).toBe(0);
  });
});

describe("markupFloorMinor", () => {
  it("applies a 30% markup to the store-currency cost", () => {
    // £10.00 + 30% = £13.00 floor
    expect(markupFloorMinor(1000, 30)).toBe(1300);
  });

  it("applies a 40% markup to the store-currency cost", () => {
    // £10.00 + 40% = £14.00 floor
    expect(markupFloorMinor(1000, 40)).toBe(1400);
  });

  it("is a markup, not a gross margin (40% markup != 40% margin)", () => {
    const costMinor = 1000;
    const priceMinor = markupFloorMinor(costMinor, 40);
    const grossMargin = (priceMinor - costMinor) / priceMinor;
    expect(priceMinor).toBe(1400);
    expect(grossMargin).toBeCloseTo(0.2857, 3); // ~28.6%, not 40%
    expect(grossMargin).not.toBeCloseTo(0.4, 3);
  });

  it("floors fractional pence instead of dropping below the markup", () => {
    // 1055 * 1.4 = 1477.0 -> 1477 ; 1056 * 1.4 = 1478.4 -> 1479
    expect(markupFloorMinor(1055, 40)).toBe(1477);
    expect(markupFloorMinor(1056, 40)).toBe(1479);
  });
});

describe("pricingFromCost", () => {
  it("derives a store-currency cost and marked-up charm price", () => {
    const pricing = pricingFromCost(1000);
    expect(pricing).not.toBeNull();
    expect(pricing).toMatchObject({ costMinor: 754, priceMinor: 1099, currency: "GBP" });
  });

  it("never prices below the configured markup floor", () => {
    const pricing = pricingFromCost(1000)!;
    const floor = markupFloorMinor(pricing.costMinor, 40);
    expect(pricing.priceMinor).toBeGreaterThanOrEqual(floor);
    expect(charmPriceMinor(floor)).toBe(pricing.priceMinor);
  });

  it("ignores Printify retail price — pricing is derived from cost alone", () => {
    // The only input is the production cost; a Printify "price" is never used.
    const fromCost = pricingFromCost(1000);
    expect(fromCost?.priceMinor).toBe(1099);
    // $8.60 retail ($6.48 store) would charm to a different price; it must not
    // influence the result because Zitsy never reads variant.price.
    expect(pricingFromCost(860)?.priceMinor).not.toBe(fromCost?.priceMinor);
  });

  it("returns null when no usable cost is available", () => {
    expect(pricingFromCost(undefined)).toBeNull();
    expect(pricingFromCost(null)).toBeNull();
    expect(pricingFromCost(0)).toBeNull();
  });
});