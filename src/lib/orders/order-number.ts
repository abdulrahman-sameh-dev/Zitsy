import { randomBytes } from "node:crypto";

/**
 * Human-readable, unguessable-enough order reference, e.g. `ZS-3F9K2Q7A`.
 * Uniqueness is still enforced by the DB; callers retry on conflict.
 */
export function generateOrderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (const byte of bytes) {
    out += alphabet[byte % alphabet.length];
  }
  return `ZS-${out}`;
}