import { describe, expect, it } from "vitest";

import { customerSchema, parseCustomer } from "@/lib/checkout/schemas";

const VALID = {
  fullName: "  Ada Lovelace ",
  email: " ADA@Example.COM ",
  country: "gb",
  address1: "1 Analytical Engine Way",
  address2: "",
  city: "London",
  region: "",
  postalCode: "EC1A 1BB",
  phone: "",
};

describe("customerSchema", () => {
  it("normalizes email, country, and whitespace", () => {
    const parsed = customerSchema.parse(VALID);
    expect(parsed.fullName).toBe("Ada Lovelace");
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.country).toBe("GB");
    expect(parsed.address2).toBeUndefined();
    expect(parsed.region).toBeUndefined();
    expect(parsed.phone).toBeUndefined();
  });

  it("rejects an unsupported country", () => {
    const result = customerSchema.safeParse({ ...VALID, country: "US" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = customerSchema.safeParse({ ...VALID, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = customerSchema.safeParse({ ...VALID, address1: "" });
    expect(result.success).toBe(false);
  });

  it("returns the first user-facing message from parseCustomer", () => {
    const result = parseCustomer({ ...VALID, email: "nope" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/valid email/i);
  });

  it("accepts a fully valid submission", () => {
    const result = parseCustomer(VALID);
    expect(result.ok).toBe(true);
  });
});