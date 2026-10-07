import { Prisma } from "@/generated/prisma/client";

import { storeCurrency } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";

import { CartError } from "./errors";
import {
  MAX_CART_LINES,
  MAX_ITEM_QUANTITY,
  type AddItemInput,
  type RemoveItemInput,
  type UpdateItemInput,
} from "./schemas";
import { buildCartView, type CartView } from "./view";

export const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      variant: {
        include: {
          product: {
            include: {
              images: { orderBy: { position: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.CartInclude;

export type CartWithItems = Prisma.CartGetPayload<{
  include: typeof cartInclude;
}>;

/** Find a cart handle without creating one (safe for reads). */
export async function getCartByTokenHash(
  tokenHash: string,
): Promise<CartWithItems | null> {
  return db.cart.findUnique({ where: { token: tokenHash }, include: cartInclude });
}

/** Find or lazily create the cart row for a token hash (writes). */
export async function getOrCreateCartByTokenHash(
  tokenHash: string,
): Promise<CartWithItems> {
  const existing = await getCartByTokenHash(tokenHash);
  if (existing) return existing;
  try {
    await db.cart.create({ data: { token: tokenHash } });
  } catch (err) {
    // Concurrent create on the unique token — fall through to re-read.
    if (
      !(err instanceof Prisma.PrismaClientKnownRequestError) ||
      err.code !== "P2002"
    ) {
      throw err;
    }
  }
  return db.cart.findUniqueOrThrow({
    where: { token: tokenHash },
    include: cartInclude,
  });
}

export async function getCartViewByTokenHash(
  tokenHash: string,
): Promise<CartView> {
  const cart = await getCartByTokenHash(tokenHash);
  return buildCartView(cart, storeCurrency());
}

/**
 * Add a variant to a cart after full server-side validation. The client supplies
 * ids and quantity only; price, titles, sku and availability are read from the DB.
 */
export async function addItem(
  cartId: string,
  input: AddItemInput,
): Promise<void> {
  const variant = await db.productVariant.findUnique({
    where: { id: input.variantId },
    include: { product: { select: { id: true, visible: true } } },
  });

  if (!variant) throw new CartError("variant_not_found");
  if (variant.productId !== input.productId) {
    throw new CartError("variant_product_mismatch");
  }
  if (!variant.product.visible) throw new CartError("product_unavailable");
  if (!variant.isEnabled) throw new CartError("variant_disabled");
  if (!variant.isAvailable) throw new CartError("variant_unavailable");

  await db.$transaction(async (tx) => {
    const existing = await tx.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId: variant.id } },
    });

    if (existing) {
      await tx.cartItem.update({
        where: { id: existing.id },
        data: {
          quantity: Math.min(
            existing.quantity + input.quantity,
            MAX_ITEM_QUANTITY,
          ),
          unitPriceMinor: variant.priceMinor,
          currency: variant.currency,
        },
      });
      return;
    }

    const lineCount = await tx.cartItem.count({ where: { cartId } });
    if (lineCount >= MAX_CART_LINES) throw new CartError("cart_full");

    await tx.cartItem.create({
      data: {
        cartId,
        productId: variant.productId,
        variantId: variant.id,
        quantity: input.quantity,
        unitPriceMinor: variant.priceMinor,
        currency: variant.currency,
      },
    });
  });
}

/** Set an existing line's quantity, refreshing the recorded price. */
export async function updateItem(
  cartId: string,
  input: UpdateItemInput,
): Promise<void> {
  const item = await db.cartItem.findFirst({
    where: { id: input.itemId, cartId },
    include: { variant: true },
  });
  if (!item) throw new CartError("item_not_found");

  await db.cartItem.update({
    where: { id: item.id },
    data: {
      quantity: input.quantity,
      unitPriceMinor: item.variant.priceMinor,
      currency: item.variant.currency,
    },
  });
}

/** Remove a line, scoped to the owning cart. */
export async function removeItem(
  cartId: string,
  input: RemoveItemInput,
): Promise<void> {
  const result = await db.cartItem.deleteMany({
    where: { id: input.itemId, cartId },
  });
  if (result.count === 0) throw new CartError("item_not_found");
}

/** Empty a cart. */
export async function clearCart(cartId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { cartId } });
}