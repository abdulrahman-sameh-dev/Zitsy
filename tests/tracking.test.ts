import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db/prisma";
import {
  ensureTrackingToken,
  findOrderByTrackingToken,
  generateTrackingToken,
  isValidTrackingToken,
  lookupOrderByNumberAndEmail,
  normalizeOrderNumber,
  toTrackingView,
  trackUrlForToken,
} from "@/lib/orders/tracking";
import { rateLimit, resetRateLimits } from "@/lib/rate-limit";

let seq = 0;

async function seedOrder(overrides: Partial<{
  email: string;
  status: "PAID" | "PAYMENT_PENDING";
  trackingNumber: string | null;
  printifySubmittedAt: Date | null;
  deliveredAt: Date | null;
}> = {}) {
  seq += 1;
  const product = await db.product.create({
    data: {
      printifyId: `PP-TRACK-${seq}`,
      title: "Track Tee",
      slug: `track-tee-${seq}`,
      currency: "GBP",
      minPriceMinor: 2500,
      variants: {
        create: [
          {
            printifyVariantId: 11,
            title: "Black / M",
            sku: `SKU-TRACK-${seq}`,
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
      orderNumber: `ZS-TR${String(seq).padStart(6, "0")}`,
      email: overrides.email ?? "buyer@example.com",
      status: overrides.status ?? "PAID",
      currency: "GBP",
      subtotalMinor: 2500,
      shippingMinor: 399,
      totalMinor: 2899,
      paidAt: new Date(),
      placedAt: new Date(),
      recipientName: "Jane Smith",
      address1: "1 Main St",
      city: "London",
      postalCode: "SW1A 1AA",
      country: "GB",
      paypalOrderId: `PP-TRACK-${seq}`,
      printifyOrderId: `PFY-TRACK-${seq}`,
      printifySubmittedAt: overrides.printifySubmittedAt ?? null,
      trackingNumber: overrides.trackingNumber ?? null,
      deliveredAt: overrides.deliveredAt ?? null,
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            printifyProductId: product.printifyId,
            printifyVariantId: 11,
            title: "Track Tee",
            variantTitle: "Black / M",
            sku: `SKU-TRACK-${seq}`,
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
          providerOrderId: `PAYPAL-TRACK-${seq}`,
          status: "COMPLETED",
          amountMinor: 2500,
          currency: "GBP",
          completedAt: new Date(),
        },
      },
    },
  });
}

const TRACKING_INCLUDE = {
  items: { include: { product: { include: { images: true } } } },
  payment: true,
} as const;

async function load(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: TRACKING_INCLUDE,
  });
  if (!order) throw new Error("seeded order vanished");
  return order;
}

beforeEach(async () => {
  resetRateLimits();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
});

afterAll(async () => {
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.product.deleteMany();
});

describe("tracking tokens", () => {
  it("are random, url-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateTrackingToken()));
    expect(tokens.size).toBe(50);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(token.length).toBeGreaterThanOrEqual(16);
      expect(isValidTrackingToken(token)).toBe(true);
    }
  });

  it("reject junk before it can reach the database", () => {
    expect(isValidTrackingToken("")).toBe(false);
    expect(isValidTrackingToken("../../etc/passwd")).toBe(false);
    expect(isValidTrackingToken("short")).toBe(false);
    expect(isValidTrackingToken("has spaces in it")).toBe(false);
  });

  it("are assigned once and never derived from the order number", async () => {
    const order = await seedOrder();
    const token = await ensureTrackingToken(order.id);
    expect(token).toBeTruthy();

    const again = await ensureTrackingToken(order.id);
    expect(again).toBe(token);

    const stored = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(stored.trackingToken).toBe(token);
    expect(token).not.toContain(order.orderNumber);
    expect(token).not.toContain(order.id);
  });

  it("are unique across orders", async () => {
    const a = await seedOrder();
    const b = await seedOrder();
    const tokenA = await ensureTrackingToken(a.id);
    const tokenB = await ensureTrackingToken(b.id);
    expect(tokenA).not.toBe(tokenB);
  });

  it("return null for an unknown order", async () => {
    expect(await ensureTrackingToken("does-not-exist")).toBeNull();
  });
});

describe("normalizeOrderNumber", () => {
  it("accepts the stored form and bare suffixes", () => {
    expect(normalizeOrderNumber("ZS-ABC12345")).toBe("ZS-ABC12345");
    expect(normalizeOrderNumber("  zs-abc12345 ")).toBe("ZS-ABC12345");
    expect(normalizeOrderNumber("abc12345")).toBe("ZS-ABC12345");
    expect(normalizeOrderNumber("ZS-ABC 12345")).toBe("ZS-ABC12345");
  });

  it("rejects anything that cannot be an order number", () => {
    expect(normalizeOrderNumber("")).toBeNull();
    expect(normalizeOrderNumber("   ")).toBeNull();
    expect(normalizeOrderNumber("ZS-")).toBeNull();
    expect(normalizeOrderNumber("ab")).toBeNull();
    expect(normalizeOrderNumber("ZS-ABC12345; DROP TABLE")).toBeNull();
    expect(normalizeOrderNumber("<script>")).toBeNull();
  });
});

describe("trackUrlForToken", () => {
  it("points at the public tracking route", () => {
    expect(trackUrlForToken("tok_123")).toMatch(/^https?:\/\/.+\/track-order\/tok_123$/);
  });
});

