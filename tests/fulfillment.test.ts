import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { serverEnv } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import { FulfillmentError } from "@/lib/fulfillment/errors";
import {
  applyPrintifyOrderUpdate,
  createPrintifyOrderForZitsyOrder,
  fulfillPaidOrder,
  sendPrintifyOrderToProduction,
} from "@/lib/fulfillment/service";
import { processPrintifyWebhook } from "@/lib/printify/handlers";
import { getPrintifyClient, type PrintifyClient } from "@/lib/printify/client";
import type { PrintifyWebhookEvent } from "@/lib/printify/types";

import { FakePrintify, printifyErrors } from "./fake-printify";

let seq = 0;

interface SeedOptions {
  status?: OrderStatus;
  country?: string;
  city?: string;
  quantity?: number;
  paymentStatus?: PaymentStatus | "NONE";
  variantMismatch?: boolean;
  withPrintifyOrder?: string;
}

async function seedOrder(opts: SeedOptions = {}) {
  seq += 1;
  const printifyProductId = `PP-FUL-${seq}`;
  const product = await db.product.create({
    data: {
      printifyId: printifyProductId,
      title: "Fulfill Tee",
      slug: `fulfill-tee-${seq}`,
      currency: "GBP",
      minPriceMinor: 2500,
      variants: {
        create: [
          {
            printifyVariantId: 11,
            title: "Black / M",
            sku: "SKU-FUL",
            priceMinor: 2500,
            currency: "GBP",
            isDefault: true,
          },
        ],
      },
    },
    include: { variants: true },
  });

  const variant = product.variants[0];
  const quantity = opts.quantity ?? 1;

  return db.order.create({
    data: {
      orderNumber: `ZS-FUL${String(seq).padStart(4, "0")}`,
      email: "buyer@example.com",
      status: opts.status ?? "PAID",
      currency: "GBP",
      subtotalMinor: 2500,
      shippingMinor: 0,
      totalMinor: 2500,
      recipientName: "Jane Smith",
      address1: "1 Main St",
      city: opts.city ?? "London",
      postalCode: "SW1A 1AA",
      country: opts.country ?? "GB",
      phone: "+447700900000",
      printifyOrderId: opts.withPrintifyOrder,
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            printifyProductId: product.printifyId,
            printifyVariantId: opts.variantMismatch ? 999 : 11,
            title: "Fulfill Tee",
            variantTitle: "Black / M",
            sku: "SKU-FUL",
            quantity,
            unitPriceMinor: 2500,
            totalPriceMinor: 2500,
            currency: "GBP",
          },
        ],
      },
      ...(opts.paymentStatus === "NONE"
        ? {}
        : {
            payment: {
              create: {
                provider: "paypal",
                providerOrderId: `PAYPAL-${seq}`,
                status: opts.paymentStatus ?? "COMPLETED",
                amountMinor: 2500,
                currency: "GBP",
                completedAt: new Date(),
              },
            },
          }),
    },
  });
}

