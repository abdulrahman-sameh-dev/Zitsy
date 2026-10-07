import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CheckoutError } from "@/lib/checkout/errors";
import {
  beginCheckout,
  captureOrderPayment,
  prepareCheckout,
  quoteCheckout,
} from "@/lib/checkout/service";
import { db } from "@/lib/db/prisma";
import { PayPalApiError } from "@/lib/paypal/client";
import { clearShippingCache } from "@/lib/shipping";

import { CUSTOMER, FakePaypal, completedOrder } from "./fake-paypal";
import { FakeShipping } from "./fake-printify";

let productId: string;
let variantId: string;
let cartId: string;

async function seed() {
  const product = await db.product.create({
    data: {
      printifyId: "PP-CHK",
      title: "Checkout Tee",
      slug: "checkout-tee",
      currency: "GBP",
      minPriceMinor: 2500,
      variants: {
        create: [
          {
            printifyVariantId: 11,
            title: "Black / M",
            sku: "SKU-11",
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
  productId = product.id;
  variantId = product.variants[0].id;

  const cart = await db.cart.create({
    data: {
      token: "checkout-cart-token",
      items: {
        create: [
          {
            productId,
            variantId,
            quantity: 2,
            unitPriceMinor: 2500,
            currency: "GBP",
          },
        ],
      },
    },
  });
  cartId = cart.id;
}

beforeAll(async () => {
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.product.deleteMany();
});

afterAll(async () => {
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.product.deleteMany();
});

beforeEach(async () => {
  clearShippingCache();
  await db.payment.deleteMany();
  await db.orderItem.deleteMany();
  await db.order.deleteMany();
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.product.deleteMany();
  await seed();
});

/** Creates the local + PayPal order and returns the ids for capture tests. */
async function startOrder(): Promise<{ orderId: string; paypalOrderId: string }> {
  const paypal = new FakePaypal(() => {
    throw new Error("no capture expected during beginCheckout");
  });
  const result = await beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping());
  return { orderId: result.orderId, paypalOrderId: result.paypalOrderId };
}

describe("prepareCheckout", () => {
  it("rebuilds the cart into a server-authoritative snapshot", async () => {
    const prepared = await prepareCheckout(cartId);
    expect(prepared.currency).toBe("GBP");
    expect(prepared.subtotalMinor).toBe(5000);
    expect(prepared.shippingMinor).toBe(0);
    expect(prepared.totalMinor).toBe(5000);
    expect(prepared.lines[0]).toMatchObject({
      variantId,
      quantity: 2,
      unitPriceMinor: 2500,
      totalPriceMinor: 5000,
      printifyProductId: "PP-CHK",
      printifyVariantId: 11,
    });
  });

  it("rejects an empty cart", async () => {
    const empty = await db.cart.create({ data: { token: "empty-cart" } });
    await expect(prepareCheckout(empty.id)).rejects.toMatchObject({
      code: "empty_cart",
    });
  });

  it("rejects when a variant becomes unavailable", async () => {
    await db.productVariant.update({
      where: { id: variantId },
      data: { isAvailable: false },
    });
    await expect(prepareCheckout(cartId)).rejects.toMatchObject({
      code: "cart_invalid",
    });
  });
});

describe("beginCheckout", () => {
  it("creates a local order and a matching PayPal order", async () => {
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    const result = await beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping());

    expect(result.paypalOrderId).toBe("PP-ORDER-1");
    expect(result.totalMinor).toBe(5783);

    const order = await db.order.findUniqueOrThrow({
      where: { id: result.orderId },
      include: { items: true, payment: true },
    });
    expect(order.status).toBe("PAYMENT_PENDING");
    expect(order.totalMinor).toBe(5783);
    expect(order.payment?.status).toBe("PENDING");
    expect(order.items).toHaveLength(1);
    expect(order.items[0].title).toBe("Checkout Tee");
    expect(order.items[0].sku).toBe("SKU-11");

    expect(paypal.created).toHaveLength(1);
    expect(paypal.created[0].amount).toEqual({
      currency_code: "GBP",
      value: "57.83",
    });
    expect(paypal.created[0].customId).toBe(result.orderId);
  });

  it("returns the PayPal order id — never the local Zitsy order id", async () => {
    // The browser SDK must receive the PayPal-generated id, not our internal
    // Order.id (regression for "Expected an order id to be passed").
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    const result = await beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping());

    expect(result.paypalOrderId).toBe("PP-ORDER-1");
    expect(result.paypalOrderId).not.toBe(result.orderId);
    expect(result.orderId).toMatch(/^c[a-z0-9]+$/); // cuid, internal only
  });

  it("reuses an in-flight order for the same cart and customer", async () => {
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    const first = await beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping());
    const second = await beginCheckout(
      { cartId, customer: CUSTOMER, existingOrderId: first.orderId },
      paypal,
      new FakeShipping(),
    );

    expect(second.orderId).toBe(first.orderId);
    expect(second.paypalOrderId).toBe(first.paypalOrderId);
    expect(paypal.created).toHaveLength(1);
    expect(await db.order.count()).toBe(1);
  });

  it("cancels an in-flight order when the cart changed", async () => {
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    const first = await beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping());

    await db.cartItem.updateMany({ where: { cartId }, data: { quantity: 3 } });

    const second = await beginCheckout(
      { cartId, customer: CUSTOMER, existingOrderId: first.orderId },
      paypal,
      new FakeShipping(),
    );

    expect(second.orderId).not.toBe(first.orderId);
    const cancelled = await db.order.findUniqueOrThrow({
      where: { id: first.orderId },
    });
    expect(cancelled.status).toBe("CANCELLED");
  });

  it("cancels an in-flight order when only the shipping address changed", async () => {
    // Regression: a flat-rate shipping quote gives every GB address the same
    // total, so comparing email + total + cart snapshot alone handed back the
    // previous order — and the customer paid for the old address.
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    const first = await beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping());

    const second = await beginCheckout(
      {
        cartId,
        customer: { ...CUSTOMER, address1: "99 Different Street" },
        existingOrderId: first.orderId,
      },
      paypal,
      new FakeShipping(),
    );

    expect(second.orderId).not.toBe(first.orderId);
    expect(second.totalMinor).toBe(first.totalMinor);
    expect(second.paypalOrderId).not.toBe(first.paypalOrderId);
    expect(await db.order.count()).toBe(2); // old order cancelled, new order created

    const reused = await db.order.findUniqueOrThrow({
      where: { id: first.orderId },
    });
    expect(reused.status).toBe("CANCELLED");
    expect(reused.address1).toBe("1 Analytical Engine Way");

    const fresh = await db.order.findUniqueOrThrow({
      where: { id: second.orderId },
    });
    expect(fresh.status).toBe("PAYMENT_PENDING");
    expect(fresh.address1).toBe("99 Different Street");
  });
});

