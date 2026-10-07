import { randomUUID } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import {
  confirmCapturedPayment,
  captureOrderPayment,
  findOrderIdByPaypalOrderId,
  markPaymentFailed,
} from "@/lib/checkout/service";
import { CheckoutError } from "@/lib/checkout/errors";
import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";
import { PAYPAL_PROVIDER } from "@/lib/paypal/config";
import type {
  PaypalCapture,
  PaypalGateway,
  PaypalMoney,
  PaypalWebhookEvent,
} from "@/lib/paypal/types";

export type PaypalWebhookOutcome =
  | "processed"
  | "ignored"
  | "rejected"
  | "duplicate";

/** Terminal checkout failures: PayPal retrying will not help, so don't 5xx. */
const TERMINAL_CODES = new Set([
  "amount_mismatch",
  "currency_mismatch",
  "payment_reference_mismatch",
  "payment_not_payable",
  "order_not_found",
]);

function isTerminal(err: unknown): err is CheckoutError {
  return err instanceof CheckoutError && TERMINAL_CODES.has(err.code);
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function resourceOf(event: PaypalWebhookEvent): Record<string, unknown> | null {
  const resource = event.resource;
  return resource && typeof resource === "object" ? resource : null;
}

/** The PayPal order id a capture event belongs to. */
function paypalOrderIdFor(event: PaypalWebhookEvent): string | null {
  const resource = resourceOf(event);
  if (!resource) return null;
  if (event.event_type.startsWith("CHECKOUT.ORDER")) {
    return typeof resource.id === "string" ? resource.id : null;
  }
  const supplementary = resource.supplementary_data as
    | { related_ids?: { order_id?: string } }
    | undefined;
  return supplementary?.related_ids?.order_id ?? null;
}

function captureFromResource(resource: Record<string, unknown>): PaypalCapture {
  return {
    id: String(resource.id ?? ""),
    status: String(resource.status ?? ""),
    amount: resource.amount as PaypalMoney | undefined,
    create_time:
      typeof resource.create_time === "string" ? resource.create_time : undefined,
    update_time:
      typeof resource.update_time === "string" ? resource.update_time : undefined,
    custom_id:
      typeof resource.custom_id === "string" ? resource.custom_id : undefined,
  };
}

async function dispatch(
  event: PaypalWebhookEvent,
  paypal: PaypalGateway,
): Promise<PaypalWebhookOutcome> {
  switch (event.event_type) {
    case "CHECKOUT.ORDER.APPROVED": {
      const paypalOrderId = paypalOrderIdFor(event);
      const orderId = paypalOrderId
        ? await findOrderIdByPaypalOrderId(paypalOrderId)
        : null;
      if (!orderId) return "ignored";
      await captureOrderPayment(orderId, paypal);
      return "processed";
    }

    case "PAYMENT.CAPTURE.COMPLETED": {
      const paypalOrderId = paypalOrderIdFor(event);
      const orderId = paypalOrderId
        ? await findOrderIdByPaypalOrderId(paypalOrderId)
        : null;
      const resource = resourceOf(event);
      if (!orderId || !resource) return "ignored";
      await confirmCapturedPayment(orderId, captureFromResource(resource));
      return "processed";
    }

    case "PAYMENT.CAPTURE.DENIED": {
      const paypalOrderId = paypalOrderIdFor(event);
      const orderId = paypalOrderId
        ? await findOrderIdByPaypalOrderId(paypalOrderId)
        : null;
      if (!orderId) return "ignored";
      await markPaymentFailed(orderId);
      return "processed";
    }

    default:
      return "ignored";
  }
}

/**
 * Record and process a verified PayPal webhook idempotently. Returns the
 * outcome; rethrows transient failures so the route can 5xx and PayPal retries.
 */
export async function processPaypalWebhook(
  payload: PaypalWebhookEvent,
  paypal: PaypalGateway,
): Promise<PaypalWebhookOutcome> {
  const type = payload.event_type ?? "unknown";
  const eventId = payload.id ?? `${type}:${randomUUID()}`;

  const record = await db.webhookEvent.upsert({
    where: {
      provider_eventId: { provider: PAYPAL_PROVIDER, eventId },
    },
    create: {
      provider: PAYPAL_PROVIDER,
      eventId,
      type,
      payload: payload as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });

  if (
    record.status === "processed" ||
    record.status === "ignored" ||
    record.status === "rejected"
  ) {
    return "duplicate";
  }

  try {
    const outcome = await dispatch(payload, paypal);
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { status: outcome, processedAt: new Date() },
    });
    return outcome;
  } catch (err) {
    if (isTerminal(err)) {
      await db.webhookEvent.update({
        where: { id: record.id },
        data: { status: "rejected", error: err.code, processedAt: new Date() },
      });
      log.warn("paypal webhook rejected", { eventId, type, code: err.code });
      return "rejected";
    }
    await db.webhookEvent.update({
      where: { id: record.id },
      data: { status: "error", error: message(err).slice(0, 2000) },
    });
    log.error("paypal webhook processing failed", { eventId, type, err });
    throw err;
  }
}