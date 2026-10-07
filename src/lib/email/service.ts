import { Prisma } from "@/generated/prisma/client";

import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";

import { getEmailTransport, type EmailTransport } from "./client";
import { emailConfig } from "./config";
import { sanitizeEmailError } from "./errors";

export type EmailKind =
  | "order-confirmed"
  | "order-submitted"
  | "order-shipped"
  | "order-delivered"
  | "admin-new-order"
  | "support-message"
  | "support-received";

/** The five order-event kinds that carry a deterministic key. */
export type OrderEmailKind =
  | "order-confirmed"
  | "order-submitted"
  | "order-shipped"
  | "order-delivered"
  | "admin-new-order";

/** `order-confirmed:{orderId}` — stable across retries, webhooks and replays. */
export function orderEmailKey(kind: OrderEmailKind, orderId: string): string {
  return `${kind}:${orderId}`;
}

export interface TransactionalEmailInput {
  kind: EmailKind;
  dedupeKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type EmailSendStatus = "sent" | "duplicate" | "skipped" | "failed";

export interface EmailSendOutcome {
  status: EmailSendStatus;
}

export interface SendEmailDeps {
  transport?: EmailTransport;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `jane@example.com` -> `j***@example.com` for logs only. */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "[redacted]";
  return `${email[0]}***${email.slice(at)}`;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/**
 * Claim the `EmailLog` row identified by `dedupeKey`.
 *
 * Returns the row id when this caller owns the send, or null when another
 * attempt already owns it (or already sent it). A row left in `failed` may be
 * reclaimed so a genuine retry can run — nothing else ever sends twice.
 */
async function claimDedupeKey(
  input: TransactionalEmailInput,
): Promise<{ rowId: string } | null> {
  try {
    const row = await db.emailLog.create({
      data: {
        kind: input.kind,
        recipient: input.to,
        subject: input.subject,
        status: "sending",
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    });
    return { rowId: row.id };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;

    const existing = await db.emailLog.findUnique({
      where: { dedupeKey: input.dedupeKey },
      select: { id: true, status: true },
    });
    if (!existing) return null;
    if (existing.status !== "failed") return null;

    const reclaimed = await db.emailLog.updateMany({
      where: { id: existing.id, status: "failed" },
      data: { status: "sending", recipient: input.to, subject: input.subject, error: null },
    });
    return reclaimed.count === 1 ? { rowId: existing.id } : null;
  }
}

/**
 * The single door every outbound email goes through (§2, §8, §9).
 *
 * Guarantees:
 * - never throws — an email failure can never roll back a payment, fail a PAID
 *   order or cancel a Printify order;
 * - at most one accepted send per `dedupeKey` (unique `EmailLog` row plus the
 *   Resend `Idempotency-Key` header);
 * - skips silently (with a log line) when Resend is not configured, instead of
 *   crashing a checkout or webhook;
 * - never logs or stores credentials.
 */
export async function sendTransactionalEmail(
  input: TransactionalEmailInput,
  deps: SendEmailDeps = {},
): Promise<EmailSendOutcome> {
  const cfg = emailConfig();

  if (!cfg.enabled) {
    log.warn("email skipped: Resend is not configured", {
      kind: input.kind,
      dedupeKey: input.dedupeKey,
    });
    return { status: "skipped" };
  }
  if (!EMAIL_PATTERN.test(input.to)) {
    log.error("email skipped: recipient is not a valid address", {
      kind: input.kind,
      dedupeKey: input.dedupeKey,
    });
    return { status: "skipped" };
  }

  let claim: { rowId: string } | null;
  try {
    claim = await claimDedupeKey(input);
  } catch (err) {
    log.error("email log claim failed", {
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      err: sanitizeEmailError(err),
    });
    return { status: "failed" };
  }

  if (!claim) {
    log.info("email skipped: already sent or in flight", {
      kind: input.kind,
      dedupeKey: input.dedupeKey,
    });
    return { status: "duplicate" };
  }

  const transport = deps.transport ?? getEmailTransport();

  try {
    const { id } = await transport.send(
      {
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      },
      { idempotencyKey: input.dedupeKey },
    );
    await db.emailLog.update({
      where: { id: claim.rowId },
      data: { status: "sent", error: null },
    });
    log.info("email sent", {
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      to: maskEmail(input.to),
      messageId: id,
    });
    return { status: "sent" };
  } catch (err) {
    const message = sanitizeEmailError(err);
    try {
      await db.emailLog.update({
        where: { id: claim.rowId },
        data: { status: "failed", error: message },
      });
    } catch (logErr) {
      log.error("email log update failed", {
        kind: input.kind,
        err: sanitizeEmailError(logErr),
      });
    }
    log.error("email send failed", {
      kind: input.kind,
      dedupeKey: input.dedupeKey,
      to: maskEmail(input.to),
      error: message,
    });
    return { status: "failed" };
  }
}