describe("quoteCheckout", () => {
  it("returns a server-authoritative shipping and total quote", async () => {
    const quote = await quoteCheckout(cartId, CUSTOMER, new FakeShipping());
    expect(quote.subtotalMinor).toBe(5000);
    expect(quote.shippingMinor).toBe(783);
    expect(quote.totalMinor).toBe(5783);
    // Expected Printify shipping cost tracks the source quote (USD 10.39 → £7.83).
    expect(quote.expectedShippingCostMinor).toBe(783);
  });

  it("rejects a postcode that does not match the market", async () => {
    await expect(
      quoteCheckout(cartId, { ...CUSTOMER, postalCode: "12345" }, new FakeShipping()),
    ).rejects.toMatchObject({ code: "invalid_address" });
  });
});

describe("profit safety", () => {
  it("allows a profitable order and creates the PayPal order", async () => {
    const paypal = new FakePaypal(() => {
      throw new Error("no capture expected during beginCheckout");
    });
    const result = await beginCheckout(
      { cartId, customer: CUSTOMER },
      paypal,
      new FakeShipping(),
    );
    expect(result.totalMinor).toBe(5783);
    expect(paypal.created).toHaveLength(1);
  });

  it("refuses to start payment when the subtotal cannot cover cost + fees", async () => {
    await db.productVariant.update({ where: { id: variantId }, data: { costMinor: 5000 } });
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    await expect(
      beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping()),
    ).rejects.toMatchObject({ code: "unprofitable_order" });
    expect(paypal.created).toHaveLength(0);
    expect(await db.order.count()).toBe(0);
  });

  it("refuses to start payment when a variant has no recorded fulfillment cost", async () => {
    await db.productVariant.update({ where: { id: variantId }, data: { costMinor: 0 } });
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    await expect(
      beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping()),
    ).rejects.toMatchObject({ code: "unprofitable_order" });
    expect(paypal.created).toHaveLength(0);
    expect(await db.order.count()).toBe(0);
  });

  it("rejects a zero-contribution order before PayPal", async () => {
    // Price exactly equals cost: production + payment fee drives contribution < 0.
    await db.productVariant.update({
      where: { id: variantId },
      data: { priceMinor: 1000, costMinor: 1000 },
    });
    await db.cartItem.updateMany({ where: { cartId }, data: { quantity: 1 } });
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    await expect(
      beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping()),
    ).rejects.toMatchObject({ code: "unprofitable_order" });
    expect(paypal.created).toHaveLength(0);
    expect(await db.order.count()).toBe(0);
  });

  it("rejects a product-profitable order that is unprofitable once shipping and fees are counted", async () => {
    // Product line has a healthy markup, but high shipping cost + payment fee
    // still makes the whole order loss-making.
    await db.productVariant.update({
      where: { id: variantId },
      data: { priceMinor: 1400, costMinor: 1000 },
    });
    await db.cartItem.updateMany({ where: { cartId }, data: { quantity: 1 } });
    const shipping = new FakeShipping();
    shipping.standard = 20000; // $200.00 shipping quote
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    await expect(
      beginCheckout({ cartId, customer: CUSTOMER }, paypal, shipping),
    ).rejects.toMatchObject({ code: "unprofitable_order" });
    expect(paypal.created).toHaveLength(0);
  });

  it("uses the server-side cost, ignoring tampered cart line prices", async () => {
    // Even if the cart row's unitPriceMinor is tampered, checkout reads the
    // variant price/cost from the database.
    await db.cartItem.updateMany({ where: { cartId }, data: { unitPriceMinor: 1 } });
    const paypal = new FakePaypal(() => {
      throw new Error("no capture expected during beginCheckout");
    });
    const result = await beginCheckout(
      { cartId, customer: CUSTOMER },
      paypal,
      new FakeShipping(),
    );
    expect(result.totalMinor).toBe(5783);
    expect(paypal.created[0].amount.value).toBe("57.83");
  });

  it("derives shipping for profitability from the Printify quote, not the client", async () => {
    // A different Printify quote changes the authoritative total — there is no
    // client-supplied shipping amount in the request.
    const first = await quoteCheckout(cartId, CUSTOMER, new FakeShipping());
    expect(first.shippingMinor).toBe(783);

    clearShippingCache();
    const shipping = new FakeShipping();
    shipping.standard = 1500; // $15.00 → £11.31
    const second = await quoteCheckout(cartId, CUSTOMER, shipping);
    expect(second.shippingMinor).toBe(1131);
    // Product subtotal is the variant price and does not move with shipping.
    expect(second.subtotalMinor).toBe(5000);
    expect(second.totalMinor).toBe(5000 + 1131);
  });

  it("rejects when quantity pushes an otherwise-profitable line negative", async () => {
    await db.productVariant.update({
      where: { id: variantId },
      data: { priceMinor: 1000, costMinor: 1000 },
    });
    await db.cartItem.updateMany({ where: { cartId }, data: { quantity: 3 } });
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    await expect(
      beginCheckout({ cartId, customer: CUSTOMER }, paypal, new FakeShipping()),
    ).rejects.toMatchObject({ code: "unprofitable_order" });
  });
});

