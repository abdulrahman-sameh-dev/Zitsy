"use server";

import { revalidatePath } from "next/cache";

import { getCartByTokenHash } from "@/lib/cart/service";
import { readCartTokenHash } from "@/lib/cart/session";
import { log } from "@/lib/log";
import { getPayPalClient } from "@/lib/paypal/client";
import { isPaypalConfigured } from "@/lib/paypal/config";

import { CheckoutError } from "./errors";
import { customerSchema } from "./schemas";
import {
  beginCheckout,
  captureOrderPayment,
  quoteCheckout,
} from "./service";
import { readOrderRef, setOrderRefCookie } from "./session";

export type BeginCheckoutActionResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: string;
      paypalOrderId: string;
      subtotalMinor: number;
      shippingMinor: number;
      totalMinor: number;
      currency: string;
    }
  | { ok: false; error: string };

function toMessage(err: unknown): string {
  if (err instanceof CheckoutError) return err.userMessage;
  if (err instanceof Error && err.message.startsWith("PayPal is not configured")) {
    return "Payment is temporarily unavailable. Please try again shortly.";
  }
  log.error("checkout action failed", { error: err });
  return "Something went wrong. Please try again.";
}

/** Validate the customer, reprice the cart server-side, and create a PayPal order. */
export async function beginCheckoutAction(
  input: unknown,
): Promise<BeginCheckoutActionResult> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Please check your details." };
  }

  // Fail before creating a local order when payments are not configured.
  if (!isPaypalConfigured()) {
    return {
      ok: false,
      error: "Payment is temporarily unavailable. Please try again shortly.",
    };
  }

  const tokenHash = await readCartTokenHash();
  const cart = tokenHash ? await getCartByTokenHash(tokenHash) : null;
  if (!cart) return { ok: false, error: "Your cart is empty." };

  try {
    const result = await beginCheckout(
      {
        cartId: cart.id,
        customer: parsed.data,
        existingOrderId: await readOrderRef(),
      },
      getPayPalClient(),
    );
    await setOrderRefCookie(result.orderId);
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export type QuoteCheckoutActionResult =
  | {
      ok: true;
      subtotalMinor: number;
      shippingMinor: number;
      totalMinor: number;
      currency: string;
    }
  | { ok: false; error: string };

/**
 * Recompute a server-authoritative quote (subtotal + real Printify shipping +
 * total) for the current cart and delivery address. Read-only: never creates an
 * order or contacts PayPal.
 */
export async function quoteCheckoutAction(
  input: unknown,
): Promise<QuoteCheckoutActionResult> {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first?.message ?? "Please check your details." };
  }

  const tokenHash = await readCartTokenHash();
  const cart = tokenHash ? await getCartByTokenHash(tokenHash) : null;
  if (!cart) return { ok: false, error: "Your cart is empty." };

  try {
    const quote = await quoteCheckout(cart.id, parsed.data);
    return {
      ok: true,
      subtotalMinor: quote.subtotalMinor,
      shippingMinor: quote.shippingMinor,
      totalMinor: quote.totalMinor,
      currency: quote.currency,
    };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}

export type CaptureCheckoutActionResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

/** Capture and verify payment for the order owned by this browser. */
export async function captureCheckoutAction(): Promise<CaptureCheckoutActionResult> {
  const orderId = await readOrderRef();
  if (!orderId) {
    return { ok: false, error: "We could not find your checkout session." };
  }
  try {
    await captureOrderPayment(orderId, getPayPalClient());
    revalidatePath("/", "layout");
    return { ok: true, orderId };
  } catch (err) {
    return { ok: false, error: toMessage(err) };
  }
}