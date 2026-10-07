import { describe, expect, it } from "vitest";

import {
  assertOrderTransition,
  canTransitionOrder,
  canTransitionPayment,
  isPaidOrderStatus,
  isPayableOrderStatus,
} from "@/lib/orders/state";

describe("order state machine", () => {
  it("allows the forward payment path", () => {
    expect(canTransitionOrder("PENDING", "PAYMENT_PENDING")).toBe(true);
    expect(canTransitionOrder("PAYMENT_PENDING", "PAID")).toBe(true);
    expect(canTransitionOrder("PAID", "FULFILLMENT_PENDING")).toBe(true);
  });

  it("never moves a paid order backwards", () => {
    expect(canTransitionOrder("PAID", "PAYMENT_PENDING")).toBe(false);
    expect(canTransitionOrder("PAID", "PAYMENT_FAILED")).toBe(false);
    expect(canTransitionOrder("PAID", "CANCELLED")).toBe(true);
  });

  it("treats delivered and cancelled as terminal", () => {
    expect(canTransitionOrder("DELIVERED", "PAID")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "PAID")).toBe(false);
  });

  it("throws on an illegal transition", () => {
    expect(() => assertOrderTransition("DELIVERED", "PAID")).toThrow();
    expect(() =>
      assertOrderTransition("PAYMENT_PENDING", "PAID"),
    ).not.toThrow();
  });

  it("classifies payable and paid statuses", () => {
    expect(isPayableOrderStatus("PENDING")).toBe(true);
    expect(isPayableOrderStatus("PAYMENT_PENDING")).toBe(true);
    expect(isPayableOrderStatus("PAID")).toBe(false);
    expect(isPaidOrderStatus("PAID")).toBe(true);
    expect(isPaidOrderStatus("PAYMENT_PENDING")).toBe(false);
  });

  it("keeps payment statuses terminal once resolved", () => {
    expect(canTransitionPayment("PENDING", "COMPLETED")).toBe(true);
    expect(canTransitionPayment("PENDING", "FAILED")).toBe(true);
    expect(canTransitionPayment("COMPLETED", "FAILED")).toBe(false);
    expect(canTransitionPayment("FAILED", "COMPLETED")).toBe(false);
  });
});