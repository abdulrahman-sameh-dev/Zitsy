import { describe, expect, it } from "vitest";

import {
  type ProfitabilityInput,
  evaluateProfitability,
} from "@/lib/checkout/profitability";

const CONFIG = {
  paymentFeePercent: 3.4,
  paymentFeeFixedMinor: 20,
  merchantFixedCostMinor: 0,
  minContributionMinor: 1,
};

function evaluate(overrides: Partial<ProfitabilityInput>) {
  return evaluateProfitability({
    ...CONFIG,
    productRevenueMinor: 0,
    shippingRevenueMinor: 0,
    productionCostMinor: 0,
    expectedShippingCostMinor: 0,
    ...overrides,
  });
}

describe("evaluateProfitability", () => {
  it("allows a profitable order", () => {
    const result = evaluate({
      productRevenueMinor: 2000,
      shippingRevenueMinor: 800,
      productionCostMinor: 1000,
      expectedShippingCostMinor: 800,
    });
    expect(result.profitable).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.expectedContributionMinor).toBeGreaterThan(0);
  });

  it("computes the payment fee on the full charged amount (product + shipping)", () => {
    const result = evaluate({
      productRevenueMinor: 1000,
      shippingRevenueMinor: 1000,
      productionCostMinor: 1,
      expectedShippingCostMinor: 0,
    });
    // ceil(2000 × 3.4%) + 20 = 68 + 20
    expect(result.paymentFeeMinor).toBe(88);
  });

  it("rejects an order with exactly zero contribution", () => {
    const result = evaluate({
      paymentFeePercent: 0,
      paymentFeeFixedMinor: 0,
      productRevenueMinor: 2000,
      productionCostMinor: 2000,
    });
    expect(result.expectedContributionMinor).toBe(0);
    expect(result.profitable).toBe(false);
    expect(result.reason).toBe("non_positive_contribution");
  });

  it("rejects an order with negative contribution", () => {
    const result = evaluate({
      productRevenueMinor: 2000,
      productionCostMinor: 2100,
    });
    expect(result.expectedContributionMinor).toBeLessThan(0);
    expect(result.profitable).toBe(false);
    expect(result.reason).toBe("non_positive_contribution");
  });

  it("rejects a product-profitable order that is unprofitable as a whole", () => {
    const singleLine = evaluate({
      productRevenueMinor: 1200,
      productionCostMinor: 1000,
    });
    expect(singleLine.expectedContributionMinor).toBeGreaterThan(0);

    const wholeOrder = evaluate({
      productRevenueMinor: 1200,
      productionCostMinor: 1000,
      expectedShippingCostMinor: 1500,
    });
    expect(wholeOrder.profitable).toBe(false);
    expect(wholeOrder.reason).toBe("non_positive_contribution");
  });

  it("rejects when the expected shipping cost causes a loss", () => {
    const result = evaluate({
      productRevenueMinor: 2000,
      shippingRevenueMinor: 0,
      productionCostMinor: 1000,
      expectedShippingCostMinor: 1500,
    });
    expect(result.profitable).toBe(false);
    expect(result.reason).toBe("non_positive_contribution");
  });

  it("rejects when the payment fee causes a loss", () => {
    const result = evaluate({
      productRevenueMinor: 1000,
      productionCostMinor: 995,
    });
    // 1000 − 995 − (34 + 20) = −49
    expect(result.expectedContributionMinor).toBe(-49);
    expect(result.profitable).toBe(false);
  });

  it("rejects when a configured merchant-side cost causes a loss", () => {
    const withoutCost = evaluate({
      productRevenueMinor: 1000,
      productionCostMinor: 900,
    });
    expect(withoutCost.profitable).toBe(true);

    const withCost = evaluate({
      productRevenueMinor: 1000,
      productionCostMinor: 900,
      merchantFixedCostMinor: 100,
    });
    expect(withCost.profitable).toBe(false);
    expect(withCost.reason).toBe("non_positive_contribution");
  });

  it("rejects when production cost is missing (never treats 0 as free)", () => {
    const result = evaluate({
      productRevenueMinor: 2000,
      shippingRevenueMinor: 800,
      productionCostMinor: 0,
    });
    expect(result.profitable).toBe(false);
    expect(result.reason).toBe("missing_production_cost");
  });

  it("aggregates quantities: cost × quantity, not cost × 1", () => {
    const qtyOne = evaluate({
      productRevenueMinor: 600,
      productionCostMinor: 1000,
    });
    expect(qtyOne.profitable).toBe(false);

    const qtyTwo = evaluate({
      productRevenueMinor: 1200,
      productionCostMinor: 2000,
    });
    expect(qtyTwo.productionCostMinor).toBe(2000);
  });

  it("aggregates multiple cart lines into a single order contribution", () => {
    const result = evaluate({
      productRevenueMinor: 2000 + 3000,
      shippingRevenueMinor: 500,
      productionCostMinor: 1000 + 1500,
      expectedShippingCostMinor: 500,
    });
    expect(result.productRevenueMinor).toBe(5000);
    expect(result.productionCostMinor).toBe(2500);
    expect(result.profitable).toBe(true);
  });

  it("honours a minimum contribution greater than zero", () => {
    const result = evaluate({
      paymentFeePercent: 0,
      paymentFeeFixedMinor: 0,
      minContributionMinor: 500,
      productRevenueMinor: 1200,
      productionCostMinor: 1000,
    });
    expect(result.expectedContributionMinor).toBe(200);
    expect(result.profitable).toBe(false);
  });

  it("fails closed when the fee configuration produces a non-finite fee", () => {
    const result = evaluate({
      paymentFeePercent: Number.NaN,
      productRevenueMinor: 2000,
      productionCostMinor: 1000,
    });
    expect(Number.isFinite(result.paymentFeeMinor)).toBe(true);
    expect(result.profitable).toBe(false);
    expect(result.reason).toBe("non_positive_contribution");
  });

  it("still rejects a zero-contribution order when the minimum is invalid", () => {
    const result = evaluate({
      paymentFeePercent: 0,
      paymentFeeFixedMinor: 0,
      minContributionMinor: Number.NaN,
      productRevenueMinor: 1000,
      productionCostMinor: 1000,
    });
    expect(result.expectedContributionMinor).toBe(0);
    expect(result.profitable).toBe(false);
    expect(result.reason).toBe("non_positive_contribution");
  });
});
