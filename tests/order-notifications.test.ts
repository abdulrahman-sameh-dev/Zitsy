import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { supportEmail } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import {
  notifyOrderDelivered,
  notifyOrderPaid,
  notifyOrderShipped,
  notifyOrderSubmitted,
} from "@/lib/email/order-notifications";
import { orderEmailKey, type OrderEmailKind } from "@/lib/email/service";
import { fulfillPaidOrder } from "@/lib/fulfillment/service";
import { processPrintifyWebhook } from "@/lib/printify/handlers";
import type { PrintifyClient } from "@/lib/printify/client";
import type { PrintifyWebhookEvent } from "@/lib/printify/types";

import { fakeEmail } from "./fake-email";
import { FakePrintify } from "./fake-printify";

let seq = 0;

async function seedPaidOrder() {
  seq += 1;
  const product = await db.product.create({
    data: {
      printifyId: `PP-EMAIL-${seq}`,
      title: "Email Tee",
      slug: `email-tee-${seq}`,
      currency: "GBP",
      minPriceMinor: 2500,
      variants: {
        create: [
          {
            printifyVariantId: 11,
            title: "Black / M",
            sku: `SKU-EMAIL-${seq}`,
            priceMinor: 2500,
            costMinor: 1000,
            currency: "GBP",
            isDefault: true,
          },
        ],
      },
    },
    include: { variants: true },
  });
  const variant = product.variants[0];

  return db.order.create({
    data: {
      orderNumber: `ZS-EM${String(seq).padStart(6, "0")}`,
      email: "buyer@example.com",
      status: "PAID",
      currency: "GBP",
      subtotalMinor: 2500,
      shippingMinor: 0,
      totalMinor: 2500,
      paidAt: new Date(),
      placedAt: new Date(),
      recipientName: "Jane Smith",
      address1: "1 Main St",
      city: "London",
      postalCode: "SW1A 1AA",
      country: "GB",
      paypalOrderId: `PP-EMAIL-${seq}`,
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            printifyProductId: product.printifyId,
            printifyVariantId: 11,
            title: "Email Tee",
            variantTitle: "Black / M",
            sku: `SKU-EMAIL-${seq}`,
            quantity: 1,
            unitPriceMinor: 2500,
            totalPriceMinor: 2500,
            currency: "GBP",
          },
        ],
      },
      payment: {
        create: {
          provider: "paypal",
          providerOrderId: `PAYPAL-EMAIL-${seq}`,
          status: "COMPLETED",
          amountMinor: 2500,
          currency: "GBP",
          completedAt: new Date(),
        },
      },
    },
  });
}

/** A paid order that already has a Printify order (post-submission state). */
async function seedSubmittedOrder() {
  const order = await seedPaidOrder();
  return db.order.update({
    where: { id: order.id },
    data: {
      printifyOrderId: `PFY-EMAIL-${seq}`,
      printifySubmittedAt: new Date(),
      printifyStatus: "pending",
      fulfillmentStatus: "SUBMITTED",
    },
  });
}

function sentKey(kind: OrderEmailKind, orderId: string): boolean {
  const key = orderEmailKey(kind, orderId);
  return fakeEmail.sent.some((email) => email.idempotencyKey === key);
}

const fakeClient = {} as PrintifyClient;

function shipmentEvent(
  printifyOrderId: string,
  id: string,
  data: Record<string, unknown>,
): PrintifyWebhookEvent {
  return {
    id,
    type: "order:shipment:created",
    created_at: new Date().toISOString(),
    resource: { id: printifyOrderId, type: "order", data },
  };
}

beforeEach(async () => {
  await db.emailLog.deleteMany();
  await db.webhookEvent.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
});

afterAll(async () => {
  await db.webhookEvent.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
});

