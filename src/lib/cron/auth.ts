import { timingSafeEqual } from "node:crypto";

import { cronSecret } from "@/lib/config/env";

export type CronAuthResult =
  | { ok: true }
  | { ok: false; status: 503 | 401; message: string };

/**
 * Bearer check for the scheduled endpoints. Vercel Cron sends
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * An unset secret is a misconfiguration (503, fail closed) rather than an
 * open endpoint, and the comparison is length-checked then timing-safe.
 */
export function verifyCronAuth(request: Request): CronAuthResult {
  const secret = cronSecret();
  if (!secret) {
    return { ok: false, status: 503, message: "cron is not configured" };
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const provided = Buffer.from(request.headers.get("authorization") ?? "");

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, status: 401, message: "unauthorized" };
  }
  return { ok: true };
}
