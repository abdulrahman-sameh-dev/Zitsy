"use server";

import { revalidatePath } from "next/cache";

import { log } from "@/lib/log";

import { CartError } from "./errors";
import {
  addItem,
  clearCart,
  getOrCreateCartByTokenHash,
  removeItem,
  updateItem,
} from "./service";
import { ensureCartTokenHash } from "./session";
import { addItemSchema, removeItemSchema, updateItemSchema } from "./schemas";

type ActionResult = { ok: true } | { ok: false; error: string };

function toResult(err: unknown): ActionResult {
  if (err instanceof CartError) return { ok: false, error: err.message };
  log.error("cart action failed", { error: err });
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function owningCartId(): Promise<string> {
  const tokenHash = await ensureCartTokenHash();
  const cart = await getOrCreateCartByTokenHash(tokenHash);
  return cart.id;
}

function revalidateCart(): void {
  revalidatePath("/", "layout");
}

export async function addToCart(input: unknown): Promise<ActionResult> {
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid cart request." };
  try {
    await addItem(await owningCartId(), parsed.data);
    revalidateCart();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function updateCartItem(input: unknown): Promise<ActionResult> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid cart request." };
  try {
    await updateItem(await owningCartId(), parsed.data);
    revalidateCart();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function removeCartItem(input: unknown): Promise<ActionResult> {
  const parsed = removeItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid cart request." };
  try {
    await removeItem(await owningCartId(), parsed.data);
    revalidateCart();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}

export async function clearCartAction(): Promise<ActionResult> {
  try {
    await clearCart(await owningCartId());
    revalidateCart();
    return { ok: true };
  } catch (err) {
    return toResult(err);
  }
}