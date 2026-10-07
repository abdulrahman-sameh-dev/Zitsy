import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CartError } from "@/lib/cart/errors";
import { addItemSchema } from "@/lib/cart/schemas";
import {
  addItem,
  clearCart,
  getCartByTokenHash,
  getCartViewByTokenHash,
  getOrCreateCartByTokenHash,
  removeItem,
  updateItem,
} from "@/lib/cart/service";
import { db } from "@/lib/db/prisma";

let cartId: string;

async function createProduct(opts: {
  printifyId: string;
  slug: string;
  visible?: boolean;
  variants: Array<{
    printifyVariantId: number;
    priceMinor: number;
    isEnabled?: boolean;
    isAvailable?: boolean;
  }>;
}) {
  return db.product.create({
    data: {
      printifyId: opts.printifyId,
      title: `Product ${opts.printifyId}`,
      slug: opts.slug,
      currency: "GBP",
      visible: opts.visible ?? true,
      minPriceMinor: Math.min(...opts.variants.map((v) => v.priceMinor)),
      variants: {
        create: opts.variants.map((v, index) => ({
          printifyVariantId: v.printifyVariantId,
          title: `Variant ${v.printifyVariantId}`,
          priceMinor: v.priceMinor,
          currency: "GBP",
          isEnabled: v.isEnabled ?? true,
          isAvailable: v.isAvailable ?? true,
          isDefault: index === 0,
        })),
      },
    },
    include: { variants: true },
  });
}

let good: Awaited<ReturnType<typeof createProduct>>;
let other: Awaited<ReturnType<typeof createProduct>>;
let hidden: Awaited<ReturnType<typeof createProduct>>;

beforeAll(async () => {
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  await db.product.deleteMany();

  good = await createProduct({
    printifyId: "P-GOOD",
    slug: "good",
    variants: [
      { printifyVariantId: 1, priceMinor: 1000 },
      { printifyVariantId: 2, priceMinor: 1200 },
      { printifyVariantId: 3, priceMinor: 1300, isEnabled: false },
      { printifyVariantId: 4, priceMinor: 1400, isAvailable: false },
    ],
  });
  other = await createProduct({
    printifyId: "P-OTHER",
    slug: "other",
    variants: [{ printifyVariantId: 101, priceMinor: 2000 }],
  });
  hidden = await createProduct({
    printifyId: "P-HIDDEN",
    slug: "hidden",
    visible: false,
    variants: [{ printifyVariantId: 201, priceMinor: 3000 }],
  });
});

beforeEach(async () => {
  await db.cartItem.deleteMany();
  await db.cart.deleteMany();
  const cart = await db.cart.create({ data: { token: "cart-token-1" } });
  cartId = cart.id;

  const setVariant = (
    printifyVariantId: number,
    data: { priceMinor: number; isEnabled?: boolean; isAvailable?: boolean },
  ) =>
    db.productVariant.update({
      where: {
        productId_printifyVariantId: {
          productId: good.id,
          printifyVariantId,
        },
      },
      data,
    });
  await setVariant(1, { priceMinor: 1000, isEnabled: true, isAvailable: true });
  await setVariant(2, { priceMinor: 1200, isEnabled: true, isAvailable: true });
  await setVariant(3, { priceMinor: 1300, isEnabled: false, isAvailable: true });
  await setVariant(4, { priceMinor: 1400, isEnabled: true, isAvailable: false });
});

function variant(printifyVariantId: number) {
  return good.variants.find((v) => v.printifyVariantId === printifyVariantId)!;
}

