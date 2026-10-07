import type { Prisma } from "@/generated/prisma/client";
import type { FulfillmentStatus } from "@/generated/prisma/enums";
import { MAX_ITEM_QUANTITY } from "@/lib/cart/schemas";
import { serverEnv } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import {
  notifyOrderDelivered,
  notifyOrderShipped,
  notifyOrderSubmitted,
} from "@/lib/email/order-notifications";
import { log } from "@/lib/log";
import { isPaidOrderStatus } from "@/lib/orders/state";
import { getPrintifyClient } from "@/lib/printify/client";
import type {
  PrintifyCreateOrderRequest,
  PrintifyLineItem,
  PrintifyOrder,
  PrintifyOrderGateway,
} from "@/lib/printify/types";

import { buildPrintifyAddress } from "./address";
import {
  FulfillmentError,
  classifyPrintifyError,
  type FulfillmentErrorCode,
} from "./errors";
import { reconcilePrintifyShipping } from "./shipping-reconciliation";
import { mapPrintifyStatus, mergeFulfillmentStatus } from "./status";

export interface FulfillmentResult {
  status: "created" | "already_submitted" | "failed";
  fulfillmentStatus: FulfillmentStatus;
  printifyOrderId?: string;
  code?: FulfillmentErrorCode;
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function loadOrder(orderId: string) {
  return db.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
}

/** Persist a secret-free failure marker; optionally escalate for a human. */
async function recordFailure(
  orderId: string,
  code: string,
  detail: string,
  escalate: boolean,
): Promise<void> {
  const data: Prisma.OrderUpdateInput = {
    fulfillmentError: `${code}:${detail}`,
  };
  if (escalate) {
    const current = await db.order.findUnique({
      where: { id: orderId },
      select: { fulfillmentStatus: true },
    });
    if (current) {
      data.fulfillmentStatus = mergeFulfillmentStatus(
        current.fulfillmentStatus,
        "ACTION_REQUIRED",
      );
    }
  }
  await db.order
    .update({ where: { id: orderId }, data })
    .catch((err) => log.error("failed to record fulfillment error", { orderId, err }));
}

/**
 * Idempotently create exactly one Printify order for a paid Zitsy order.
 * Throws FulfillmentError for every guard/creation failure; callers that must
 * never crash (checkout/webhook) should use `fulfillPaidOrder` instead.
 */
export async function createPrintifyOrderForZitsyOrder(
  orderId: string,
  gateway?: PrintifyOrderGateway,
): Promise<FulfillmentResult> {
  const order = await loadOrder(orderId);
  if (!order) throw new FulfillmentError("order_not_found");

  // Hard idempotency: an existing Printify id is never replaced.
  if (order.printifyOrderId) {
    return {
      status: "already_submitted",
      fulfillmentStatus: order.fulfillmentStatus,
      printifyOrderId: order.printifyOrderId,
    };
  }

  if (!isPaidOrderStatus(order.status)) {
    throw new FulfillmentError("order_not_paid");
  }

  if (!order.payment || order.payment.status !== "COMPLETED") {
    await recordFailure(order.id, "payment_not_completed", "no_completed_payment", true);
    throw new FulfillmentError("payment_not_completed");
  }

  if (order.items.length === 0) {
    await recordFailure(order.id, "no_items", "empty_order", true);
    throw new FulfillmentError("no_items");
  }

  const lineItems: PrintifyLineItem[] = [];
  for (const item of order.items) {
    if (!item.printifyProductId || !Number.isInteger(item.printifyVariantId)) {
      await recordFailure(order.id, "invalid_variant", "missing_printify_refs", true);
      throw new FulfillmentError("invalid_variant");
    }
    if (item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY) {
      await recordFailure(order.id, "invalid_variant", "invalid_quantity", true);
      throw new FulfillmentError("invalid_variant");
    }
    const variant = await db.productVariant.findUnique({
      where: { id: item.variantId },
      select: { productId: true, printifyVariantId: true },
    });
    if (
      !variant ||
      variant.productId !== item.productId ||
      variant.printifyVariantId !== item.printifyVariantId
    ) {
      await recordFailure(order.id, "invalid_variant", "variant_mismatch", true);
      throw new FulfillmentError("invalid_variant");
    }
    lineItems.push({
      product_id: item.printifyProductId,
      variant_id: item.printifyVariantId,
      quantity: item.quantity,
    });
  }

  const validated = buildPrintifyAddress(order);
  if (!validated.ok) {
    await recordFailure(order.id, validated.reason, validated.detail, true);
    throw new FulfillmentError(validated.reason);
  }

  const client = gateway ?? getPrintifyClient();

  // A previous attempt may have reached Printify before failing. Never blindly
  // recreate: reconcile by our stable external_id first.
  if (order.fulfillmentError?.startsWith("ambiguous_create")) {
    const found = await reconcileByExternalId(client, order.orderNumber);
    if (found) return applyCreatedOrder(order, found, client);
    await recordFailure(order.id, "ambiguous_create", "not_found_on_reconcile", false);
    throw new FulfillmentError("ambiguous_create", true);
  }

  const request: PrintifyCreateOrderRequest = {
    external_id: order.orderNumber,
    label: order.orderNumber,
    line_items: lineItems,
    address_to: validated.address,
    send_shipping_notification: false,
  };

  await db.order.update({
    where: { id: order.id },
    data: { fulfillmentAttempts: { increment: 1 } },
  });

  let created: PrintifyOrder;
  try {
    created = await client.createOrder(request);
  } catch (err) {
    const classified = classifyPrintifyError(err);
    const code: FulfillmentErrorCode = classified.ambiguous
      ? "ambiguous_create"
      : classified.code;
    await recordFailure(order.id, code, classified.detail, !classified.retryable);
    throw new FulfillmentError(code, classified.retryable);
  }

  return applyCreatedOrder(order, created, client);
}

/**
 * Run shipping reconciliation without ever letting it break the fulfillment
 * flow it piggybacks on. Failures are logged and swallowed by design.
 */
async function reconcileShippingSafely(
  orderId: string,
  printifyOrder: PrintifyOrder,
): Promise<void> {
  try {
    await reconcilePrintifyShipping(orderId, printifyOrder);
  } catch (err) {
    log.error("shipping reconciliation failed", { orderId, err });
  }
}

/** Claim the freshly created Printify order and optionally auto-submit it. */
async function applyCreatedOrder(
  order: LoadedOrder,
  printifyOrder: PrintifyOrder,
  client: PrintifyOrderGateway,
): Promise<FulfillmentResult> {
  const rawStatus = printifyOrder.status ?? "pending";
  const mapped = mergeFulfillmentStatus(
    order.fulfillmentStatus,
    mapPrintifyStatus(rawStatus),
  );

  const claimed = await db.order.updateMany({
    where: { id: order.id, printifyOrderId: null },
    data: {
      printifyOrderId: printifyOrder.id,
      printifyStatus: rawStatus,
      fulfillmentStatus: mapped,
      printifySubmittedAt: new Date(),
      printifyLastSyncedAt: new Date(),
      fulfillmentError: null,
    },
  });

  if (claimed.count === 0) {
    // A concurrent caller created a second Printify order. Surface loudly for
    // manual reconciliation rather than silently overwriting the first.
    log.error("duplicate Printify order creation detected", {
      orderId: order.id,
      printifyOrderId: printifyOrder.id,
    });
    throw new FulfillmentError("already_submitted");
  }

  // §20: this claim is the authoritative "submitted to Printify" transition.
  // The notification is fire-safe (never throws, deduped by order id).
  await notifyOrderSubmitted(order.id);

  if (serverEnv.PRINTIFY_AUTO_SEND_TO_PRODUCTION) {
    try {
      await sendPrintifyOrderToProduction(order.id, client);
    } catch (err) {
      log.error("auto send to production failed", { orderId: order.id, err });
    }
  }

  await reconcileShippingSafely(order.id, printifyOrder);

  return {
    status: "created",
    fulfillmentStatus: mapped,
    printifyOrderId: printifyOrder.id,
  };
}

/** Search recent Printify orders for one carrying our external_id. */
async function reconcileByExternalId(
  client: PrintifyOrderGateway,
  orderNumber: string,
): Promise<PrintifyOrder | null> {
  for (let page = 1; page <= 3; page += 1) {
    const list = await client.listOrders(page, 10);
    const found = list.data.find(
      (o) =>
        o.external_id === orderNumber ||
        o.metadata?.shop_order_label === orderNumber,
    );
    if (found) return found;
    if (!list.next_page_url || list.data.length === 0) break;
  }
  return null;
}

/**
 * Explicitly move an already-submitted Printify order into production.
 * Idempotent: a second call is a no-op. Throws FulfillmentError on failure.
 */
export async function sendPrintifyOrderToProduction(
  orderId: string,
  gateway?: PrintifyOrderGateway,
): Promise<FulfillmentResult> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new FulfillmentError("order_not_found");
  if (!order.printifyOrderId) throw new FulfillmentError("not_submitted");
  if (order.printifySentToProductionAt) {
    return {
      status: "already_submitted",
      fulfillmentStatus: order.fulfillmentStatus,
      printifyOrderId: order.printifyOrderId,
    };
  }

