import { z } from "zod";

export const CONTACT_CATEGORIES = [
  "order",
  "shipping",
  "product",
  "payment",
  "other",
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

export const CONTACT_CATEGORY_LABELS: Record<ContactCategory, string> = {
  order: "Order question",
  shipping: "Shipping question",
  product: "Product question",
  payment: "Payment question",
  other: "Other",
};

export function contactCategoryLabel(value: string): string {
  return (
    CONTACT_CATEGORY_LABELS[value as ContactCategory] ?? CONTACT_CATEGORY_LABELS.other
  );
}

export const MAX_NAME_LENGTH = 100;
export const MIN_MESSAGE_LENGTH = 10;
export const MAX_MESSAGE_LENGTH = 3000;

const trimmed = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

/**
 * §15 — everything is validated server-side. `website` is a honeypot: humans
 * never see it, so anything that fills it is treated as a bot.
 */
export const contactSchema = z.object({
  name: z.preprocess(
    trimmed,
    z
      .string()
      .min(1, "Please enter your name.")
      .max(MAX_NAME_LENGTH, `Name must be ${MAX_NAME_LENGTH} characters or fewer.`),
  ),
  email: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.email("Please enter a valid email address.").max(200),
  ),
  orderNumber: z.preprocess(
    trimmed,
    z.string().max(32, "That order number looks too long.").optional(),
  ),
  category: z.enum(CONTACT_CATEGORIES, { error: "Please choose a reason." }),
  message: z.preprocess(
    trimmed,
    z
      .string()
      .min(
        MIN_MESSAGE_LENGTH,
        `Please include a little more detail (at least ${MIN_MESSAGE_LENGTH} characters).`,
      )
      .max(
        MAX_MESSAGE_LENGTH,
        `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`,
      ),
  ),
  website: z.preprocess(
    trimmed,
    z.string().max(500).optional().default(""),
  ),
});

export type ContactInput = z.infer<typeof contactSchema>;

export type ParsedContact =
  | { ok: true; data: ContactInput }
  | { ok: false; error: string };

export function parseContact(input: unknown): ParsedContact {
  const result = contactSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return {
    ok: false,
    error: first?.message ?? "Please check your message and try again.",
  };
}

/**
 * Strips control characters (header/body injection) while keeping readable
 * whitespace. Newlines are allowed only where a message body is expected.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .slice(0, MAX_MESSAGE_LENGTH + 1);
}

/** Single-line variant for names/subjects — newlines can inject headers. */
export function sanitizeLine(value: string): string {
  return sanitizeText(value).replace(/[\n\t]+/g, " ").trim();
}
