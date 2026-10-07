import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

/** Browser holder for the guest cart. The raw token never touches the DB. */
const CART_COOKIE = "zitsy_cart";
const TOKEN_BYTES = 32;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Only the hash of the token is persisted, so a DB leak cannot impersonate a cart. */
export function hashCartToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function newCartToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Read the current cart handle (hashed) in a Server Component. Never creates. */
export async function readCartTokenHash(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(CART_COOKIE)?.value;
  return token ? hashCartToken(token) : null;
}

/**
 * Ensure a cart cookie exists and return its hash. Only valid inside a Server
 * Action or Route Handler (where cookies can be written).
 */
export async function ensureCartTokenHash(): Promise<string> {
  const store = await cookies();
  const existing = store.get(CART_COOKIE)?.value;
  if (existing) return hashCartToken(existing);

  const token = newCartToken();
  store.set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return hashCartToken(token);
}