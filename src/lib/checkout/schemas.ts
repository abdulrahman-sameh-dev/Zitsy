import { z } from "zod";

import { marketCodes } from "@/lib/markets";

const trimmed = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

const optionalText = (max: number) =>
  z.preprocess(
    (value) => {
      const v = trimmed(value);
      return v === "" ? undefined : v;
    },
    z.string().max(max).optional(),
  );

/** Checkout customer + shipping information (MVP: GB + DE only). */
export const customerSchema = z.object({
  fullName: z.preprocess(trimmed, z.string().min(2, "Enter your full name").max(120)),
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.email("Enter a valid email address").max(200),
  ),
  country: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.enum(marketCodes as [string, ...string[]], {
      error: "We currently ship to the UK and Germany only",
    }),
  ),
  address1: z.preprocess(trimmed, z.string().min(3, "Enter your address").max(200)),
  address2: optionalText(200),
  city: z.preprocess(trimmed, z.string().min(1, "Enter your city").max(100)),
  region: optionalText(100),
  postalCode: z.preprocess(
    trimmed,
    z.string().min(3, "Enter your postcode").max(20),
  ),
  phone: optionalText(40),
});

export type CustomerInput = z.infer<typeof customerSchema>;

export function parseCustomer(input: unknown):
  | { ok: true; data: CustomerInput }
  | { ok: false; error: string } {
  const result = customerSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return {
    ok: false,
    error: first?.message ?? "Please check your details and try again.",
  };
}