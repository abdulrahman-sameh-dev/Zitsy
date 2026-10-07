import { afterEach, describe, expect, it, vi } from "vitest";

import { createOrderRef, verifyOrderRef } from "@/lib/checkout/session";

describe("order reference (signed cookie)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a valid order id", () => {
    const ref = createOrderRef("order_abc123");
    expect(verifyOrderRef(ref)).toBe("order_abc123");
  });

  it("rejects a tampered signature", () => {
    const ref = createOrderRef("order_abc123");
    const tampered = `${ref.slice(0, -1)}${ref.at(-1) === "A" ? "B" : "A"}`;
    expect(verifyOrderRef(tampered)).toBeNull();
  });

  it("rejects a swapped order id", () => {
    const ref = createOrderRef("order_abc123");
    const parts = ref.split(".");
    expect(verifyOrderRef(`order_other.${parts[1]}.${parts[2]}`)).toBeNull();
  });

  it("rejects a malformed value", () => {
    expect(verifyOrderRef("not-a-valid-ref")).toBeNull();
  });

  it("expires after the max age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const ref = createOrderRef("order_abc123");
    expect(verifyOrderRef(ref)).toBe("order_abc123");

    vi.setSystemTime(new Date("2026-01-01T04:00:00Z"));
    expect(verifyOrderRef(ref)).toBeNull();
  });
});