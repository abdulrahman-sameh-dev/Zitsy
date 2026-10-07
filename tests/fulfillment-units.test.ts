import { describe, expect, it } from "vitest";

import {
  buildPrintifyAddress,
  splitRecipientName,
  type OrderAddressSource,
} from "@/lib/fulfillment/address";
import {
  fulfillmentLabel,
  mapPrintifyStatus,
  mergeFulfillmentStatus,
  normalizePrintifyStatus,
} from "@/lib/fulfillment/status";

const baseAddress: OrderAddressSource = {
  recipientName: "Ada Lovelace",
  address1: "1 Analytical Engine Way",
  address2: null,
  city: "London",
  region: null,
  postalCode: "EC1A 1BB",
  country: "GB",
  phone: "+447700900000",
  email: "ada@example.com",
};

describe("fulfillment status mapping", () => {
  it("maps known Printify statuses, hyphen/underscore tolerant", () => {
    expect(mapPrintifyStatus("pending")).toBe("SUBMITTED");
    expect(mapPrintifyStatus("on-hold")).toBe("ON_HOLD");
    expect(mapPrintifyStatus("in_production")).toBe("IN_PRODUCTION");
    expect(mapPrintifyStatus("partially-fulfilled")).toBe("PARTIALLY_FULFILLED");
    expect(mapPrintifyStatus("fulfilled")).toBe("FULFILLED");
    expect(mapPrintifyStatus("cancelled")).toBe("CANCELLED");
  });

  it("treats unknown statuses as needing attention", () => {
    expect(mapPrintifyStatus("weird-new-status")).toBe("ACTION_REQUIRED");
    expect(mapPrintifyStatus(null)).toBe("PENDING");
  });

  it("normalizes whitespace and case", () => {
    expect(normalizePrintifyStatus("  IN-PRODUCTION ")).toBe("in-production");
  });

  it("never regresses forward progress from out-of-order webhooks", () => {
    expect(mergeFulfillmentStatus("IN_PRODUCTION", "SUBMITTED")).toBe(
      "IN_PRODUCTION",
    );
    expect(mergeFulfillmentStatus("IN_PRODUCTION", "FULFILLED")).toBe("FULFILLED");
  });

  it("lets problem states and terminals win", () => {
    expect(mergeFulfillmentStatus("IN_PRODUCTION", "ACTION_REQUIRED")).toBe(
      "ACTION_REQUIRED",
    );
    expect(mergeFulfillmentStatus("FULFILLED", "IN_PRODUCTION")).toBe("FULFILLED");
    expect(mergeFulfillmentStatus("FULFILLED", "CANCELLED")).toBe("FULFILLED");
  });

  it("provides a human label for every state", () => {
    expect(fulfillmentLabel("FULFILLED")).toBe("Shipped");
    expect(fulfillmentLabel("ACTION_REQUIRED")).toContain("attention");
  });
});

describe("fulfillment address", () => {
  it("splits a recipient name into first/last", () => {
    expect(splitRecipientName("Ada Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "Lovelace",
    });
    expect(splitRecipientName("Ada King Lovelace")).toEqual({
      firstName: "Ada",
      lastName: "King Lovelace",
    });
    expect(splitRecipientName("Prince")).toEqual({
      firstName: "Prince",
      lastName: "Prince",
    });
  });

  it("builds a Printify address for GB", () => {
    const result = buildPrintifyAddress(baseAddress);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.address).toMatchObject({
      first_name: "Ada",
      last_name: "Lovelace",
      country: "GB",
      city: "London",
      zip: "EC1A 1BB",
    });
  });

  it("accepts Germany", () => {
    const result = buildPrintifyAddress({ ...baseAddress, country: "de" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.address.country).toBe("DE");
  });

  it("rejects unsupported countries before any API call", () => {
    const result = buildPrintifyAddress({ ...baseAddress, country: "US" });
    expect(result).toMatchObject({ ok: false, reason: "unsupported_country" });
  });

  it("rejects incomplete addresses", () => {
    const result = buildPrintifyAddress({ ...baseAddress, city: "  " });
    expect(result).toMatchObject({ ok: false, reason: "invalid_address" });
  });

  it("splits single-token names without losing a last name", () => {
    expect(splitRecipientName("Cher")).toEqual({
      firstName: "Cher",
      lastName: "Cher",
    });
  });
});