describe("findOrderByTrackingToken", () => {
  it("finds the order behind a valid token", async () => {
    const order = await seedOrder();
    const token = (await ensureTrackingToken(order.id))!;

    const found = await findOrderByTrackingToken(token);
    expect(found?.id).toBe(order.id);
  });

  it("finds nothing for junk or a foreign token", async () => {
    const order = await seedOrder();
    await ensureTrackingToken(order.id);

    expect(await findOrderByTrackingToken("../../etc/passwd")).toBeNull();
    expect(await findOrderByTrackingToken(generateTrackingToken())).toBeNull();
  });
});

describe("lookupOrderByNumberAndEmail", () => {
  it("matches a real order with the right email (case-insensitive)", async () => {
    const order = await seedOrder({ email: "Buyer@Example.com" });

    const found = await lookupOrderByNumberAndEmail(order.orderNumber, "  buyer@example.COM ");
    expect(found?.id).toBe(order.id);
  });

  it("returns nothing for a wrong email", async () => {
    const order = await seedOrder();
    expect(await lookupOrderByNumberAndEmail(order.orderNumber, "other@example.com")).toBeNull();
  });

  it("returns nothing without an email — no enumeration by number alone", async () => {
    const order = await seedOrder();
    expect(await lookupOrderByNumberAndEmail(order.orderNumber, "")).toBeNull();
    expect(await lookupOrderByNumberAndEmail(order.orderNumber, "   ")).toBeNull();
  });

  it("returns nothing for a non-existent order or malformed number", async () => {
    expect(await lookupOrderByNumberAndEmail("ZS-NOPE9999", "buyer@example.com")).toBeNull();
    expect(await lookupOrderByNumberAndEmail("not a number", "buyer@example.com")).toBeNull();
  });
});

describe("toTrackingView", () => {
  it("exposes customer facts only — no ids, provider references or internals", async () => {
    const order = await seedOrder({
      status: "PAID",
      trackingNumber: "TRACK-5",
      printifySubmittedAt: new Date(),
      deliveredAt: new Date(),
    });
    await ensureTrackingToken(order.id);
    const view = toTrackingView(await load(order.id));
    const serialised = JSON.stringify(view);
    const stored = await db.order.findUniqueOrThrow({ where: { id: order.id } });

    expect(view.orderNumber).toBe(order.orderNumber);
    expect(stored.trackingToken).toBeTruthy();
    expect(serialised).not.toContain(order.id);
    expect(serialised).not.toContain("PP-TRACK");
    expect(serialised).not.toContain("PFY-TRACK");
    expect(serialised).not.toContain("PAYPAL-TRACK");
    expect(serialised).not.toContain(stored.paypalOrderId!);
    expect(serialised).not.toContain(stored.trackingToken!);
    expect(serialised).not.toContain("cost");
    expect(Object.keys(view)).not.toContain("id");
    expect(view.tracking).toEqual({
      carrier: null,
      number: "TRACK-5",
      url: null,
    });
    expect(view.destination).toEqual({ city: "London", countryName: "United Kingdom" });
    expect(view.items[0]).toEqual({
      title: "Track Tee",
      variantTitle: "Black / M",
      quantity: 1,
      unitPriceMinor: 2500,
      totalPriceMinor: 2500,
      imageUrl: null,
    });
  });

  it("builds progressive steps from the existing order state", async () => {
    const order = await seedOrder({ status: "PAID" });
    const fresh = toTrackingView(await load(order.id));
    expect(fresh.steps.map((step) => step.state)).toEqual([
      "done",
      "current",
      "todo",
      "todo",
    ]);

    const shipped = await seedOrder({
      status: "PAID",
      trackingNumber: "TRACK-6",
      printifySubmittedAt: new Date(),
    });
    const shippedView = toTrackingView(await load(shipped.id));
    expect(shippedView.steps.map((step) => step.state)).toEqual([
      "done",
      "done",
      "done",
      "current",
    ]);
    expect(shippedView.tracking?.number).toBe("TRACK-6");
  });

  it("uses customer-friendly labels, never raw enums", async () => {
    const order = await seedOrder({ status: "PAYMENT_PENDING" });
    const view = toTrackingView(await load(order.id));

    expect(view.statusLabel).toBe("Awaiting payment");
    expect(view.paymentLabel).toBe("Paid");
    expect(view.fulfillmentLabel).toBeTruthy();
    expect(view.statusLabel).not.toMatch(/^[A-Z_]+$/);
  });
});

describe("rateLimit", () => {
  it("allows up to the limit and blocks the rest of the window", () => {
    resetRateLimits();
    expect(rateLimit("k1", 3, 60_000)).toBe(true);
    expect(rateLimit("k1", 3, 60_000)).toBe(true);
    expect(rateLimit("k1", 3, 60_000)).toBe(true);
    expect(rateLimit("k1", 3, 60_000)).toBe(false);
    expect(rateLimit("k1", 3, 60_000)).toBe(false);
  });

  it("keeps keys independent", () => {
    resetRateLimits();
    expect(rateLimit("a", 1, 60_000)).toBe(true);
    expect(rateLimit("b", 1, 60_000)).toBe(true);
    expect(rateLimit("a", 1, 60_000)).toBe(false);
  });

  it("opens a fresh window after expiry", () => {
    resetRateLimits();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-07T10:00:00.000Z"));
      expect(rateLimit("later", 1, 60_000)).toBe(true);
      expect(rateLimit("later", 1, 60_000)).toBe(false);

      vi.setSystemTime(new Date("2026-10-07T10:01:01.000Z"));
      expect(rateLimit("later", 1, 60_000)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
