/**
 * Order-level profitability safety.
 *
 * Product pricing (see `@/lib/pricing`) answers "what should this product cost?".
 * This module answers a different, separate question: "can Zitsy safely accept
 * this complete order?" — across every cart line, its production cost, the
 * expected Printify shipping cost, a payment-processing allowance, and any
 * configured merchant-side costs.
 *
 * All amounts are integer minor units in the store currency. No floats.
 */

export interface ProfitabilityConfig {
  /** Payment-processing allowance, e.g. 3.4 (percent of the charged amount). Assumption, not a contract fee. */
  paymentFeePercent: number;
  /** Fixed payment-processing allowance, in store minor units. */
  paymentFeeFixedMinor: number;
  /** Fixed merchant-side cost allowance per order, in store minor units. */
  merchantFixedCostMinor: number;
  /** Minimum acceptable expected contribution; must be positive. */
  minContributionMinor: number;
}

export interface ProfitabilityInput extends ProfitabilityConfig {
  /** Customer product revenue (sum of product prices × quantity). */
  productRevenueMinor: number;
  /** Customer shipping revenue charged for this order. */
  shippingRevenueMinor: number;
  /** Fulfillment cost: sum of ProductVariant.costMinor × quantity. */
  productionCostMinor: number;
  /** Expected Printify shipping cost (pre-order quote, converted to store currency). */
  expectedShippingCostMinor: number;
}

export type ProfitabilityReason = "missing_production_cost" | "non_positive_contribution";

export interface ProfitabilityResult {
  productRevenueMinor: number;
  shippingRevenueMinor: number;
  orderRevenueMinor: number;
  productionCostMinor: number;
  expectedShippingCostMinor: number;
  paymentFeeMinor: number;
  merchantFixedCostMinor: number;
  expectedContributionMinor: number;
  profitable: boolean;
  reason: ProfitabilityReason | null;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * Evaluate the expected contribution of an order.
 *
 *   productRevenue + shippingRevenue
 *     - productionCost
 *     - expectedShippingCost
 *     - paymentFee
 *     - merchantFixedCost
 *   = expectedContribution
 *
 * `paymentFee = ceil(orderRevenue × paymentFeePercent / 100) + paymentFeeFixedMinor`,
 * applied to the amount actually charged to the customer (product + shipping).
 */
export function evaluateProfitability(
  input: ProfitabilityInput,
): ProfitabilityResult {
  const productRevenueMinor = finiteNonNegative(input.productRevenueMinor);
  const shippingRevenueMinor = finiteNonNegative(input.shippingRevenueMinor);
  const orderRevenueMinor = productRevenueMinor + shippingRevenueMinor;

  const productionCostMinor = finiteNonNegative(input.productionCostMinor);
  const expectedShippingCostMinor = finiteNonNegative(
    input.expectedShippingCostMinor,
  );
  const paymentFeeFixedMinor = finiteNonNegative(input.paymentFeeFixedMinor);
  const merchantFixedCostMinor = finiteNonNegative(input.merchantFixedCostMinor);
  const minContributionMinor =
    Number.isFinite(input.minContributionMinor) && input.minContributionMinor > 0
      ? input.minContributionMinor
      : 1;

  const feePercent =
    Number.isFinite(input.paymentFeePercent) && input.paymentFeePercent >= 0
      ? input.paymentFeePercent
      : Number.NaN;
  const rawPaymentFeeMinor =
    Math.ceil((orderRevenueMinor * feePercent) / 100) + paymentFeeFixedMinor;
  // Non-finite math can only come from invalid configuration. It must never be
  // read as a profitable order, so it is clamped to the worst possible fee.
  const paymentFeeMinor = Number.isFinite(rawPaymentFeeMinor)
    ? rawPaymentFeeMinor
    : Number.MAX_SAFE_INTEGER;

  const expectedContributionMinor =
    orderRevenueMinor -
    productionCostMinor -
    expectedShippingCostMinor -
    paymentFeeMinor -
    merchantFixedCostMinor;

  let reason: ProfitabilityReason | null = null;
  if (input.productionCostMinor <= 0 || productionCostMinor <= 0) {
    reason = "missing_production_cost";
  } else if (expectedContributionMinor < minContributionMinor) {
    reason = "non_positive_contribution";
  }

  return {
    productRevenueMinor,
    shippingRevenueMinor,
    orderRevenueMinor,
    productionCostMinor,
    expectedShippingCostMinor,
    paymentFeeMinor,
    merchantFixedCostMinor,
    expectedContributionMinor,
    profitable: reason === null,
    reason,
  };
}