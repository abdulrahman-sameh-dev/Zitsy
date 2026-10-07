import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import { verifyPrintifySignature } from "@/lib/printify/webhooks";

const SECRET = "whsec_test_secret";

function sign(raw: string): string {
  return `sha256=${createHmac("sha256", SECRET).update(raw).digest("hex")}`;
}

describe("verifyPrintifySignature", () => {
  it("accepts a valid signature", () => {
    const raw = JSON.stringify({ type: "product:updated", id: "evt-1" });
    expect(verifyPrintifySignature(raw, sign(raw), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const raw = JSON.stringify({ type: "product:updated", id: "evt-1" });
    const tampered = raw.replace("evt-1", "evt-2");
    expect(verifyPrintifySignature(tampered, sign(raw), SECRET)).toBe(false);
  });

  it("rejects a corrupted header value", () => {
    const raw = JSON.stringify({ type: "product:updated" });
    expect(
      verifyPrintifySignature(raw, "sha256=zz-not-hex-!!", SECRET),
    ).toBe(false);
  });

  it("rejects a header missing the sha256= prefix", () => {
    const raw = JSON.stringify({ type: "product:updated" });
    expect(verifyPrintifySignature(raw, sign(raw).replace("sha256=", ""), SECRET)).toBe(
      false,
    );
  });

  it("rejects a missing header", () => {
    const raw = JSON.stringify({ type: "product:updated" });
    expect(verifyPrintifySignature(raw, null, SECRET)).toBe(false);
  });

  it("rejects a signature produced with a different secret", () => {
    const raw = JSON.stringify({ type: "product:updated" });
    const other = `sha256=${createHmac("sha256", "other").update(raw).digest("hex")}`;
    expect(verifyPrintifySignature(raw, other, SECRET)).toBe(false);
  });
});