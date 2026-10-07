import { CheckoutError } from "@/lib/checkout/errors";
import { storeCurrency, printifyCostCurrency } from "@/lib/config/env";
import { isSupportedCountry } from "@/lib/markets";
import { toStoreMinor } from "@/lib/pricing";
import { getPrintifyClient } from "@/lib/printify/client";
import type {
  PrintifyAddressTo,
  PrintifyShippingCosts,
  PrintifyShippingRequest,
} from "@/lib/printify/types";

export interface ShippingLine {
  productId: string;
  variantId: number;
  quantity: number;
}

export interface ShippingDestination {
  country: string;
  city?: string;
  postalCode?: string;
  region?: string;
  address1?: string;
}

export interface ShippingQuote {
  /** Customer-facing shipping, converted into the store currency. */
  shippingMinor: number;
  currency: string;
  method: "standard";
  /** Raw Printify amount (unconverted source currency), kept for reconciliation. */
  sourceMinor: number;
  sourceCurrency: string;
}

export interface ShippingGateway {
  getShippingCosts(body: PrintifyShippingRequest): Promise<PrintifyShippingCosts>;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; quote: ShippingQuote }>();

function cacheKey(lines: ShippingLine[], destination: ShippingDestination): string {
  const items = lines
    .map((l) => `${l.productId}:${l.variantId}:${l.quantity}`)
    .sort()
    .join(",");
  const d = [
    destination.country.toUpperCase(),
    destination.postalCode ?? "",
    destination.city ?? "",
    destination.region ?? "",
  ].join("|");
  return `${d}#${items}`;
}

export function clearShippingCache(): void {
  cache.clear();
}

function buildDestinationAddress(
  destination: ShippingDestination,
): PrintifyAddressTo {
  return {
    first_name: "Zitsy",
    last_name: "Customer",
    email: "orders@zitsy.example",
    country: destination.country.trim().toUpperCase(),
    address1: destination.address1?.trim() || "N/A",
    city: destination.city?.trim() || "N/A",
    region: destination.region?.trim() || "",
    zip: destination.postalCode?.trim() || "N/A",
  };
}

/**
 * Ask Printify for the standard shipping cost to a destination, normalized into
 * the store currency. Fails safely (no fabricated price) when the destination
 * is unsupported or Printify cannot quote a standard rate.
 */
export async function calculateShipping(
  lines: ShippingLine[],
  destination: ShippingDestination,
  gateway: ShippingGateway = getPrintifyClient(),
): Promise<ShippingQuote> {
  if (lines.length === 0) throw new CheckoutError("empty_cart");
  if (!isSupportedCountry(destination.country.trim().toUpperCase())) {
    throw new CheckoutError("unsupported_country");
  }

  const key = cacheKey(lines, destination);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.quote;

  const request: PrintifyShippingRequest = {
    line_items: lines.map((line) => ({
      product_id: line.productId,
      variant_id: line.variantId,
      quantity: line.quantity,
    })),
    address_to: buildDestinationAddress(destination),
  };

  let costs: PrintifyShippingCosts;
  try {
    costs = await gateway.getShippingCosts(request);
  } catch {
    throw new CheckoutError("shipping_unavailable");
  }

  const standard = costs.standard;
  if (typeof standard !== "number" || standard < 0) {
    throw new CheckoutError("shipping_unavailable");
  }

  const quote: ShippingQuote = {
    shippingMinor: toStoreMinor(standard),
    currency: storeCurrency(),
    method: "standard",
    sourceMinor: standard,
    sourceCurrency: printifyCostCurrency(),
  };
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, quote });
  return quote;
}