beforeEach(async () => {
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

describe("createPrintifyOrderForZitsyOrder", () => {
  it("creates exactly one Printify order with authoritative line items and address", async () => {
    const order = await seedOrder();
    const fake = new FakePrintify({ status: "pending" });

    const result = await createPrintifyOrderForZitsyOrder(order.id, fake);

    expect(result.status).toBe("created");
    expect(fake.createCalls).toHaveLength(1);
    expect(fake.createCalls[0]).toMatchObject({
      external_id: order.orderNumber,
      send_shipping_notification: false,
      line_items: [{ product_id: expect.any(String), variant_id: 11, quantity: 1 }],
      address_to: {
        first_name: "Jane",
        last_name: "Smith",
        address1: "1 Main St",
        city: "London",
        zip: "SW1A 1AA",
        country: "GB",
      },
    });

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.printifyOrderId).toBe("PFY-ORDER-1");
    expect(updated.fulfillmentStatus).toBe("SUBMITTED");
    expect(updated.printifySubmittedAt).not.toBeNull();
    expect(updated.fulfillmentAttempts).toBe(1);
    expect(updated.status).toBe("PAID");
  });

  it("is idempotent — a second call never creates a second order", async () => {
    const order = await seedOrder();
    const fake = new FakePrintify();

    await createPrintifyOrderForZitsyOrder(order.id, fake);
    const second = await createPrintifyOrderForZitsyOrder(order.id, fake);

    expect(second.status).toBe("already_submitted");
    expect(fake.createCalls).toHaveLength(1);
  });

  it("skips creation when a Printify order id already exists", async () => {
    const order = await seedOrder({ withPrintifyOrder: "PFY-EXISTING" });
    const fake = new FakePrintify();

    const result = await createPrintifyOrderForZitsyOrder(order.id, fake);
    expect(result.status).toBe("already_submitted");
    expect(result.printifyOrderId).toBe("PFY-EXISTING");
    expect(fake.createCalls).toHaveLength(0);
  });

  it("refuses to create for an unpaid order", async () => {
    const order = await seedOrder({ status: "PAYMENT_PENDING" });
    const fake = new FakePrintify();

    await expect(createPrintifyOrderForZitsyOrder(order.id, fake)).rejects.toMatchObject({
      code: "order_not_paid",
    });
    expect(fake.createCalls).toHaveLength(0);
  });

  it("refuses when payment is not completed", async () => {
    const order = await seedOrder({ paymentStatus: "PENDING" });
    const fake = new FakePrintify();

    await expect(createPrintifyOrderForZitsyOrder(order.id, fake)).rejects.toBeInstanceOf(
      FulfillmentError,
    );
    expect(fake.createCalls).toHaveLength(0);
  });

  it("refuses when the order does not exist", async () => {
    await expect(
      createPrintifyOrderForZitsyOrder("does-not-exist", new FakePrintify()),
    ).rejects.toMatchObject({ code: "order_not_found" });
  });

  it("rejects an invalid quantity or variant mismatch", async () => {
    const zero = await seedOrder({ quantity: 0 });
    await expect(
      createPrintifyOrderForZitsyOrder(zero.id, new FakePrintify()),
    ).rejects.toMatchObject({ code: "invalid_variant" });

    const mismatch = await seedOrder({ variantMismatch: true });
    await expect(
      createPrintifyOrderForZitsyOrder(mismatch.id, new FakePrintify()),
    ).rejects.toMatchObject({ code: "invalid_variant" });
  });

  it("rejects unsupported countries and escalates without creating", async () => {
    const order = await seedOrder({ country: "US" });
    const fake = new FakePrintify();

    await expect(createPrintifyOrderForZitsyOrder(order.id, fake)).rejects.toMatchObject({
      code: "unsupported_country",
    });
    expect(fake.createCalls).toHaveLength(0);

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.fulfillmentStatus).toBe("ACTION_REQUIRED");
    expect(updated.status).toBe("PAID");
  });

  it("rejects an incomplete address", async () => {
    const order = await seedOrder({ city: "" });
    await expect(
      createPrintifyOrderForZitsyOrder(order.id, new FakePrintify()),
    ).rejects.toMatchObject({ code: "invalid_address" });
  });

  it("keeps the order paid and retryable on an ambiguous Printify failure", async () => {
    const order = await seedOrder();
    const fake = new FakePrintify();
    fake.createError = printifyErrors.timeout();

    await expect(createPrintifyOrderForZitsyOrder(order.id, fake)).rejects.toMatchObject({
      code: "ambiguous_create",
      retryable: true,
    });

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("PAID");
    expect(updated.printifyOrderId).toBeNull();
    expect(updated.fulfillmentError).toContain("ambiguous_create");
  });

  it("reconciles an ambiguous attempt by external_id instead of recreating", async () => {
    const order = await seedOrder();
    const fake = new FakePrintify({ id: "PFY-RECONCILED" });
    fake.createError = printifyErrors.server();

    await expect(
      createPrintifyOrderForZitsyOrder(order.id, fake),
    ).rejects.toMatchObject({ code: "ambiguous_create" });

    // Printify actually did create it; the next attempt must find it.
    fake.createError = null;
    fake.orders = [
      { id: "PFY-RECONCILED", status: "pending", external_id: order.orderNumber },
    ];

    const result = await createPrintifyOrderForZitsyOrder(order.id, fake);
    expect(result.status).toBe("created");
    expect(result.printifyOrderId).toBe("PFY-RECONCILED");
    expect(fake.createCalls).toHaveLength(1); // never created a duplicate
  });

  it("does not recreate when an ambiguous attempt is missing from reconciliation", async () => {
    const order = await seedOrder();
    const fake = new FakePrintify();
    fake.createError = printifyErrors.timeout();
    await expect(
      createPrintifyOrderForZitsyOrder(order.id, fake),
    ).rejects.toMatchObject({ code: "ambiguous_create" });

    fake.createError = null;
    await expect(
      createPrintifyOrderForZitsyOrder(order.id, fake),
    ).rejects.toMatchObject({ code: "ambiguous_create" });
    expect(fake.createCalls).toHaveLength(1);
  });
});

