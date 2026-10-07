import { randomUUID } from "node:crypto";

import { db } from "@/lib/db/prisma";
import { emailConfig } from "@/lib/email/config";
import { sanitizeEmailError } from "@/lib/email/errors";
import { sendTransactionalEmail } from "@/lib/email/service";
import { formatDate } from "@/lib/email/render";
import {
  renderSupportMessageEmail,
  renderSupportReceivedEmail,
} from "@/lib/email/templates/support-message";
import { fulfillmentLabel } from "@/lib/fulfillment/status";
import { log } from "@/lib/log";
import { formatMoney } from "@/lib/money";
import { normalizeOrderNumber } from "@/lib/orders/tracking";
import { rateLimit } from "@/lib/rate-limit";

import {
  contactCategoryLabel,
  parseContact,
  sanitizeLine,
  sanitizeText,
} from "./schemas";

export interface ContactContext {
  ip: string;
}

export type ContactResult = { ok: true } | { ok: false; error: string };

/** Per-IP allowance: enough for a real customer, useless for spam runs. */
const CONTACT_LIMIT = 5;
const CONTACT_WINDOW_MS = 10 * 60_000;

const GENERIC_FAILURE =
  "We couldn't send your message right now. Please try again in a few minutes.";

/**
 * §16 — optional verified context for the store email. A number that does not
 * exist simply produces no summary; the store is never told why, and the
 * customer is never told anything either way.
 */
async function buildOrderSummary(orderNumberInput: string): Promise<string[] | null> {
  const orderNumber = normalizeOrderNumber(orderNumberInput);
  if (!orderNumber) return null;

  const order = await db.order.findFirst({
    where: { orderNumber },
    select: {
      orderNumber: true,
      paidAt: true,
      createdAt: true,
      totalMinor: true,
      currency: true,
      fulfillmentStatus: true,
      trackingCarrier: true,
      trackingNumber: true,
    },
  });
  if (!order) return null;

  const summary = [
    `Order ${order.orderNumber}`,
    `Placed: ${formatDate(order.paidAt ?? order.createdAt)}`,
    `Fulfillment: ${fulfillmentLabel(order.fulfillmentStatus)}`,
    `Total: ${formatMoney(order.totalMinor, order.currency)}`,
  ];
  if (order.trackingNumber) {
    const carrier = order.trackingCarrier ? `${order.trackingCarrier} ` : "";
    summary.push(`Tracking: ${carrier}${order.trackingNumber}`);
  }
  return summary;
}

/**
 * §14–§17 — validate, sanitise, notify the store, then confirm to the
 * customer. Never throws; failures surface as a generic message.
 */
export async function submitContactMessage(
  input: unknown,
  context: ContactContext,
): Promise<ContactResult> {
  if (!rateLimit(`contact:${context.ip}`, CONTACT_LIMIT, CONTACT_WINDOW_MS)) {
    return {
      ok: false,
      error:
        "You've sent several messages recently. Please wait a little while and try again.",
    };
  }

  const parsed = parseContact(input);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  // Honeypot: humans never see this field. Pretend success, send nothing.
  if (parsed.data.website) {
    log.warn("contact message dropped: honeypot field was filled");
    return { ok: true };
  }

  const cfg = emailConfig();
  if (!cfg.enabled || !cfg.supportEnabled) {
    log.error("contact message rejected: store email is not configured");
    return { ok: false, error: GENERIC_FAILURE };
  }

  const name = sanitizeLine(parsed.data.name);
  const email = parsed.data.email;
  const message = sanitizeText(parsed.data.message);
  const category = contactCategoryLabel(parsed.data.category);
  const orderNumber = parsed.data.orderNumber ? sanitizeLine(parsed.data.orderNumber) : "";
  const submittedAt = new Date();
  const orderSummary = orderNumber ? await buildOrderSummary(orderNumber) : null;

  try {
    const storeEmail = await renderSupportMessageEmail({
      category,
      customerName: name,
      customerEmail: email,
      orderNumber: orderNumber || null,
      message,
      submittedAt,
      orderSummary,
    });

    const outcome = await sendTransactionalEmail({
      kind: "support-message",
      dedupeKey: `support-message:${randomUUID()}`,
      to: cfg.supportRecipient,
      subject: storeEmail.subject,
      html: storeEmail.html,
      text: storeEmail.text,
      replyTo: email,
    });

    if (outcome.status !== "sent") return { ok: false, error: GENERIC_FAILURE };
  } catch (err) {
    log.error("contact message failed", { error: sanitizeEmailError(err) });
    return { ok: false, error: GENERIC_FAILURE };
  }

  // §17 — best-effort receipt for the customer; never fails the submission.
  try {
    const confirmation = await renderSupportReceivedEmail({
      category,
      customerName: name,
      orderNumber: orderNumber || null,
    });
    await sendTransactionalEmail({
      kind: "support-received",
      dedupeKey: `support-received:${randomUUID()}`,
      to: email,
      subject: confirmation.subject,
      html: confirmation.html,
      text: confirmation.text,
    });
  } catch (err) {
    log.warn("support confirmation failed", { error: sanitizeEmailError(err) });
  }

  return { ok: true };
}
