import { createHmac, timingSafeEqual } from "node:crypto";

import type { PrintifyClient } from "./client";

export const PRINTIFY_WEBHOOK_TOPICS = [
  "product:created",
  "product:updated",
  "product:deleted",
  "order:created",
  "order:updated",
  "order:sent-to-production",
  "order:shipment:created",
  "order:shipment:delivered",
] as const;

const SIGNATURE_PREFIX = "sha256=";

/**
 * Verify the Printify webhook signature. Delivered in the `X-Pfy-Signature`
 * header as `sha256=<hex HMAC-SHA256 over the raw request body>`.
 */
export function verifyPrintifySignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }
  const provided = signatureHeader.slice(SIGNATURE_PREFIX.length);
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest();
  const expectedBuf = Buffer.from(expected);

  let providedBuf: Buffer;
  try {
    providedBuf = Buffer.from(provided, "hex");
  } catch {
    return false;
  }
  if (providedBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(providedBuf, expectedBuf);
}

/**
 * Ensure subscriptions exist for all required topics and point at `url`.
 * Creates missing webhooks and repoints ones with a stale URL.
 */
export async function ensurePrintifyWebhooks(
  client: PrintifyClient,
  url: string,
): Promise<{ created: string[]; updated: string[] }> {
  const existing = await client.listWebhooks();
  const byTopic = new Map(existing.map((hook) => [hook.topic, hook]));
  const created: string[] = [];
  const updated: string[] = [];

  for (const topic of PRINTIFY_WEBHOOK_TOPICS) {
    const hook = byTopic.get(topic);
    if (!hook) {
      await client.createWebhook({ topic, url });
      created.push(topic);
    } else if (hook.url !== url) {
      await client.updateWebhook(hook.id, url);
      updated.push(topic);
    }
  }

  return { created, updated };
}