describe("fulfillPaidOrder", () => {
  it("never throws for a guard failure and reports it", async () => {
    const order = await seedOrder({ status: "PAYMENT_PENDING" });
    const result = await fulfillPaidOrder(order.id, new FakePrintify());
    expect(result.status).toBe("failed");
    expect(result.code).toBe("order_not_paid");
  });

  it("serializes concurrent triggers so only one order is created", async () => {
    const order = await seedOrder();
    const fake = new FakePrintify();

    const [a, b] = await Promise.all([
      fulfillPaidOrder(order.id, fake),
      fulfillPaidOrder(order.id, fake),
    ]);

    expect(a.status).toBe("created");
    expect(b.status).toBe("created");
    expect(fake.createCalls).toHaveLength(1);
  });

  it("does not auto-send to production when the flag is off", async () => {
    const previous = serverEnv.PRINTIFY_AUTO_SEND_TO_PRODUCTION;
    serverEnv.PRINTIFY_AUTO_SEND_TO_PRODUCTION = false;
    try {
      const order = await seedOrder();
      const fake = new FakePrintify();
      await fulfillPaidOrder(order.id, fake);
      expect(fake.sendToProductionCalls).toHaveLength(0);
    } finally {
      serverEnv.PRINTIFY_AUTO_SEND_TO_PRODUCTION = previous;
    }
  });

  it("auto-sends to production once when the flag is on", async () => {
    const previous = serverEnv.PRINTIFY_AUTO_SEND_TO_PRODUCTION;
    serverEnv.PRINTIFY_AUTO_SEND_TO_PRODUCTION = true;
    try {
      const order = await seedOrder();
      const fake = new FakePrintify();
      await fulfillPaidOrder(order.id, fake);
      expect(fake.sendToProductionCalls).toEqual(["PFY-ORDER-1"]);

      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(updated.fulfillmentStatus).toBe("SENDING_TO_PRODUCTION");
      expect(updated.printifySentToProductionAt).not.toBeNull();
    } finally {
      serverEnv.PRINTIFY_AUTO_SEND_TO_PRODUCTION = previous;
    }
  });
});

describe("sendPrintifyOrderToProduction", () => {
  it("is idempotent and records a failure without losing the submission", async () => {
    const order = await seedOrder();
    const fake = new FakePrintify();
    await createPrintifyOrderForZitsyOrder(order.id, fake);

    await sendPrintifyOrderToProduction(order.id, fake);
    await sendPrintifyOrderToProduction(order.id, fake);
    expect(fake.sendToProductionCalls).toHaveLength(1);

    const other = await seedOrder();
    const failing = new FakePrintify({ id: "PFY-ORDER-2" });
    await createPrintifyOrderForZitsyOrder(other.id, failing);
    failing.sendError = printifyErrors.rejected();
    await expect(sendPrintifyOrderToProduction(other.id, failing)).rejects.toMatchObject({
      code: "printify_rejected",
    });
    const updated = await db.order.findUniqueOrThrow({ where: { id: other.id } });
    expect(updated.printifyOrderId).not.toBeNull();
    expect(updated.status).toBe("PAID");
    expect(updated.fulfillmentError).toContain("printify_rejected");
  });

  it("refuses to send an order that has no Printify submission", async () => {
    const order = await seedOrder();
    await expect(
      sendPrintifyOrderToProduction(order.id, new FakePrintify()),
    ).rejects.toMatchObject({ code: "not_submitted" });
  });
});

