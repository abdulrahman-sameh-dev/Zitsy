import { beforeEach, describe, expect, it } from "vitest";

import { CheckoutError } from "@/lib/checkout/errors";
import {
  calculateShipping,
  clearShippingCache,
  type ShippingGateway,
} from "@/lib/shipping";
import type { PrintifyShippingCosts } from "@/lib/printify/types";

const lines = [{ productId: "PP-1", variantId: 11, quantity: 1 }];
const gbDestination = { country: "GB", city: "London", postalCode: "SW1A 2AA" };

function gateway(costs: PrintifyShippingCosts): ShippingGateway {
  return { getShippingCosts: async () => costs };
}

beforeEach(() => clearShippingCache());

describe("calculateShipping", () => {
  it("quotes standard shipping converted into store currency", async () => {
    const quote = await calculateShipping(lines, gbDestination, gateway({ standard: 1000 }));
    expect(quote).toEqual({
      shippingMinor: 754,
      currency: "GBP",
      method: "standard",
      sourceMinor: 1000,
      sourceCurrency: "USD",
    });
  });

  it("rejects unsupported destinations", async () => {
    await expect(
      calculateShipping(lines, { country: "US" }, gateway({ standard: 1000 })),
    ).rejects.toMatchObject({ code: "unsupported_country" });
  });

  it("fails safely when Printify has no standard rate", async () => {
    await expect(
      calculateShipping(lines, gbDestination, gateway({ express: 2000 })),
    ).rejects.toMatchObject({ code: "shipping_unavailable" });
  });

  it("fails safely when Printify cannot be reached", async () => {
    const failing: ShippingGateway = {
      getShippingCosts: async () => {
        throw new Error("network down");
      },
    };
    await expect(calculateShipping(lines, gbDestination, failing)).rejects.toMatchObject({
      code: "shipping_unavailable",
    });
  });

  it("rejects an empty cart before quoting", async () => {
    await expect(
      calculateShipping([], gbDestination, gateway({ standard: 1000 })),
    ).rejects.toBeInstanceOf(CheckoutError);
  });

  it("caches identical quotes and avoids repeat API calls", async () => {
    let calls = 0;
    const counting: ShippingGateway = {
      getShippingCosts: async () => {
        calls += 1;
        return { standard: 1000 };
      },
    };
    await calculateShipping(lines, gbDestination, counting);
    await calculateShipping(lines, gbDestination, counting);
    expect(calls).toBe(1);
  });

  it("never reuses a quote for different checkout inputs", async () => {
    // The gateway echoes its inputs into the rate, so any incompatible cache
    // reuse shows up as the wrong price rather than only a missed API call.
    let calls = 0;
    const inputAware: ShippingGateway = {
      getShippingCosts: async (request) => {
        calls += 1;
        const zipSeed = request.address_to.zip.length * 10;
        const quantity = request.line_items.reduce((sum, item) => sum + item.quantity, 0);
        return { standard: 1000 + zipSeed + quantity };
      },
    };

    const first = await calculateShipping(lines, gbDestination, inputAware);
    expect(first.sourceMinor).toBe(1000 + "SW1A 2AA".length * 10 + 1);
    expect(calls).toBe(1);

    // Identical inputs are still served from the cache.
    await calculateShipping(lines, gbDestination, inputAware);
    expect(calls).toBe(1);

    const otherPostcode = await calculateShipping(
      lines,
      { ...gbDestination, postalCode: "M1 1AE" },
      inputAware,
    );
    expect(otherPostcode.sourceMinor).toBe(1000 + "M1 1AE".length * 10 + 1);
    expect(calls).toBe(2);

    await calculateShipping(
      lines,
      { country: "DE", city: "Berlin", postalCode: "10115" },
      inputAware,
    );
    expect(calls).toBe(3);

    const moreQuantity = await calculateShipping(
      [{ ...lines[0], quantity: 3 }],
      gbDestination,
      inputAware,
    );
    expect(moreQuantity.sourceMinor).toBe(1000 + "SW1A 2AA".length * 10 + 3);
    expect(calls).toBe(4);

    await calculateShipping(
      [{ ...lines[0], variantId: 12 }],
      gbDestination,
      inputAware,
    );
    expect(calls).toBe(5);

    const otherRegion = await calculateShipping(
      lines,
      { ...gbDestination, region: "Greater London" },
      inputAware,
    );
    expect(otherRegion.sourceMinor).toBe(1000 + "SW1A 2AA".length * 10 + 1);
    expect(calls).toBe(6);
  });
});
