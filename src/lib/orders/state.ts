import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";

/**
 * Explicit, forward-only order lifecycle. Fulfillment states exist in the enum
 * but are intentionally not reachable in Phase 5 (no Printify order creation).
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PAYMENT_PENDING", "CANCELLED", "PAYMENT_FAILED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAID: ["FULFILLMENT_PENDING", "CANCELLED"],
  PAYMENT_FAILED: ["PAYMENT_PENDING", "CANCELLED"],
  FULFILLMENT_PENDING: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new Error(`Illegal order transition: ${from} -> ${to}`);
  }
}

/** Terminal payment states never move again. */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransitionPayment(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Order is safe to attempt payment capture from. */
export function isPayableOrderStatus(status: OrderStatus): boolean {
  return status === "PENDING" || status === "PAYMENT_PENDING";
}

/** A paid order must never be treated as unpaid again. */
export function isPaidOrderStatus(status: OrderStatus): boolean {
  return status === "PAID";
}