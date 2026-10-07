import { describe, expect, it } from "vitest";

import { FxRateError, convertMinor, fxRate, parseFxRates } from "@/lib/fx";

const rates = parseFxRates("USD:GBP=0.754,EUR:GBP=0.85");

describe("parseFxRates", () => {
  it("parses valid entries and ignores noise", () => {
    const parsed = parseFxRates("USD:GBP=0.754, junk, eur:gbp=0.85, X:Y=0");
    expect(parsed.get("USD:GBP")).toBe(0.754);
    expect(parsed.get("EUR:GBP")).toBe(0.85);
    expect(parsed.has("X:Y")).toBe(false);
  });
});

describe("convertMinor", () => {
  it("returns the amount unchanged for the same currency", () => {
    expect(convertMinor(1234, "GBP", "GBP", rates)).toBe(1234);
  });

  it("converts using an explicit rate", () => {
    expect(convertMinor(1000, "USD", "GBP", rates)).toBe(754);
  });

  it("uses the inverse rate when only the reverse pair exists", () => {
    expect(convertMinor(754, "GBP", "USD", rates)).toBe(1000);
  });

  it("throws instead of assuming 1:1 for an unconfigured pair", () => {
    expect(() => convertMinor(100, "USD", "JPY", rates)).toThrow(FxRateError);
  });
});

describe("fxRate", () => {
  it("returns 1 for identical currencies and inverts when needed", () => {
    expect(fxRate("GBP", "GBP", rates)).toBe(1);
    expect(fxRate("GBP", "USD", rates)).toBeCloseTo(1 / 0.754, 6);
  });
});