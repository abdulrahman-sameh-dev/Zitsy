"use server";

import { headers } from "next/headers";

import { getClientIp } from "@/lib/http";
import { log } from "@/lib/log";
import { rateLimit } from "@/lib/rate-limit";

import { ensureTrackingToken, lookupOrderByNumberAndEmail } from "./tracking";

export type LookupOrderResult =
  | { ok: true; token: string }
  | { ok: false; error: string };

const LOOKUP_LIMIT = 10;
const LOOKUP_WINDOW_MS = 60_000;

/**
 * One message covers every failure mode: wrong number, wrong email, unknown
 * order and malformed input must be indistinguishable (§11) so the endpoint
 * cannot be used to enumerate orders.
 */
const GENERIC_FAILURE =
  "We couldn't find an order matching those details. Check the order number from your confirmation email and the email address you used at checkout.";

export async function lookupOrderAction(input: {
  orderNumber?: unknown;
  email?: unknown;
}): Promise<LookupOrderResult> {
  const ip = getClientIp(await headers());
  if (!rateLimit(`track:${ip}`, LOOKUP_LIMIT, LOOKUP_WINDOW_MS)) {
    return {
      ok: false,
      error: "Too many attempts. Please wait a moment and try again.",
    };
  }

  const orderNumber = typeof input.orderNumber === "string" ? input.orderNumber : "";
  const email = typeof input.email === "string" ? input.email : "";
  if (!orderNumber || !email) return { ok: false, error: GENERIC_FAILURE };

  try {
    const order = await lookupOrderByNumberAndEmail(orderNumber, email);
    if (!order) return { ok: false, error: GENERIC_FAILURE };

    const token = await ensureTrackingToken(order.id);
    if (!token) return { ok: false, error: GENERIC_FAILURE };
    return { ok: true, token };
  } catch (err) {
    log.error("order lookup failed", { err });
    return { ok: false, error: GENERIC_FAILURE };
  }
}