  const client = gateway ?? getPrintifyClient();
  let updated: PrintifyOrder;
  try {
    updated = await client.sendToProduction(order.printifyOrderId);
  } catch (err) {
    const classified = classifyPrintifyError(err);
    await recordFailure(order.id, classified.code, classified.detail, !classified.retryable);
    throw new FulfillmentError(classified.code, classified.retryable);
  }

  const rawStatus = updated.status ?? "sending-to-production";
  const mapped = mergeFulfillmentStatus(
    order.fulfillmentStatus,
    mapPrintifyStatus(rawStatus),
  );
  await db.order.update({
    where: { id: order.id },
    data: {
      printifyStatus: rawStatus,
      fulfillmentStatus: mapped,
      printifySentToProductionAt: new Date(),
      printifyLastSyncedAt: new Date(),
      fulfillmentError: null,
    },
  });

  return {
    status: "created",
    fulfillmentStatus: mapped,
    printifyOrderId: order.printifyOrderId,
  };
}

const inFlight = new Map<string, Promise<FulfillmentResult>>();

/**
 * Safe entry point for checkout/webhooks: creates the Printify order once,
 * serializes concurrent triggers for the same order in this process, and never
 * throws. Payment state is never touched from here.
 */
export function fulfillPaidOrder(
  orderId: string,
  gateway?: PrintifyOrderGateway,
): Promise<FulfillmentResult> {
  const existing = inFlight.get(orderId);
  if (existing) return existing;

  const run = createPrintifyOrderForZitsyOrder(orderId, gateway)
    .catch((err): FulfillmentResult => {
      if (err instanceof FulfillmentError) {
        log.warn("fulfillment failed", { orderId, code: err.code });
        return {
          status: "failed",
          fulfillmentStatus: "PENDING",
          code: err.code,
        };
      }
      log.error("fulfillment unexpected error", { orderId, err });
      return {
        status: "failed",
        fulfillmentStatus: "PENDING",
        code: "printify_unavailable",
      };
    })
    .finally(() => inFlight.delete(orderId));

  inFlight.set(orderId, run);
  return run;
}