describe("printify order webhooks", () => {
  const fakeClient = {} as PrintifyClient;

  async function submittedOrder() {
    const order = await seedOrder({ withPrintifyOrder: "PFY-WH-1" });
    return order;
  }

  it("applies order:updated status forward-only", async () => {
    const order = await submittedOrder();
    const payload: PrintifyWebhookEvent = {
      id: "evt-upd-1",
      type: "order:updated",
      created_at: new Date().toISOString(),
      resource: {
        id: "PFY-WH-1",
        type: "order",
        data: { shop_id: 1, status: "in-production" },
      },
    };

    const status = await processPrintifyWebhook(fakeClient, payload);
    expect(status).toBe("processed");

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.printifyStatus).toBe("in-production");
    expect(updated.fulfillmentStatus).toBe("IN_PRODUCTION");
  });

  it("records tracking and fulfilled state on shipment:delivered", async () => {
    const order = await submittedOrder();
    const deliveredAt = "2026-01-02T03:04:05.000Z";
    const payload: PrintifyWebhookEvent = {
      id: "evt-ship-1",
      type: "order:shipment:delivered",
      created_at: deliveredAt,
      resource: {
        id: "PFY-WH-1",
        type: "order",
        data: {
          shop_id: 1,
          delivered_at: deliveredAt,
          carrier: {
            code: "USPS",
            tracking_number: "TRACK-1",
            tracking_url: "https://track.example/TRACK-1",
          },
        },
      },
    };

    await processPrintifyWebhook(fakeClient, payload);
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.fulfillmentStatus).toBe("FULFILLED");
    expect(updated.trackingCarrier).toBe("USPS");
    expect(updated.trackingNumber).toBe("TRACK-1");
    expect(updated.trackingUrl).toBe("https://track.example/TRACK-1");
    expect(updated.printifyFulfilledAt).not.toBeNull();
  });

  it("reads the legacy webhook shape", async () => {
    const order = await submittedOrder();
    const payload = {
      id: "evt-legacy-1",
      type: "order:updated",
      data: { resource_id: "PFY-WH-1", status: "on-hold" },
    } as unknown as PrintifyWebhookEvent;

    await processPrintifyWebhook(fakeClient, payload);
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.fulfillmentStatus).toBe("ON_HOLD");
  });

  it("processes a duplicate event only once and ignores unknown orders", async () => {
    await submittedOrder();
    const payload: PrintifyWebhookEvent = {
      id: "evt-dup-1",
      type: "order:updated",
      resource: { id: "PFY-WH-1", type: "order", data: { status: "fulfilled" } },
    };
    await processPrintifyWebhook(fakeClient, payload);
    await processPrintifyWebhook(fakeClient, payload);
    expect(await db.webhookEvent.count({ where: { eventId: "evt-dup-1" } })).toBe(1);

    const unknown: PrintifyWebhookEvent = {
      id: "evt-unknown-1",
      type: "order:updated",
      resource: { id: "PFY-NOPE", type: "order", data: { status: "fulfilled" } },
    };
    expect(await processPrintifyWebhook(fakeClient, unknown)).toBe("ignored");
  });
});

describe("applyPrintifyOrderUpdate", () => {
  it("never overwrites a terminal state with an out-of-order update", async () => {
    const order = await seedOrder({ withPrintifyOrder: "PFY-TERM-1" });
    await db.order.update({
      where: { id: order.id },
      data: { fulfillmentStatus: "FULFILLED" },
    });

    await applyPrintifyOrderUpdate("PFY-TERM-1", { status: "in-production" });
    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.fulfillmentStatus).toBe("FULFILLED");
  });

  it("never touches payment status", async () => {
    const order = await seedOrder({ withPrintifyOrder: "PFY-PAY-1" });
    await applyPrintifyOrderUpdate("PFY-PAY-1", { status: "in-production" });
    const updated = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(updated.status).toBe("PAID");
    expect(updated.payment?.status).toBe("COMPLETED");
  });
});

it("disables the real Printify client in tests", () => {
  expect(() => getPrintifyClient()).toThrow(/disabled in tests/);
});