import type { Prisma } from "@/generated/prisma/client";

import type { PrintifyOption, PrintifyVariant } from "@/lib/printify/types";

export function toSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/["'’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70) || "product"
  );
}

export async function uniqueSlug(
  base: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  let slug = base;
  let suffix = 2;
  for (;;) {
    const existing = await tx.product.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    slug = `${base}-${suffix}`;
    suffix += 1;
  }
}

export function variantOptionTitle(
  options: PrintifyOption[],
  variant: PrintifyVariant,
  optionType: string,
): string | null {
  const option = options.find((o) => o.type === optionType);
  if (!option) return null;
  const valueId = variant.options.find((id) =>
    option.values.some((v) => v.id === id),
  );
  if (valueId === undefined) return null;
  return option.values.find((v) => v.id === valueId)?.title ?? null;
}

export function variantDisplayTitle(
  options: PrintifyOption[],
  variant: PrintifyVariant,
): string {
  const labels: string[] = [];
  for (const option of options) {
    const matched = variant.options
      .map((id) => option.values.find((v) => v.id === id))
      .filter((v) => v !== undefined);
    if (matched.length > 0) {
      labels.push(...matched.map((v) => v!.title));
    }
  }
  const joined = labels.join(" / ");
  return joined || variant.title || String(variant.id);
}