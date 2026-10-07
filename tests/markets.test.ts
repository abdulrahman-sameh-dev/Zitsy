import { describe, expect, it } from "vitest";

import {
  countryName,
  isSupportedCountry,
  marketList,
  validateShippingAddress,
} from "@/lib/markets";

const base = {
  address1: "10 Downing Street",
  city: "London",
  region: "",
  postalCode: "SW1A 2AA",
};

describe("markets", () => {
  it("exposes exactly the supported markets (GB, DE)", () => {
    expect(marketList.map((m) => m.code)).toEqual(["GB", "DE"]);
    expect(marketList.every((m) => m.currency === "GBP")).toBe(true);
    expect(countryName("DE")).toBe("Germany");
  });

  it("recognises supported countries case-insensitively", () => {
    expect(isSupportedCountry("gb")).toBe(true);
    expect(isSupportedCountry("DE")).toBe(true);
    expect(isSupportedCountry("US")).toBe(false);
  });
});

describe("validateShippingAddress", () => {
  it("accepts a valid UK address", () => {
    expect(validateShippingAddress("GB", base)).toEqual({ ok: true, country: "GB" });
  });

  it("accepts a valid German address", () => {
    expect(
      validateShippingAddress("DE", {
        address1: "Unter den Linden 1",
        city: "Berlin",
        postalCode: "10117",
      }),
    ).toEqual({ ok: true, country: "DE" });
  });

  it("rejects unsupported countries", () => {
    const result = validateShippingAddress("US", base);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("country");
  });

  it("rejects a postcode that does not match the market format", () => {
    const result = validateShippingAddress("DE", { ...base, postalCode: "SW1A" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe("postalCode");
  });

  it("rejects US-format addresses mistakenly sent to a supported country", () => {
    const result = validateShippingAddress("GB", {
      address1: "1600 Pennsylvania Avenue",
      city: "Washington",
      region: "District of Columbia",
      postalCode: "SW1A 2AA",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/US address/i);
  });
});