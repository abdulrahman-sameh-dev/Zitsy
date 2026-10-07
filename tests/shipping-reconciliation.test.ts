import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db/prisma";
import {
  createPrintifyOrderForZitsyOrder,
  syncFulfillmentFromPrintify,
} from "@/lib/fulfillment/service";
import {
  printifyActualShippingMinor,
  reconcilePrintifyShipping,
} from "@/lib/fulfillment/shipping-reconciliation";

import { FakePrintify } from "./fake-printify";

let seq = 0;

interface SeedOptions {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus | "NONE";
  /** Quoted Printify shipping (source minor). Null/omitted = no quote captured. */
  quotedShippingMinor?: number | null;
  quotedShippingCurrency?: string | null;
  withPrintifyOrder?: string;
}

async function seedOrder(opts: SeedOptions = {}) {
  seq += 1;
  const product = await db.product.create({
    data: {
      printifyId: `PP-RECON-${seq}`,
      title: "Recon Tee",
      slug: `recon-tee-${seq}`,
      currency: "GBP",
      minPriceMinor: 2500,
      variants: {
        create: [
          {
            printifyVariantId: 11,
            title: "Black / M",
            sku: `SKU-RECON-${seq}`,
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
      orderNumber: `ZS-RECON-${seq}`,
      email: `recon${seq}@example.com`,
      status: opts.status ?? "PAID",
      currency: "GBP",
      subtotalMinor: 2500,
      shippingMinor: 783,
      totalMinor: 3283,
      recipientName: "Jane Smith",
      address1: "1 Main St",
      city: "London",
      postalCode: "SW1A 1AA",
      country: "GB",
      phone: "+447700900000",
      printifyOrderId: opts.withPrintifyOrder,
      printifyQuotedShippingMinor:
        opts.quotedShippingMinor === undefined ? 1039 : opts.quotedShippingMinor,
      printifyQuotedShippingCurrency:
        opts.quotedShippingCurrency === undefined ? "USD" : opts.quotedShippingCurrency,
      printifyShippingReconcileStatus:
        opts.quotedShippingMinor === null ? "UNAVAILABLE" : "PENDING",
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            printifyProductId: product.printifyId,
            printifyVariantId: 11,
            title: "Recon Tee",
            variantTitle: "Black / M",
            sku: `SKU-RECON-${seq}`,
            quantity: 1,
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
                providerOrderId: `PAYPAL-RECON-${seq}`,
                status: opts.paymentStatus ?? "COMPLETED",
                amountMinor: 3283,
                currency: "GBP",
              },
            },
          }),
    },
  });
}

function shippingOrder(id: string, totalShipping?: number) {
  return { id, total_shipping: totalShipping };
}

beforeEach(async () => {
  await db.orderItem.deleteMany();
  await db.payment.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
});

afterAll(async () => {
  await db.orderItem.deleteMany();
  await db.payment.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
  await db.$disconnect();
});

describe("printifyActualShippingMinor", () => {
  it("reads a finite non-negative amount", () => {
    expect(printifyActualShippingMinor(shippingOrder("x", 1216))).toBe(1216);
    expect(printifyActualShippingMinor(shippingOrder("x", 0))).toBe(0);
  });

  it("treats missing or invalid amounts as unavailable", () => {
    expect(printifyActualShippingMinor(shippingOrder("x"))).toBeNull();
    expect(printifyActualShippingMinor(shippingOrder("x", -5))).toBeNull();
    expect(printifyActualShippingMinor(shippingOrder("x", Number.NaN))).toBeNull();
  });
});

