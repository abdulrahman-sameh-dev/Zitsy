import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db/prisma";
import type { PaypalWebhookEvent } from "@/lib/paypal/types";
import { processPaypalWebhook } from "@/lib/paypal/webhook-handler";

import { FakePaypal, completedOrder } from "./fake-paypal";

function approvedEvent(eventId: string, paypalOrderId: string): PaypalWebhookEvent {
  return {
    id: eventId,
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: { id: paypalOrderId },
  };
}

function captureEvent(
  eventId: string,
  type: string,
  paypalOrderId: string,
  value = "50.00",
  currency = "GBP",
): PaypalWebhookEvent {
  return {
    id: eventId,
    event_type: type,
    resource: {
      id: "CAP-1",
      status: type === "PAYMENT.CAPTURE.COMPLETED" ? "COMPLETED" : "DECLINED",
      amount: { currency_code: currency, value },
      supplementary_data: { related_ids: { order_id: paypalOrderId } },
    },
  };
}

async function createPendingOrder(paypalOrderId: string) {
  const order = await db.order.create({
    data: {
      orderNumber: `ZS-${randomUUID().slice(0, 8)}`,
      email: "buyer@example.com",
      status: "PAYMENT_PENDING",
      currency: "GBP",
      subtotalMinor: 5000,
      shippingMinor: 0,
      totalMinor: 5000,
      recipientName: "Ada Lovelace",
      address1: "1 Analytical Engine Way",
      city: "London",
      postalCode: "EC1A 1BB",
      country: "GB",
      paypalOrderId,
    },
  });
  await db.payment.create({
    data: {
      orderId: order.id,
      provider: "paypal",
      providerOrderId: paypalOrderId,
      status: "PENDING",
      amountMinor: 5000,
      currency: "GBP",
    },
  });
  return order;
}

beforeAll(async () => {
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
});

afterAll(async () => {
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
});

beforeEach(async () => {
  await db.webhookEvent.deleteMany();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
});

describe("processPaypalWebhook", () => {
  it("captures and marks paid on CHECKOUT.ORDER.APPROVED", async () => {
    const order = await createPendingOrder("PP-1");
    const paypal = new FakePaypal(() => completedOrder("PP-1", order.id, "50.00"));

    const outcome = await processPaypalWebhook(
      approvedEvent("EVT-1", "PP-1"),
      paypal,
    );
    expect(outcome).toBe("processed");

    const updated = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(updated.status).toBe("PAID");
    expect(updated.payment?.status).toBe("COMPLETED");
  });

  it("is idempotent per event id", async () => {
    const order = await createPendingOrder("PP-2");
    let captures = 0;
    const paypal = new FakePaypal(() => {
      captures += 1;
      return completedOrder("PP-2", order.id, "50.00");
    });

    expect(await processPaypalWebhook(approvedEvent("EVT-2", "PP-2"), paypal)).toBe(
      "processed",
    );
    expect(await processPaypalWebhook(approvedEvent("EVT-2", "PP-2"), paypal)).toBe(
      "duplicate",
    );
    expect(captures).toBe(1);
  });

  it("marks paid on PAYMENT.CAPTURE.COMPLETED", async () => {
    const order = await createPendingOrder("PP-3");
    const paypal = new FakePaypal(() => completedOrder("PP-3", order.id, "50.00"));

    const outcome = await processPaypalWebhook(
      captureEvent("EVT-3", "PAYMENT.CAPTURE.COMPLETED", "PP-3"),
      paypal,
    );
    expect(outcome).toBe("processed");

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("PAID");
  });

  it("marks failed on PAYMENT.CAPTURE.DENIED", async () => {
    const order = await createPendingOrder("PP-4");
    const paypal = new FakePaypal(() => completedOrder("PP-4", order.id, "50.00"));

    const outcome = await processPaypalWebhook(
      captureEvent("EVT-4", "PAYMENT.CAPTURE.DENIED", "PP-4"),
      paypal,
    );
    expect(outcome).toBe("processed");

    const updated = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payment: true },
    });
    expect(updated.status).toBe("PAYMENT_FAILED");
    expect(updated.payment?.status).toBe("FAILED");
  });

  it("rejects a capture whose amount does not match, without paying", async () => {
    const order = await createPendingOrder("PP-5");
    const paypal = new FakePaypal(() => completedOrder("PP-5", order.id, "50.00"));

    const outcome = await processPaypalWebhook(
      captureEvent("EVT-5", "PAYMENT.CAPTURE.COMPLETED", "PP-5", "9.99"),
      paypal,
    );
    expect(outcome).toBe("rejected");

    const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(updated.status).toBe("PAYMENT_FAILED");
  });

  it("ignores events for unknown orders and unrelated types", async () => {
    const paypal = new FakePaypal(() => completedOrder("PP-X", "X", "50.00"));
    expect(
      await processPaypalWebhook(approvedEvent("EVT-6", "PP-UNKNOWN"), paypal),
    ).toBe("ignored");
    expect(
      await processPaypalWebhook(
        { id: "EVT-7", event_type: "PAYMENT.SALE.COMPLETED", resource: {} },
        paypal,
      ),
    ).toBe("ignored");
  });
});