describe("notifyOrderPaid", () => {
  it("emails the customer a confirmation with a login-free tracking link", async () => {
    const order = await seedPaidOrder();
    await notifyOrderPaid(order.id);

    const key = orderEmailKey("order-confirmed", order.id);
    expect(sentKey("order-confirmed", order.id)).toBe(true);

    const confirmation = fakeEmail.sent.find((email) => email.idempotencyKey === key);
    expect(confirmation?.to).toBe("buyer@example.com");
    expect(confirmation?.subject).toContain(order.orderNumber);
    expect(confirmation?.html).toContain("/track-order/");
    expect(confirmation?.html).toContain(order.orderNumber);

    const row = await db.emailLog.findUniqueOrThrow({ where: { dedupeKey: key } });
    expect(row.status).toBe("sent");
    expect(row.kind).toBe("order-confirmed");
  });

  it("notifies the store owner about the same paid order", async () => {
    const order = await seedPaidOrder();
    await notifyOrderPaid(order.id);

    const key = orderEmailKey("admin-new-order", order.id);
    const admin = fakeEmail.sent.find((email) => email.idempotencyKey === key);
    expect(admin?.to).toBe(supportEmail());
    expect(admin?.html).toContain(order.orderNumber);
    expect(admin?.html).toContain("PP-EMAIL");
    expect(admin?.html).toContain("buyer@example.com");
  });

  it("is idempotent — a repeated trigger never sends twice", async () => {
    const order = await seedPaidOrder();
    await notifyOrderPaid(order.id);
    await notifyOrderPaid(order.id);

    expect(fakeEmail.sent).toHaveLength(2);
    expect(await db.emailLog.count()).toBe(2);
  });

  it("does nothing while the order is not PAID", async () => {
    const order = await seedPaidOrder();
    await db.order.update({ where: { id: order.id }, data: { status: "PAYMENT_PENDING" } });

    await notifyOrderPaid(order.id);

    expect(fakeEmail.sent).toHaveLength(0);
    expect(await db.emailLog.count()).toBe(0);
  });

  it("keeps the order PAID when the email provider is down", async () => {
    const order = await seedPaidOrder();
    fakeEmail.failAll = true;

    await expect(notifyOrderPaid(order.id)).resolves.toBeUndefined();

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID");
    expect(after.paidAt).not.toBeNull();

    const rows = await db.emailLog.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.status === "failed")).toBe(true);
    expect(rows.every((row) => Boolean(row.error))).toBe(true);
    expect(rows.every((row) => !row.error?.includes("re_"))).toBe(true);
  });
});

describe("notifyOrderSubmitted", () => {
  it("waits for the Printify submission", async () => {
    const order = await seedPaidOrder();
    await notifyOrderSubmitted(order.id);

    expect(fakeEmail.sent).toHaveLength(0);
    expect(await db.emailLog.count()).toBe(0);
  });

  it("sends once the order has been submitted", async () => {
    const order = await seedSubmittedOrder();
    await notifyOrderSubmitted(order.id);

    const key = orderEmailKey("order-submitted", order.id);
    expect(sentKey("order-submitted", order.id)).toBe(true);
    const email = fakeEmail.sent.find((entry) => entry.idempotencyKey === key);
    expect(email?.to).toBe("buyer@example.com");
    expect(email?.html).toContain("/track-order/");
  });

  it("fires from the real fulfillment flow, exactly once", async () => {
    const order = await seedPaidOrder();
    const fake = new FakePrintify();

    const result = await fulfillPaidOrder(order.id, fake);
    expect(result.status).toBe("created");
    expect(sentKey("order-submitted", order.id)).toBe(true);

    await notifyOrderSubmitted(order.id);
    expect(fakeEmail.sent).toHaveLength(1);
  });
});

describe("notifyOrderShipped", () => {
  it("refuses to announce shipment before tracking data exists", async () => {
    const order = await seedSubmittedOrder();
    await notifyOrderShipped(order.id);

    expect(fakeEmail.sent).toHaveLength(0);
    expect(await db.emailLog.count()).toBe(0);
  });

  it("sends when a tracking number exists", async () => {
    const order = await seedSubmittedOrder();
    await db.order.update({
      where: { id: order.id },
      data: { trackingCarrier: "USPS", trackingNumber: "TRACK-1", trackingUrl: "https://track.example/TRACK-1" },
    });

    await notifyOrderShipped(order.id);

    const email = fakeEmail.sent.find((entry) => entry.idempotencyKey === orderEmailKey("order-shipped", order.id));
    expect(email?.to).toBe("buyer@example.com");
    expect(email?.html).toContain("TRACK-1");
  });
});

