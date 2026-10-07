import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

import { serverEnv } from "@/lib/config/env";

const ORDER_COOKIE = "zitsy_order";
/** Long enough for a checkout session, short enough to bound replay. */
const MAX_AGE_SECONDS = 60 * 60 * 3;

function sign(payload: string): string {
  return createHmac("sha256", serverEnv.AUTH_SECRET)
    .update(payload)
    .digest("base64url");
}

/** Stateless signed reference: `<orderId>.<expiry>.<hmac>`. No DB column needed. */
export function createOrderRef(orderId: string): string {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${orderId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

/** Returns the order id if the signed reference is authentic and unexpired. */
export function verifyOrderRef(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [orderId, expiryRaw, signature] = parts;
  if (!orderId || !expiryRaw || !signature) return null;

  const expected = Buffer.from(sign(`${orderId}.${expiryRaw}`));
  const provided = Buffer.from(signature);
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;

  const expiry = Number(expiryRaw);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return null;
  return orderId;
}

export async function setOrderRefCookie(orderId: string): Promise<void> {
  const store = await cookies();
  store.set(ORDER_COOKIE, createOrderRef(orderId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** The order id this browser is allowed to act on, if any. */
export async function readOrderRef(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(ORDER_COOKIE)?.value;
  return value ? verifyOrderRef(value) : null;
}

export async function clearOrderRefCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ORDER_COOKIE);
}