import { beforeEach, describe, expect, it } from "vitest";

import { integrations, supportEmail } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import { submitContactMessage } from "@/lib/contact/service";

import { fakeEmail } from "./fake-email";

const valid = {
  name: "Jane Smith",
  email: "jane@example.com",
  orderNumber: "",
  category: "order",
  message: "Where is my order? I placed it last week.",
  website: "",
};

function storeEmail() {
  return fakeEmail.sent.find((email) => email.idempotencyKey.startsWith("support-message:"));
}

function receiptEmail() {
  return fakeEmail.sent.find((email) => email.idempotencyKey.startsWith("support-received:"));
}

beforeEach(async () => {
  await db.emailLog.deleteMany();
});

describe("submitContactMessage", () => {
  it("notifies the store and receipts the customer", async () => {
    const result = await submitContactMessage(valid, { ip: "203.0.113.1" });

    expect(result).toEqual({ ok: true });
    expect(fakeEmail.sent).toHaveLength(2);

    const store = storeEmail();
    expect(store?.to).toBe(supportEmail());
    expect(store?.replyTo).toBe("jane@example.com");
    expect(store?.subject).toContain("Jane Smith");
    expect(store?.subject).toContain("Order question");
    expect(store?.html).toContain("jane@example.com");
    expect(store?.html).toContain("Where is my order?");

    const receipt = receiptEmail();
    expect(receipt?.to).toBe("jane@example.com");
    expect(receipt?.html).toContain("Jane Smith");

    const rows = await db.emailLog.findMany({ orderBy: { kind: "asc" } });
    expect(rows.map((row) => row.kind)).toEqual(["support-message", "support-received"]);
    expect(rows.every((row) => row.status === "sent")).toBe(true);
  });

  it("rejects an invalid email address", async () => {
    const result = await submitContactMessage(
      { ...valid, email: "not-an-email" },
      { ip: "203.0.113.2" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("valid email address");
    expect(fakeEmail.sent).toHaveLength(0);
    expect(await db.emailLog.count()).toBe(0);
  });

  it("rejects an empty or oversized message", async () => {
    const empty = await submitContactMessage(
      { ...valid, message: "   " },
      { ip: "203.0.113.3" },
    );
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain("at least 10 characters");

    const oversized = await submitContactMessage(
      { ...valid, message: "x".repeat(3001) },
      { ip: "203.0.113.4" },
    );
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.error).toContain("3000");

    expect(fakeEmail.sent).toHaveLength(0);
  });

  it("rejects a missing name and an unknown category", async () => {
    const noName = await submitContactMessage(
      { ...valid, name: "  " },
      { ip: "203.0.113.5" },
    );
    expect(noName.ok).toBe(false);
    if (!noName.ok) expect(noName.error).toContain("name");

    const badCategory = await submitContactMessage(
      { ...valid, category: "definitely-not-a-category" },
      { ip: "203.0.113.6" },
    );
    expect(badCategory.ok).toBe(false);
    if (!badCategory.ok) expect(badCategory.error).toContain("reason");

    expect(fakeEmail.sent).toHaveLength(0);
  });

  it("accepts a message without an order number", async () => {
    const result = await submitContactMessage(valid, { ip: "203.0.113.7" });
    expect(result).toEqual({ ok: true });
    expect(storeEmail()?.html).not.toContain("Verified order summary");
  });

  it("adds a verified summary only for a real order number", async () => {
    const created = await db.order.create({
      data: {
        orderNumber: `ZS-CONT${Date.now().toString().slice(-9)}`,
        email: "buyer@example.com",
        status: "PAID",
        currency: "GBP",
        subtotalMinor: 2500,
        shippingMinor: 0,
        totalMinor: 2500,
        paidAt: new Date(),
        recipientName: "Jane Smith",
        address1: "1 Main St",
        city: "London",
        postalCode: "SW1A 1AA",
        country: "GB",
      },
    });

    const result = await submitContactMessage(
      { ...valid, orderNumber: created.orderNumber },
      { ip: "203.0.113.8" },
    );

    expect(result).toEqual({ ok: true });
    expect(storeEmail()?.html).toContain("Verified order summary");
    expect(storeEmail()?.html).toContain(created.orderNumber);
  });

  it("never reveals whether an unknown order exists", async () => {
    const result = await submitContactMessage(
      { ...valid, orderNumber: "ZS-NOTREAL01" },
      { ip: "203.0.113.9" },
    );

    expect(result).toEqual({ ok: true });
    expect(fakeEmail.sent).toHaveLength(2);
    expect(storeEmail()?.html).not.toContain("Verified order summary");
  });

  it("drops honeypot submissions without sending anything", async () => {
    const result = await submitContactMessage(
      { ...valid, website: "http://spam.example" },
      { ip: "203.0.113.10" },
    );

    expect(result).toEqual({ ok: true });
    expect(fakeEmail.sent).toHaveLength(0);
    expect(await db.emailLog.count()).toBe(0);
  });

  it("strips header injection from names and subjects stay single-line", async () => {
    const result = await submitContactMessage(
      { ...valid, name: "Evil\r\nBcc: evil@example.com" },
      { ip: "203.0.113.11" },
    );

    expect(result).toEqual({ ok: true });
    const subject = storeEmail()?.subject ?? "";
    expect(subject).not.toMatch(/[\r\n]/);
    expect(subject).toContain("Evil Bcc: evil@example.com");
  });

  it("escapes customer markup in the stored email", async () => {
    const result = await submitContactMessage(
      { ...valid, message: 'Look at this <script>alert(1)</script> order issue' },
      { ip: "203.0.113.12" },
    );

    expect(result).toEqual({ ok: true });
    expect(storeEmail()?.html).toContain("&lt;script&gt;");
    expect(storeEmail()?.html).not.toContain("<script>alert(1)</script>");
  });

  it("returns a generic failure when the store email is unavailable", async () => {
    fakeEmail.failAll = true;

    const result = await submitContactMessage(valid, { ip: "203.0.113.13" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "We couldn't send your message right now. Please try again in a few minutes.",
      );
    }
    expect(fakeEmail.sent).toHaveLength(0);
  });

  it("returns a generic failure when support email is not configured", async () => {
    const cfg = integrations as { support: boolean };
    const previous = cfg.support;
    cfg.support = false;
    try {
      const result = await submitContactMessage(valid, { ip: "203.0.113.14" });
      expect(result.ok).toBe(false);
      expect(fakeEmail.sent).toHaveLength(0);
    } finally {
      cfg.support = previous;
    }
  });

  it("rate limits repeated submissions per IP", async () => {
    const ip = "203.0.113.50";
    const results = [];
    for (let i = 0; i < 6; i += 1) {
      results.push(await submitContactMessage(valid, { ip }));
    }

    expect(results.slice(0, 5).every((result) => result.ok)).toBe(true);
    const blocked = results[5];
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.error).toContain("sent several messages recently");
      expect(blocked.error).not.toContain("couldn't send");
    }
  });
});
