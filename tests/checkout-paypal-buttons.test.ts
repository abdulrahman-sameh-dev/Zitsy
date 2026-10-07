import { describe, expect, it } from "vitest";

import { createOrderCallback } from "@/lib/checkout/paypal-buttons";

// Regression: the PayPal JS SDK `createOrder` callback must resolve to the
// PayPal order ID string. Returning `{ orderID }` triggered the SDK error
// "Expected an order id to be passed".
describe("createOrderCallback (PayPal SDK contract)", () => {
  it("resolves to the exact PayPal order id string", async () => {
    const callback = createOrderCallback("5O190127TN364715T");
    const value = await callback();
    expect(value).toBe("5O190127TN364715T");
    expect(typeof value).toBe("string");
  });

  it("never returns the legacy { orderID } object shape", async () => {
    const value = await createOrderCallback("PAYPAL-ORDER-1")();
    expect(value).not.toBeNull();
    expect(value).not.toBeUndefined();
    expect(typeof value).not.toBe("object");
    expect(value).not.toHaveProperty("orderID");
  });

  it("returns a fresh promise on each invocation", async () => {
    const callback = createOrderCallback("PAYPAL-ORDER-2");
    expect(await callback()).toBe("PAYPAL-ORDER-2");
    expect(await callback()).toBe("PAYPAL-ORDER-2");
  });
});