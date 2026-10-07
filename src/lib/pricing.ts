import {
  printifyCostCurrency,
  storeCurrency,
  storeFxRatesSpec,
  storeMarkupPercent,
} from "@/lib/config/env";
import { convertMinor, parseFxRates } from "@/lib/fx";

let cachedSpec: string | null = null;
let cachedRates: Map<string, number> = new Map();

export function fxRates(): Map<string, number> {
  const spec = storeFxRatesSpec();
  if (cachedSpec !== spec) {
    cachedRates = parseFxRates(spec);
    cachedSpec = spec;
  }
  return cachedRates;
}

/** Convert a Printify amount (cost/shipping source currency) into store currency. */
export function toStoreMinor(sourceMinor: number, sourceCurrency = printifyCostCurrency()): number {
  return convertMinor(sourceMinor, sourceCurrency, storeCurrency(), fxRates());
}

/** Round UP to a `.99` charm price so a computed floor is never undershot. */
export function charmPriceMinor(minor: number): number {
  if (minor <= 0) return 0;
  return Math.ceil((minor + 1) / 100) * 100 - 1;
}

/**
 * Minimum acceptable retail price for a store-currency cost: the production
 * cost plus the configured MARKUP. Prices are only ever charm-rounded UP, so
 * the final price is always >= this floor.
 */
export function markupFloorMinor(
  storeCostMinor: number,
  markupPercent: number,
): number {
  return Math.ceil((storeCostMinor * (100 + markupPercent)) / 100);
}

export interface VariantPricing {
  costMinor: number;
  priceMinor: number;
  currency: string;
}

/**
 * Derive the Zitsy retail price from the Printify fulfillment cost:
 * cost (source currency) -> store currency -> + configured markup -> charm price.
 * Returns null when no usable fulfillment cost is available.
 *
 * Printify's own `price`/`profit` are intentionally ignored: Zitsy pricing is an
 * independent business decision based on the production cost.
 */
export function pricingFromCost(
  costSourceMinor: number | null | undefined,
): VariantPricing | null {
  if (typeof costSourceMinor !== "number" || costSourceMinor <= 0) return null;
  const costMinor = toStoreMinor(costSourceMinor);
  const floor = markupFloorMinor(costMinor, storeMarkupPercent());
  return {
    costMinor,
    priceMinor: charmPriceMinor(floor),
    currency: storeCurrency(),
  };
}