describe("cart service — variant validation", () => {
  it("rejects an unknown variant", async () => {
    await expect(
      addItem(cartId, { productId: good.id, variantId: "missing", quantity: 1 }),
    ).rejects.toBeInstanceOf(CartError);
  });

  it("rejects a variant that belongs to a different product", async () => {
    await expect(
      addItem(cartId, {
        productId: other.id,
        variantId: variant(1).id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "variant_product_mismatch" });
  });

  it("rejects a hidden product", async () => {
    await expect(
      addItem(cartId, {
        productId: hidden.id,
        variantId: hidden.variants[0].id,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "product_unavailable" });
  });

  it("rejects disabled and unavailable variants", async () => {
    await expect(
      addItem(cartId, { productId: good.id, variantId: variant(3).id, quantity: 1 }),
    ).rejects.toMatchObject({ code: "variant_disabled" });
    await expect(
      addItem(cartId, { productId: good.id, variantId: variant(4).id, quantity: 1 }),
    ).rejects.toMatchObject({ code: "variant_unavailable" });
  });
});

describe("cart service — mutations", () => {
  it("stores the server-side price, not a client-supplied one", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    const item = await db.cartItem.findFirstOrThrow({ where: { cartId } });
    expect(item.unitPriceMinor).toBe(1000);
    expect(item.currency).toBe("GBP");
  });

  it("ignores money fields smuggled into the add request", async () => {
    const parsed = addItemSchema.parse({
      productId: good.id,
      variantId: variant(1).id,
      quantity: 1,
      priceMinor: 1,
      unitPriceMinor: 1,
      costMinor: 1,
      currency: "USD",
    });
    expect(parsed).toEqual({
      productId: good.id,
      variantId: variant(1).id,
      quantity: 1,
    });

    const tampered = { ...parsed, priceMinor: 1, unitPriceMinor: 1 };
    await addItem(cartId, tampered);
    const item = await db.cartItem.findFirstOrThrow({ where: { cartId } });
    expect(item.unitPriceMinor).toBe(1000);
    expect(item.currency).toBe("GBP");
  });

  it("merges repeated adds of the same variant", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 2 });
    const items = await db.cartItem.findMany({ where: { cartId } });
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(3);
  });

  it("caps the merged quantity at 99", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 99 });
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 5 });
    const item = await db.cartItem.findFirstOrThrow({ where: { cartId } });
    expect(item.quantity).toBe(99);
  });

  it("keeps distinct variants as separate lines", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    await addItem(cartId, { productId: good.id, variantId: variant(2).id, quantity: 1 });
    expect(await db.cartItem.count({ where: { cartId } })).toBe(2);
  });

  it("updates quantity and refreshes the recorded price", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    const item = await db.cartItem.findFirstOrThrow({ where: { cartId } });

    await db.productVariant.update({
      where: { id: variant(1).id },
      data: { priceMinor: 1100 },
    });
    await updateItem(cartId, { itemId: item.id, quantity: 4 });

    const updated = await db.cartItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.quantity).toBe(4);
    expect(updated.unitPriceMinor).toBe(1100);
  });

  it("removes a line", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    const item = await db.cartItem.findFirstOrThrow({ where: { cartId } });
    await removeItem(cartId, { itemId: item.id });
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0);
  });

  it("clears the cart", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    await addItem(cartId, { productId: good.id, variantId: variant(2).id, quantity: 1 });
    await clearCart(cartId);
    expect(await db.cartItem.count({ where: { cartId } })).toBe(0);
  });
});

describe("cart service — ownership isolation", () => {
  it("scopes update and remove to the owning cart", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    const item = await db.cartItem.findFirstOrThrow({ where: { cartId } });

    const otherCart = await db.cart.create({ data: { token: "cart-token-2" } });

    await expect(
      updateItem(otherCart.id, { itemId: item.id, quantity: 5 }),
    ).rejects.toMatchObject({ code: "item_not_found" });
    await expect(
      removeItem(otherCart.id, { itemId: item.id }),
    ).rejects.toMatchObject({ code: "item_not_found" });

    expect(await db.cartItem.count({ where: { cartId } })).toBe(1);
  });

  it("resolves carts only by their hashed token", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    const found = await getCartByTokenHash("cart-token-1");
    expect(found?.id).toBe(cartId);
    expect(await getCartByTokenHash("no-such-token")).toBeNull();

    const view = await getCartViewByTokenHash("cart-token-1");
    expect(view.totalQuantity).toBe(1);
  });

  it("does not create a cart for an unknown token on read", async () => {
    expect(await getCartByTokenHash("brand-new")).toBeNull();
    const created = await getOrCreateCartByTokenHash("brand-new");
    expect(created.token).toBe("brand-new");
    expect(await db.cart.count({ where: { token: "brand-new" } })).toBe(1);
  });
});

describe("cart service — stale catalog data", () => {
  it("surfaces a disabled variant as unavailable and blocks checkout", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 1 });
    await db.productVariant.update({
      where: { id: variant(1).id },
      data: { isAvailable: false },
    });
    const view = await getCartViewByTokenHash("cart-token-1");
    expect(view.lines[0].available).toBe(false);
    expect(view.lines[0].unavailableReason).toBe("variant_unavailable");
    expect(view.canCheckout).toBe(false);
    expect(view.subtotalMinor).toBe(0);
  });

  it("reflects a price increase without silently charging the old price", async () => {
    await addItem(cartId, { productId: good.id, variantId: variant(1).id, quantity: 2 });
    await db.productVariant.update({
      where: { id: variant(1).id },
      data: { priceMinor: 1500 },
    });
    const view = await getCartViewByTokenHash("cart-token-1");
    expect(view.lines[0].priceChanged).toBe(true);
    expect(view.lines[0].lineTotalMinor).toBe(3000);
    expect(view.subtotalMinor).toBe(3000);
  });
});