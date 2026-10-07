/**
 * Minimal in-memory fixed-window limiter for the public lookup and contact
 * endpoints (§13, §15). No Redis, no queue — one instance, one process.
 *
 * Known limitation: counters are per server process, so a multi-instance
 * deployment would allow `limit × instances` attempts per window. Documented
 * in docs/ARCHITECTURE.md.
 */
interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_BUCKETS = 5000;

function prune(now: number): void {
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

/** Returns true when the call is allowed, false when the limit is exhausted. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (buckets.size >= MAX_BUCKETS) prune(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

/** Test hook — clears all buckets. */
export function resetRateLimits(): void {
  buckets.clear();
}
