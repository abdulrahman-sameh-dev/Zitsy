import { printifyCostCurrency } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";
import type { PrintifyOrder } from "@/lib/printify/types";

/**
 * Merchant-side shipping reconciliation status.
 *
 * - PENDING:     a quote was captured, the actual Printify amount is not yet known
 * - RECONCILED:  quoted and actual amounts have been compared and recorded
 * - UNAVAILABLE: there was no captured quote to compare against
 */
export type ShippingReconcileStatus = "PENDING" | "RECONCILED" | "UNAVAILABLE";

export interface ShippingReconciliationResult {
  status: ShippingReconcileStatus;
  deltaMinor: number | null;
}

type PrintifyShippingSource = Pick<PrintifyOrder, "id" | "total_shipping">;

/** Extract the actual shipping amount Printify booked, if present and valid. */
export function printifyActualShippingMinor(
  printifyOrder: PrintifyShippingSource,
): number | null {
  const value = printifyOrder.total_shipping;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

/**
 * Compare the Printify shipping quote captured at checkout with the shipping
 * amount Printify actually recorded on the created order, and persist the delta.
 *
 * This is observability only: it never touches the customer-facing shipping
 * charge, the order total, payment state, or fulfillment state. It is
 * idempotent — the first reconciliation wins and is never rewritten.
 */
export async function reconcilePrintifyShipping(
  orderId: string,
  printifyOrder: PrintifyShippingSource,
): Promise<ShippingReconciliationResult> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      printifyOrderId: true,
      printifyQuotedShippingMinor: true,
      printifyQuotedShippingCurrency: true,
      printifyActualShippingMinor: true,
      printifyShippingDeltaMinor: true,
      printifyShippingReconciledAt: true,
    },
  });

  if (!order) {
    log.warn("shipping reconciliation skipped: order not found", { orderId });
    return { status: "UNAVAILABLE", deltaMinor: null };
  }

  // Already reconciled: return the recorded result unchanged (idempotent).
  if (order.printifyShippingReconciledAt) {
    return { status: "RECONCILED", deltaMinor: order.printifyShippingDeltaMinor };
  }

  const quotedMinor = order.printifyQuotedShippingMinor;
  const quotedCurrency = order.printifyQuotedShippingCurrency;

  // No quote was captured; there is nothing to compare. Record explicitly so
  // the state is observable rather than silently absent.
  if (quotedMinor === null || quotedCurrency === null) {
    await db.order.updateMany({
      where: { id: orderId, printifyShippingReconcileStatus: { not: "UNAVAILABLE" } },
      data: { printifyShippingReconcileStatus: "UNAVAILABLE" },
    });
    log.info("shipping reconciliation unavailable: no checkout quote recorded", {
      orderNumber: order.orderNumber,
      printifyOrderId: printifyOrder.id ?? order.printifyOrderId,
      status: "UNAVAILABLE",
    });
    return { status: "UNAVAILABLE", deltaMinor: null };
  }

  const actualMinor = printifyActualShippingMinor(printifyOrder);
  const actualCurrency = printifyCostCurrency();

  // Actual amount not yet available, or currencies disagree: stay pending and
  // let the existing Printify sync/webhook path retry later.
  if (actualMinor === null || actualCurrency !== quotedCurrency) {
    await db.order.updateMany({
      where: { id: orderId, printifyShippingReconciledAt: null },
      data: { printifyShippingReconcileStatus: "PENDING" },
    });
    log.info("shipping reconciliation pending: actual amount unavailable", {
      orderNumber: order.orderNumber,
      printifyOrderId: printifyOrder.id ?? order.printifyOrderId,
      quotedShippingMinor: quotedMinor,
      quotedCurrency,
      actualCurrency,
      status: "PENDING",
    });
    return { status: "PENDING", deltaMinor: null };
  }

  const deltaMinor = actualMinor - quotedMinor;
  const recorded = await db.order.updateMany({
    where: { id: orderId, printifyShippingReconciledAt: null },
    data: {
      printifyActualShippingMinor: actualMinor,
      printifyActualShippingCurrency: actualCurrency,
      printifyShippingDeltaMinor: deltaMinor,
      printifyShippingReconcileStatus: "RECONCILED",
      printifyShippingReconciledAt: new Date(),
    },
  });

  if (recorded.count === 0) {
    // Lost a race with a concurrent reconciler: read back what was recorded.
    const fresh = await db.order.findUnique({
      where: { id: orderId },
      select: {
        printifyActualShippingMinor: true,
        printifyQuotedShippingMinor: true,
      },
    });
    const settledDelta =
      fresh &&
      fresh.printifyActualShippingMinor !== null &&
      fresh.printifyQuotedShippingMinor !== null
        ? fresh.printifyActualShippingMinor - fresh.printifyQuotedShippingMinor
        : deltaMinor;
    return { status: "RECONCILED", deltaMinor: settledDelta };
  }

  log.info("shipping reconciliation recorded", {
    orderNumber: order.orderNumber,
    printifyOrderId: printifyOrder.id ?? order.printifyOrderId,
    quotedShippingMinor: quotedMinor,
    actualShippingMinor: actualMinor,
    currency: actualCurrency,
    deltaMinor,
    status: "RECONCILED",
  });
  return { status: "RECONCILED", deltaMinor };
}