describe("notifyOrderDelivered", () => {
  it("refuses to announce delivery without an authoritative timestamp", async () => {
    const order = await seedSubmittedOrder();
    await notifyOrderDelivered(order.id);

    expect(fakeEmail.sent).toHaveLength(0);
    expect(await db.emailLog.count()).toBe(0);
  });

  it("sends when Printify reported a delivered timestamp", async () => {
    const order = await seedSubmittedOrder();
    await db.order.update({
      where: { id: order.id },
      data: { deliveredAt: new Date("2026-10-07T10:00:00.000Z") },
    });

    await notifyOrderDelivered(order.id);

    expect(sentKey("order-delivered", order.id)).toBe(true);
    const email = fakeEmail.sent.find((entry) => entry.idempotencyKey === orderEmailKey("order-delivered", order.id));
    expect(email?.subject).toContain(order.orderNumber);
  });
});

describe("printify webhooks → customer emails", () => {
  it("sends exactly one shipped email, even for replayed shipment events", async () => {
    const order = await seedSubmittedOrder();
    const event = shipmentEvent(order.printifyOrderId!, "evt-ship-email-1", {
      shop_id: 1,
      status: "fulfilled",
      carrier: { code: "USPS", tracking_number: "TRACK-77", tracking_url: "https://track.example/TRACK-77" },
    });

    expect(await processPrintifyWebhook(fakeClient, event)).toBe("processed");
    expect(sentKey("order-shipped", order.id)).toBe(true);
    expect(fakeEmail.sent).toHaveLength(1);

    const replay = shipmentEvent(order.printifyOrderId!, "evt-ship-email-2", event.resource!.data!);
    await processPrintifyWebhook(fakeClient, replay);

    expect(fakeEmail.sent).toHaveLength(1);
    expect(await db.emailLog.count()).toBe(1);
  });

  it("sends the delivered email (not a second shipped email) on delivery", async () => {
    const order = await seedSubmittedOrder();
    const event: PrintifyWebhookEvent = {
      id: "evt-delivered-email-1",
      type: "order:shipment:delivered",
      created_at: "2026-10-07T10:00:00.000Z",
      resource: {
        id: order.printifyOrderId!,
        type: "order",
        data: {
          shop_id: 1,
          delivered_at: "2026-10-07T10:00:00.000Z",
          carrier: { code: "USPS", tracking_number: "TRACK-77", tracking_url: "https://track.example/TRACK-77" },
        },
      },
    };

    await processPrintifyWebhook(fakeClient, event);

    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.deliveredAt).not.toBeNull();

    expect(sentKey("order-delivered", order.id)).toBe(true);
    expect(sentKey("order-shipped", order.id)).toBe(false);
    expect(fakeEmail.sent).toHaveLength(1);

    const replay: PrintifyWebhookEvent = { ...event, id: "evt-delivered-email-2" };
    await processPrintifyWebhook(fakeClient, replay);
    expect(fakeEmail.sent).toHaveLength(1);
  });

  it("a duplicate delivery event never re-announces delivery", async () => {
    const order = await seedSubmittedOrder();
    const event: PrintifyWebhookEvent = {
      id: "evt-delivered-email-3",
      type: "order:shipment:delivered",
      created_at: "2026-10-07T10:00:00.000Z",
      resource: {
        id: order.printifyOrderId!,
        type: "order",
        data: {
          shop_id: 1,
          delivered_at: "2026-10-07T10:00:00.000Z",
          carrier: { code: "USPS", tracking_number: "TRACK-77" },
        },
      },
    };

    await processPrintifyWebhook(fakeClient, event);
    // A later sync re-applies the same delivered shipment under a new event id.
    await processPrintifyWebhook(fakeClient, { ...event, id: "evt-delivered-email-4" });

    expect(fakeEmail.sent).toHaveLength(1);
    expect(await db.emailLog.count()).toBe(1);
  });
});