export interface PrintifyOrderUpdate {
  status?: string | null;
  sentToProductionAt?: string | null;
  fulfilledAt?: string | null;
  shipment?: {
    carrier?: string | null;
    number?: string | null;
    url?: string | null;
    deliveredAt?: string | null;
  };
}

/**
 * Apply an authoritative Printify status/tracking update (from a webhook or a
 * manual sync). Only fulfillment fields change — never payment state.
 */
export async function applyPrintifyOrderUpdate(
  printifyOrderId: string,
  update: PrintifyOrderUpdate,
): Promise<{ applied: boolean }> {
  const order = await db.order.findUnique({ where: { printifyOrderId } });
  if (!order) return { applied: false };

  // Transitions are judged against the state before this update so duplicate or
  // out-of-order webhooks can never re-trigger a notification (§21).
  const hadTracking = Boolean(order.trackingNumber || order.trackingUrl);
  const hadDelivered = Boolean(order.deliveredAt);

  const data: Prisma.OrderUpdateInput = { printifyLastSyncedAt: new Date() };

  if (update.status) {
    data.printifyStatus = update.status;
    data.fulfillmentStatus = mergeFulfillmentStatus(
      order.fulfillmentStatus,
      mapPrintifyStatus(update.status),
    );
  }
  if (update.sentToProductionAt && !order.printifySentToProductionAt) {
    data.printifySentToProductionAt = new Date(update.sentToProductionAt);
  }
  if (update.fulfilledAt) {
    data.printifyFulfilledAt = new Date(update.fulfilledAt);
  }

  const ship = update.shipment;
  if (ship) {
    if (ship.carrier) data.trackingCarrier = ship.carrier;
    if (ship.number) data.trackingNumber = ship.number;
    if (ship.url) data.trackingUrl = ship.url;
    if (ship.deliveredAt) {
      data.printifyFulfilledAt = new Date(ship.deliveredAt);
      data.fulfillmentStatus = mergeFulfillmentStatus(
        order.fulfillmentStatus,
        "FULFILLED",
      );
      if (!hadDelivered) {
        data.deliveredAt = new Date(ship.deliveredAt);
      }
    }
  }

  await db.order.update({ where: { id: order.id }, data });

  const nextTrackingNumber = (ship?.number ? ship.number : order.trackingNumber) || null;
  const nextTrackingUrl = (ship?.url ? ship.url : order.trackingUrl) || null;
  const deliveredNow = Boolean(ship?.deliveredAt) && !hadDelivered;
  // A "shipped" announcement requires tracking data that actually exists.
  const shippedNow =
    !deliveredNow &&
    !hadTracking &&
    Boolean(nextTrackingNumber || nextTrackingUrl);

  if (deliveredNow) {
    await notifyOrderDelivered(order.id);
  } else if (shippedNow) {
    await notifyOrderShipped(order.id);
  }

  return { applied: true };
}

/** Pull the latest Printify state for a local order and apply it. */
export async function syncFulfillmentFromPrintify(
  orderId: string,
  gateway?: PrintifyOrderGateway,
): Promise<{ applied: boolean }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { printifyOrderId: true },
  });
  if (!order?.printifyOrderId) return { applied: false };

  const client = gateway ?? getPrintifyClient();
  const remote = await client.getOrder(order.printifyOrderId);
  const shipment = remote.shipments?.find((s) => s.number || s.url);

  const result = await applyPrintifyOrderUpdate(order.printifyOrderId, {
    status: remote.status,
    sentToProductionAt: remote.sent_to_production_at ?? null,
    fulfilledAt: remote.fulfilled_at ?? null,
    shipment: shipment
      ? {
          carrier: shipment.carrier ?? null,
          number: shipment.number ?? null,
          url: shipment.url ?? null,
          deliveredAt: shipment.delivered_at ?? null,
        }
      : undefined,
  });

  await reconcileShippingSafely(orderId, remote);

  return result;
}