describe("profit safety regression cases", () => {
  it("mug × 4: order-level contribution is positive, so it is allowed", async () => {
    // Actual observed case: subtotal £23.96 + shipping £34.73, cost $20.12, ship $46.06.
    await db.productVariant.update({
      where: { id: variantId },
      // Per-unit mug: £5.99 retail, £3.79 production cost (Printify $5.03).
      data: { priceMinor: 599, costMinor: 379 },
    });
    await db.cartItem.updateMany({ where: { cartId }, data: { quantity: 4 } });
    const shipping = new FakeShipping();
    shipping.standard = 4606; // $46.06 → £34.73
    const paypal = new FakePaypal(() => {
      throw new Error("no capture expected during beginCheckout");
    });
    const result = await beginCheckout(
      { cartId, customer: CUSTOMER },
      paypal,
      shipping,
    );
    // £23.96 product + £34.73 shipping = £58.69
    expect(result.totalMinor).toBe(5869);
    expect(paypal.created).toHaveLength(1);
  });

  it("t-shirt × 1: conversion, fee allowance and contribution allow the order", async () => {
    await db.productVariant.update({
      where: { id: variantId },
      data: { priceMinor: 1199, costMinor: 815 },
    });
    await db.cartItem.updateMany({ where: { cartId }, data: { quantity: 1 } });
    const shipping = new FakeShipping();
    shipping.standard = 1039; // $10.39 → £7.83
    const quote = await quoteCheckout(cartId, CUSTOMER, shipping);
    expect(quote.subtotalMinor).toBe(1199);
    expect(quote.shippingMinor).toBe(783);
    expect(quote.expectedShippingCostMinor).toBe(783);
    expect(quote.totalMinor).toBe(1982);

    const paypal = new FakePaypal(() => {
      throw new Error("no capture expected during beginCheckout");
    });
    const result = await beginCheckout(
      { cartId, customer: CUSTOMER },
      paypal,
      shipping,
    );
    expect(result.totalMinor).toBe(1982);
  });

  it("fails safely (no order) when the shipping quote is unavailable", async () => {
    const shipping = new FakeShipping();
    shipping.error = new Error("printify down");
    const paypal = new FakePaypal(() => {
      throw new Error("unused");
    });
    await expect(
      beginCheckout({ cartId, customer: CUSTOMER }, paypal, shipping),
    ).rejects.toMatchObject({ code: "shipping_unavailable" });
    expect(paypal.created).toHaveLength(0);
    expect(await db.order.count()).toBe(0);
  });
});

