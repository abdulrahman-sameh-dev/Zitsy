import { beforeAll, describe, expect, it, vi } from "vitest";

import { getCartViewByTokenHash } from "@/lib/cart/service";
import { syncCatalog } from "@/lib/catalog/sync";
import { db } from "@/lib/db/prisma";
import { pricingFromCost } from "@/lib/pricing";
import { PrintifyClient } from "@/lib/printify/client";
import type { PrintifyProduct } from "@/lib/printify/types";

let current: PrintifyProduct;

const client = () => new PrintifyClient({ token: "tok", shopId: "shop-1" });

beforeAll(async () => {
  vi.stubGlobal("fetch", async () =>
    new Response(
      JSON.stringify({ data: [current], next_page_url: null }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );

  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.product.deleteMany();
  await db.catalogSyncRun.deleteMany();

  current = {
    id: "PRD-RESILIENT",
    title: "Resilient Mug",
    description: "survives syncs",
    tags: ["Mugs"],
    visible: true,
    blueprint_id: 68,
    print_provider_id: 9,
    options: [
      { name: "Sizes", type: "size", values: [{ id: 1, title: "11oz" }] },
    ],
    variants: [
      {
        id: 9001,
        sku: "R-11",
        cost: 860,
        price: 860,
        is_enabled: true,
        is_default: true,
        is_available: true,
        options: [1],
      },
    ],
    images: [{ src: "https://images-api.printify.com/r.jpg", is_default: true }],
  };

  await syncCatalog(client());
});

describe("catalog resync keeps cart references stable", () => {
  it("preserves the variant cuid and the cart line across resyncs", async () => {
    const product = await db.product.findUniqueOrThrow({
      where: { printifyId: "PRD-RESILIENT" },
    });
    const variant = await db.productVariant.findFirstOrThrow({
      where: { productId: product.id },
    });
    const variantIdBefore = variant.id;

    const cart = await db.cart.create({ data: { token: "resilience-token" } });
    await db.cartItem.create({
      data: {
        cartId: cart.id,
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        unitPriceMinor: 860,
        currency: "GBP",
      },
    });

    // Re-sync with a price change for the same variant id.
    current = {
      ...current,
      variants: [{ ...current.variants![0], cost: 950 }],
    };
    await syncCatalog(client());

    const variantAfter = await db.productVariant.findFirstOrThrow({
      where: { productId: product.id },
    });
    expect(variantAfter.id).toBe(variantIdBefore);
    expect(variantAfter.priceMinor).toBe(pricingFromCost(950)!.priceMinor);

    const view = await getCartViewByTokenHash("resilience-token");
    expect(view.totalQuantity).toBe(1);
    expect(view.lines[0].variantId).toBe(variantIdBefore);
    expect(view.lines[0].unitPriceMinor).toBe(pricingFromCost(950)!.priceMinor);
    expect(view.lines[0].priceChanged).toBe(true);

    // Now drop the variant entirely from Printify.
    current = { ...current, variants: [] };
    await syncCatalog(client());

    const stillThere = await db.cartItem.count({ where: { cartId: cart.id } });
    expect(stillThere).toBe(1);

    const staleView = await getCartViewByTokenHash("resilience-token");
    expect(staleView.lines[0].available).toBe(false);
    expect(staleView.canCheckout).toBe(false);
  });
});