import { beforeEach, describe, expect, it } from "vitest";

import { integrations, serverEnv } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import { sanitizeEmailError } from "@/lib/email/errors";
import {
  maskEmail,
  orderEmailKey,
  sendTransactionalEmail,
  type TransactionalEmailInput,
} from "@/lib/email/service";

import { fakeEmail, failingEmail } from "./fake-email";

beforeEach(async () => {
  await db.emailLog.deleteMany();
});

const INPUT: TransactionalEmailInput = {
  kind: "order-confirmed",
  dedupeKey: "order-confirmed:order-1",
  to: "buyer@example.com",
  subject: "Your Zitsy order is confirmed",
  html: "<p>Thanks for your order!</p>",
  text: "Thanks for your order!",
};

describe("sendTransactionalEmail", () => {
  it("sends once and records the EmailLog row", async () => {
    const outcome = await sendTransactionalEmail(INPUT);

    expect(outcome.status).toBe("sent");
    expect(fakeEmail.sent).toHaveLength(1);
    expect(fakeEmail.sent[0]).toMatchObject({
      to: INPUT.to,
      subject: INPUT.subject,
      text: INPUT.text,
      idempotencyKey: INPUT.dedupeKey,
    });

    const row = await db.emailLog.findUniqueOrThrow({
      where: { dedupeKey: INPUT.dedupeKey },
    });
    expect(row.status).toBe("sent");
    expect(row.kind).toBe("order-confirmed");
    expect(row.recipient).toBe(INPUT.to);
    expect(row.subject).toBe(INPUT.subject);
    expect(row.error).toBeNull();
  });

  it("passes replyTo through for support replies", async () => {
    await sendTransactionalEmail({ ...INPUT, dedupeKey: "support-message:1", replyTo: "asker@example.com" });
    expect(fakeEmail.sent[0].replyTo).toBe("asker@example.com");
  });

  it("never sends twice for the same dedupe key", async () => {
    const first = await sendTransactionalEmail(INPUT);
    const second = await sendTransactionalEmail(INPUT);

    expect(first.status).toBe("sent");
    expect(second.status).toBe("duplicate");
    expect(fakeEmail.sent).toHaveLength(1);
    expect(await db.emailLog.count({ where: { dedupeKey: INPUT.dedupeKey } })).toBe(1);
  });

  it("reclaims a failed row so a genuine retry can run", async () => {
    const failed = await sendTransactionalEmail(INPUT, { transport: failingEmail });
    expect(failed.status).toBe("failed");

    const row = await db.emailLog.findUniqueOrThrow({
      where: { dedupeKey: INPUT.dedupeKey },
    });
    expect(row.status).toBe("failed");
    expect(row.error).toContain("resend unavailable");

    const retried = await sendTransactionalEmail(INPUT);
    expect(retried.status).toBe("sent");
    expect(fakeEmail.sent).toHaveLength(1);

    const after = await db.emailLog.findUniqueOrThrow({
      where: { dedupeKey: INPUT.dedupeKey },
    });
    expect(after.status).toBe("sent");
    expect(after.error).toBeNull();
  });

  it("never throws when the provider fails", async () => {
    await expect(
      sendTransactionalEmail(INPUT, { transport: failingEmail }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("skips silently when Resend is not configured", async () => {
    const cfg = integrations as { email: boolean };
    const previous = cfg.email;
    cfg.email = false;
    try {
      const outcome = await sendTransactionalEmail(INPUT);
      expect(outcome.status).toBe("skipped");
      expect(fakeEmail.sent).toHaveLength(0);
      expect(
        await db.emailLog.findUnique({ where: { dedupeKey: INPUT.dedupeKey } }),
      ).toBeNull();
    } finally {
      cfg.email = previous;
    }
  });

  it("skips an invalid recipient without touching the transport", async () => {
    const outcome = await sendTransactionalEmail({ ...INPUT, to: "not-an-email" });
    expect(outcome.status).toBe("skipped");
    expect(fakeEmail.sent).toHaveLength(0);
    expect(
      await db.emailLog.findUnique({ where: { dedupeKey: INPUT.dedupeKey } }),
    ).toBeNull();
  });

  it("respects a caller-supplied transport over the global one", async () => {
    const outcome = await sendTransactionalEmail(INPUT, { transport: failingEmail });
    expect(outcome.status).toBe("failed");
    expect(fakeEmail.sent).toHaveLength(0);
  });
});

describe("orderEmailKey", () => {
  it("builds the five mandatory deterministic keys", () => {
    expect(orderEmailKey("order-confirmed", "o1")).toBe("order-confirmed:o1");
    expect(orderEmailKey("order-submitted", "o1")).toBe("order-submitted:o1");
    expect(orderEmailKey("order-shipped", "o1")).toBe("order-shipped:o1");
    expect(orderEmailKey("order-delivered", "o1")).toBe("order-delivered:o1");
    expect(orderEmailKey("admin-new-order", "o1")).toBe("admin-new-order:o1");
  });
});

describe("maskEmail", () => {
  it("masks the local part for logs", () => {
    expect(maskEmail("jane@example.com")).toBe("j***@example.com");
    expect(maskEmail("nope")).toBe("[redacted]");
    expect(maskEmail("")).toBe("[redacted]");
  });
});

describe("sanitizeEmailError", () => {
  it("redacts the Resend API key and provider-shaped secrets", () => {
    const message = sanitizeEmailError(
      new Error(`upstream rejected ${serverEnv.RESEND_API_KEY} for re_abc123456789`),
    );
    if (serverEnv.RESEND_API_KEY) {
      expect(message).not.toContain(serverEnv.RESEND_API_KEY);
    }
    expect(message).not.toContain("re_abc123456789");
    expect(message).toContain("[redacted]");
  });

  it("redacts bearer tokens and key/value secrets", () => {
    expect(sanitizeEmailError("auth Bearer abc.def.ghi")).toBe(
      "auth [redacted]",
    );
    const tokenError = sanitizeEmailError('token: "super-secret"');
    expect(tokenError).not.toContain("super-secret");
    expect(tokenError).toContain("[redacted]");
  });

  it("keeps a hostile provider response log-sized", () => {
    expect(sanitizeEmailError("x".repeat(5_000)).length).toBeLessThanOrEqual(400);
  });

  it("collapses whitespace and handles non-errors", () => {
    expect(sanitizeEmailError(new Error("a\n\n   b"))).toBe("Error: a b");
    expect(sanitizeEmailError({ weird: true })).toBe("unknown email error");
  });
});
