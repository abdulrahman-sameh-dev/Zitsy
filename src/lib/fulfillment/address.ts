import { isSupportedCountry } from "@/lib/markets";

import type { PrintifyAddressTo } from "@/lib/printify/types";

export type AddressErrorReason = "unsupported_country" | "invalid_address";

export interface AddressValidationOk {
  ok: true;
  address: PrintifyAddressTo;
}

export interface AddressValidationFail {
  ok: false;
  reason: AddressErrorReason;
  detail: string;
}

export type AddressValidation = AddressValidationOk | AddressValidationFail;

export interface OrderAddressSource {
  recipientName: string;
  address1: string;
  address2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  phone: string | null;
  email: string;
}

/**
 * Split a single recipient name into Printify's first/last fields. Printify
 * requires both; when only one token is present we repeat it rather than send
 * an empty last name.
 */
export function splitRecipientName(name: string): {
  firstName: string;
  lastName: string;
} {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/**
 * Build and validate a Printify address from a Zitsy order. Only the two
 * supported markets (GB, DE) may be fulfilled; everything else is rejected
 * before any API call is made.
 */
export function buildPrintifyAddress(order: OrderAddressSource): AddressValidation {
  const country = order.country.trim().toUpperCase();
  if (!isSupportedCountry(country)) {
    return {
      ok: false,
      reason: "unsupported_country",
      detail: `country:${country || "empty"}`,
    };
  }

  const { firstName, lastName } = splitRecipientName(order.recipientName);
  const address: PrintifyAddressTo = {
    first_name: firstName,
    last_name: lastName,
    address1: order.address1.trim(),
    city: order.city.trim(),
    region: order.region?.trim() || undefined,
    zip: order.postalCode.trim(),
    country,
    email: order.email.trim(),
    phone: order.phone?.trim() || undefined,
    address2: order.address2?.trim() || undefined,
  };

  const missing = (Object.entries({
    first_name: address.first_name,
    last_name: address.last_name,
    address1: address.address1,
    city: address.city,
    zip: address.zip,
    country: address.country,
    email: address.email,
  }) as [string, string | undefined][]).filter(([, value]) => !value);

  if (missing.length > 0) {
    return {
      ok: false,
      reason: "invalid_address",
      detail: `missing:${missing.map(([key]) => key).join(",")}`,
    };
  }

  return { ok: true, address };
}