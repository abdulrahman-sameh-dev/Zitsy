import type { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db/prisma";
import { fulfillmentLabel } from "@/lib/fulfillment/status";
import { log } from "@/lib/log";
import { countryName } from "@/lib/markets";
import { ensureTrackingToken, trackUrlForToken } from "@/lib/orders/tracking";

import { contactUrl, emailConfig } from "./config";
import { sanitizeEmailError } from "./errors";
import {
  orderEmailKey,
  sendTransactionalEmail,
  type EmailKind,
  type OrderEmailKind,
} from "./service";
import type { OrderEmailModel, RenderedEmail } from "./types";
import { renderAdminNewOrderEmail } from "./templates/admin-new-order";
import { renderOrderConfirmedEmail } from "./templates/order-confirmed";
import { renderOrderDeliveredEmail } from "./templates/order-delivered";
import { renderOrderShippedEmail } from "./templates/order-shipped";
import { renderOrderSubmittedEmail } from "./templates/order-submitted";

const NOTIFY_INCLUDE = {
  items: { include: { product: { include: { images: true } } } },
} satisfies Prisma.OrderInclude;

type NotifyOrder = Prisma.OrderGetPayload<{
  include: { items: { include: { product: { include: { images: true } } } } };
}>;

function resolveImageUrl(src: string | null): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${emailConfig().baseUrl}${src}`;
  return null;
}

async function loadOrder(orderId: string): Promise<NotifyOrder | null> {
  return db.order.findUnique({ where: { id: orderId }, include: NOTIFY_INCLUDE });
}

/**
 * Project an order into the template model. The tracking token is ensured here
 * so every customer email carries a working, login-free tracking link.
 */
async function toOrderEmailModel(order: NotifyOrder): Promise<OrderEmailModel | null> {
  const token = await ensureTrackingToken(order.id);
  if (!token) return null;

  const country = countryName(order.country);
  return {
    orderNumber: order.orderNumber,
    orderDate: order.paidAt ?? order.placedAt ?? order.createdAt,
    email: order.email,
    currency: order.currency,
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    statusLabel: fulfillmentLabel(order.fulfillmentStatus),
    destination: `${order.city}, ${country}`,
    destinationCountry: country,
    items: order.items.map((item) => ({
      title: item.title,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      totalPriceMinor: item.totalPriceMinor,
      imageUrl:
        item.product.images.length > 0
          ? resolveImageUrl(
              (item.product.images.find((image) => image.isDefault) ?? item.product.images[0])
                .src,
            )
          : null,
    })),
    address: {
      recipientName: order.recipientName,
      line1: order.address1,
      line2: order.address2,
      city: order.city,
      region: order.region,
      postalCode: order.postalCode,
      country: order.country,
      countryName: country,
    },
    tracking:
      order.trackingNumber || order.trackingUrl
        ? {
            carrier: order.trackingCarrier,
            number: order.trackingNumber,
            url: order.trackingUrl,
          }
        : null,
    trackUrl: trackUrlForToken(token),
    supportUrl: contactUrl(),
    submittedAt: order.printifySubmittedAt,
    deliveredAt: order.deliveredAt,
    paypalOrderId: order.paypalOrderId,
    printifyOrderId: order.printifyOrderId,
  };
}

/**
 * Email must never break the flow that triggered it (§9). Every notification
 * runs inside this guard: failures are logged and swallowed, so a Resend outage
 * cannot fail a PAID order or a fulfillment transition.
 */
async function runNotification(
  kind: EmailKind,
  orderId: string,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (err) {
    log.error("order notification failed", {
      kind,
      orderId,
      error: sanitizeEmailError(err),
    });
  }
}

async function sendOrderEmail(
  kind: OrderEmailKind,
  orderId: string,
  to: string,
  rendered: Promise<RenderedEmail>,
): Promise<void> {
  const email = await rendered;
  await sendTransactionalEmail({
    kind,
    dedupeKey: orderEmailKey(kind, orderId),
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}

/** §3.A + §7 — payment verified by the server, order is now PAID. */
export async function notifyOrderPaid(orderId: string): Promise<void> {
  await runNotification("order-confirmed", orderId, async () => {
    const order = await loadOrder(orderId);
    if (!order || order.status !== "PAID") return;
    const model = await toOrderEmailModel(order);
    if (!model) return;

    await sendOrderEmail("order-confirmed", orderId, model.email, renderOrderConfirmedEmail(model));

    const cfg = emailConfig();
    if (cfg.supportEnabled) {
      await sendOrderEmail("admin-new-order", orderId, cfg.supportRecipient, renderAdminNewOrderEmail(model));
    } else {
      log.warn("admin-new-order email skipped: SUPPORT_EMAIL is not configured", { orderId });
    }
  });
}

/** §4 — the Printify order was created and claimed for this Zitsy order. */
export async function notifyOrderSubmitted(orderId: string): Promise<void> {
  await runNotification("order-submitted", orderId, async () => {
    const order = await loadOrder(orderId);
    if (!order || !order.printifySubmittedAt) return;
    const model = await toOrderEmailModel(order);
    if (!model) return;

    await sendOrderEmail("order-submitted", orderId, model.email, renderOrderSubmittedEmail(model));
  });
}

/** §5 — shipment data with a real tracking number/URL is now on the order. */
export async function notifyOrderShipped(orderId: string): Promise<void> {
  await runNotification("order-shipped", orderId, async () => {
    const order = await loadOrder(orderId);
    // Hard guard: never announce shipment before tracking data exists (§21).
    if (!order || (!order.trackingNumber && !order.trackingUrl)) return;
    const model = await toOrderEmailModel(order);
    if (!model) return;

    await sendOrderEmail("order-shipped", orderId, model.email, renderOrderShippedEmail(model));
  });
}

/** §6 — Printify reported an authoritative delivered timestamp. */
export async function notifyOrderDelivered(orderId: string): Promise<void> {
  await runNotification("order-delivered", orderId, async () => {
    const order = await loadOrder(orderId);
    if (!order || !order.deliveredAt) return;
    const model = await toOrderEmailModel(order);
    if (!model) return;

    await sendOrderEmail("order-delivered", orderId, model.email, renderOrderDeliveredEmail(model));
  });
}