describe("reconcilePrintifyShipping", () => {
  it("records a zero delta when quote equals actual", async () => {
    const order = await seedOrder({ quotedShippingMinor: 1039 });

    const result = await reconcilePrintifyShipping(order.id, shippingOrder("PFY-1", 1039));

    expect(result).toEqual({ status: "RECONCILED", deltaMinor: 0 });
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({
      printifyQuotedShippingMinor: 1039,
      printifyQuotedShippingCurrency: "USD",
      printifyActualShippingMinor: 1039,
      printifyActualShippingCurrency: "USD",
      printifyShippingDeltaMinor: 0,
      printifyShippingReconcileStatus: "RECONCILED",
    });
    expect(saved.printifyShippingReconciledAt).not.toBeNull();
  });

  it("records a negative delta when the actual amount is lower", async () => {
    const order = await seedOrder({ quotedShippingMinor: 4559 });
    const result = await reconcilePrintifyShipping(order.id, shippingOrder("x", 1216));

    expect(result.status).toBe("RECONCILED");
    expect(result.deltaMinor).toBe(-3343);

    const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(fresh.printifyActualShippingMinor).toBe(1216);
    expect(fresh.printifyShippingDeltaMinor).toBe(-3343);
  });

  it("records a positive delta when Printify charges more than quoted", async () => {
    const order = await seedOrder({ quotedShippingMinor: 1039 });
    const result = await reconcilePrintifyShipping(order.id, shippingOrder("x", 1500));
    expect(result).toEqual({ status: "RECONCILED", deltaMinor: 461 });

    const fresh = await db.order.findUnique({ where: { id: order.id } });
    expect(fresh?.printifyShippingDeltaMinor).toBe(461);
  });

  it("stays PENDING when the actual amount is not yet available", async () => {
    const order = await seedOrder({ quotedShippingMinor: 1039 });

    const result = await reconcilePrintifyShipping(order.id, shippingOrder("x"));

    expect(result).toEqual({ status: "PENDING", deltaMinor: null });
    const fresh = await db.order.findUnique({
      where: { id: order.id },
      select: {
        printifyActualShippingMinor: true,
        printifyShippingDeltaMinor: true,
        printifyShippingReconcileStatus: true,
        printifyShippingReconciledAt: true,
      },
    });
    expect(fresh).toEqual({
      printifyActualShippingMinor: null,
      printifyShippingDeltaMinor: null,
      printifyShippingReconcileStatus: "PENDING",
      printifyShippingReconciledAt: null,
    });
  });

  it("marks reconciliation unavailable when no quote was captured", async () => {
    const order = await seedOrder({ quotedShippingMinor: null, quotedShippingCurrency: null });
    const result = await reconcilePrintifyShipping(order.id, shippingOrder("x", 1216));
    expect(result).toEqual({ status: "UNAVAILABLE", deltaMinor: null });

    const fresh = await db.order.findUnique({
      where: { id: order.id },
      select: { printifyShippingReconcileStatus: true, printifyShippingReconciledAt: true },
    });
    expect(fresh).toEqual({
      printifyShippingReconcileStatus: "UNAVAILABLE",
      printifyShippingReconciledAt: null,
    });
  });

  it("is idempotent: the first reconciliation wins", async () => {
    const order = await seedOrder({ quotedShippingMinor: 1039 });

    const first = await reconcilePrintifyShipping(order.id, shippingOrder("x", 1216));
    expect(first).toEqual({ status: "RECONCILED", deltaMinor: 177 });

    const second = await reconcilePrintifyShipping(order.id, shippingOrder("x", 9999));
    expect(second).toEqual({ status: "RECONCILED", deltaMinor: 177 });

    const fresh = await db.order.findUnique({
      where: { id: order.id },
      select: {
        printifyActualShippingMinor: true,
        printifyShippingDeltaMinor: true,
        printifyShippingReconcileStatus: true,
      },
    });
    expect(fresh).toEqual({
      printifyActualShippingMinor: 1216,
      printifyShippingDeltaMinor: 177,
      printifyShippingReconcileStatus: "RECONCILED",
    });
  });

  it("reconciles later once the sync path learns the actual amount", async () => {
    const order = await seedOrder({ quotedShippingMinor: 1039 });

    const pending = await reconcilePrintifyShipping(order.id, shippingOrder("x"));
    expect(pending.status).toBe("PENDING");

    const done = await reconcilePrintifyShipping(order.id, shippingOrder("x", 1083));
    expect(done).toEqual({ status: "RECONCILED", deltaMinor: 44 });

    const fresh = await db.order.findUnique({
      where: { id: order.id },
      select: { printifyShippingReconcileStatus: true },
    });
    expect(fresh?.printifyShippingReconcileStatus).toBe("RECONCILED");
  });

  it("ignores a reconcile request for an unknown order", async () => {
    const result = await reconcilePrintifyShipping("does-not-exist", shippingOrder("x", 1));
    expect(result).toEqual({ status: "UNAVAILABLE", deltaMinor: null });
  });
});

describe("shipping reconciliation via fulfillment", () => {
  it("records reconciliation on create without changing fulfillment behavior", async () => {
    const order = await seedOrder({ quotedShippingMinor: 1039 });
    const printify = new FakePrintify({ id: "PFY-CREATE-1" });
    printify.totalShipping = 1216;

    const result = await createPrintifyOrderForZitsyOrder(order.id, printify);

    expect(result).toEqual({
      status: "created",
      fulfillmentStatus: "SUBMITTED",
      printifyOrderId: "PFY-CREATE-1",
    });

    const fresh = await db.order.findUnique({
      where: { id: order.id },
      select: {
        printifyOrderId: true,
        fulfillmentStatus: true,
        printifyQuotedShippingMinor: true,
        printifyActualShippingMinor: true,
        printifyShippingDeltaMinor: true,
        printifyShippingReconcileStatus: true,
      },
    });
    expect(fresh).toMatchObject({
      printifyOrderId: "PFY-CREATE-1",
      fulfillmentStatus: "SUBMITTED",
      printifyQuotedShippingMinor: 1039,
      printifyActualShippingMinor: 1216,
      printifyShippingDeltaMinor: 177,
      printifyShippingReconcileStatus: "RECONCILED",
    });
  });

  it("leaves reconciliation pending when create reports no shipping, then settles via sync", async () => {
    const order = await seedOrder({ quotedShippingMinor: 1039 });
    const printify = new FakePrintify({ id: "PFY-CREATE-2" });
    printify.totalShipping = undefined;

    await createPrintifyOrderForZitsyOrder(order.id, printify);

    let fresh = await db.order.findUnique({
      where: { id: order.id },
      select: { printifyShippingReconcileStatus: true, printifyActualShippingMinor: true },
    });
    expect(fresh).toEqual({
      printifyShippingReconcileStatus: "PENDING",
      printifyActualShippingMinor: null,
    });

    printify.totalShipping = 1100;
    await syncFulfillmentFromPrintify(order.id, printify);

    fresh = await db.order.findUnique({
      where: { id: order.id },
      select: {
        printifyActualShippingMinor: true,
        printifyShippingDeltaMinor: true,
        printifyShippingReconcileStatus: true,
      },
    });
    expect(fresh).toEqual({
      printifyActualShippingMinor: 1100,
      printifyShippingDeltaMinor: 61,
      printifyShippingReconcileStatus: "RECONCILED",
    });
  });
});