describe("captureOrderPayment", () => {
  it("marks the order paid and clears the cart on a verified capture", async () => {
    const { orderId, paypalOrderId } = await startOrder();
    const paypal = new FakePaypal(() => completedOrder(paypalOrderId, orderId, "57.83"));
    paypal.paypalOrderId = paypalOrderId;

    const result = await captureOrderPayment(orderId, paypal);
    expect(result.alreadyPaid).toBe(false);

    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true },
    });
    expect(order.status).toBe("PAID");
    expect(order.paidAt).not.toBeNull();
    expect(order.payment?.status).toBe("COMPLETED");
    expect(order.payment?.providerPaymentId).toBe("CAP-1");
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0);
  });

  it("sends a stable capture request id for idempotency", async () => {
    const { orderId, paypalOrderId } = await startOrder();
    const paypal = new FakePaypal(() =>
      completedOrder(paypalOrderId, orderId, "57.83"),
    );
    await captureOrderPayment(orderId, paypal);
    expect(paypal.captureRequests[0]).toBe(
      `${paypalOrderId}:zitsy-capture-${orderId}`,
    );
  });

  it("does not mark paid when the captured amount does not match", async () => {
    const { orderId, paypalOrderId } = await startOrder();
    const paypal = new FakePaypal(() => completedOrder(paypalOrderId, orderId, "1.00"));

    await expect(captureOrderPayment(orderId, paypal)).rejects.toBeInstanceOf(
      CheckoutError,
    );

    const order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { payment: true },
    });
    expect(order.status).toBe("PAYMENT_FAILED");
    expect(order.payment?.status).toBe("FAILED");
    expect(await db.cartItem.count({ where: { cartId } })).toBe(1);
  });

  it("does not mark paid when the captured currency does not match", async () => {
    const { orderId, paypalOrderId } = await startOrder();
    const paypal = new FakePaypal(() =>
      completedOrder(paypalOrderId, orderId, "57.83", "USD"),
    );

    await expect(captureOrderPayment(orderId, paypal)).rejects.toMatchObject({
      code: "currency_mismatch",
    });
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAYMENT_FAILED");
  });

  it("is idempotent — a paid order is never captured twice", async () => {
    const { orderId, paypalOrderId } = await startOrder();
    let captureCalls = 0;
    const paypal = new FakePaypal(() => {
      captureCalls += 1;
      return completedOrder(paypalOrderId, orderId, "57.83");
    });

    await captureOrderPayment(orderId, paypal);
    const second = await captureOrderPayment(orderId, paypal);
    expect(second.alreadyPaid).toBe(true);
    expect(captureCalls).toBe(1);
  });

  it("recovers when PayPal reports the order was already captured", async () => {
    const { orderId, paypalOrderId } = await startOrder();
    const paypal = new FakePaypal(() => completedOrder(paypalOrderId, orderId, "57.83"));
    paypal.captureError = new PayPalApiError(
      "already captured",
      422,
      "ORDER_ALREADY_CAPTURED",
    );

    await captureOrderPayment(orderId, paypal);
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(order.status).toBe("PAID");
  });
});