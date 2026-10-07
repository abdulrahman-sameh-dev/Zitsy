/**
 * Pure catalog logic for option dimensions, variant resolution and availability.
 * No I/O — unit-testable and shared between server pages and client components.
 */

export interface ProductOptionValue {
  valueId: number;
  title: string;
}

export interface ProductOptionDim {
  name: string;
  type: string;
  values: ProductOptionValue[];
}

export interface ProductVariantRecord {
  id: string;
  printifyVariantId: number;
  title: string;
  priceMinor: number;
  currency: string;
  isEnabled: boolean;
  isAvailable: boolean;
  optionValueIds: number[];
}

/**
 * Server-side variant row, including its fulfillment cost. Used when building
 * the product view; never serialized to the browser (margin stays private).
 */
export interface SellableVariantRecord extends ProductVariantRecord {
  costMinor: number;
}

export interface RawOptionValue {
  id: number;
  title: string;
}

export interface RawOptionDim {
  name: string;
  type: string;
  values: RawOptionValue[];
}

export type Selection = Record<string, number>;

function isOrderable(variant: ProductVariantRecord): boolean {
  return (
    variant.isEnabled &&
    variant.isAvailable &&
    variant.printifyVariantId > 0 &&
    variant.priceMinor > 0 &&
    variant.optionValueIds.length > 0
  );
}

/**
 * A variant the storefront may sell: enabled, available, backed by a real
 * Printify variant id, a real price and a real option combination.
 */
export function isOrderableVariant(variant: ProductVariantRecord): boolean {
  return isOrderable(variant);
}

/**
 * Server-side sellability: everything orderable requires, plus a usable
 * fulfillment cost. Only meaningful where cost is known (catalog build).
 */
export function isSellableVariant(variant: SellableVariantRecord): boolean {
  return isOrderable(variant) && variant.costMinor > 0;
}

/** Variants a customer can actually buy. */
export function orderableVariants(
  variants: ProductVariantRecord[],
): ProductVariantRecord[] {
  return variants.filter(isOrderable);
}

/**
 * Build the option dimensions of a product from its raw Printify options,
 * restricted to values that actually occur in a sellable variant — so colors
 * (or sizes) that only exist on disabled/unavailable variants are never
 * offered. Values come from the normalized local variant rows, never from
 * marketing metadata or hardcoded lists, so any dimension Printify exposes
 * (Color, Size, Scent, Sticker shape, …) keeps working.
 *
 * When nothing is sellable the product is unavailable; the raw values are kept
 * so the page can still show its options — they are all rendered disabled.
 */
export function buildOptionDims(
  options: RawOptionDim[] | null | undefined,
  variants: SellableVariantRecord[],
): ProductOptionDim[] {
  if (!options) return [];

  const sellable = variants.filter(isSellableVariant);
  const pool = sellable.length > 0 ? sellable : variants;

  const usedValueIds = new Set<number>();
  for (const variant of pool) {
    for (const id of variant.optionValueIds) usedValueIds.add(id);
  }

  return options
    .map((dim) => ({
      name: dim.name,
      type: dim.type,
      values: dim.values
        .filter((value) => usedValueIds.has(value.id))
        .map((value) => ({ valueId: value.id, title: value.title })),
    }))
    .filter((dim) => dim.values.length > 0);
}

/**
 * Values in `dimValues` that still form a real combination with the current
 * selection on the OTHER dimensions. Used to disable unavailable combinations.
 */
export function availableValueIdsForDim(
  dimName: string,
  dimValueIds: number[],
  selection: Selection,
  variants: ProductVariantRecord[],
): Set<number> {
  const orderable = variants.filter(isOrderable);
  const pool = orderable.length > 0 ? orderable : variants;

  const wanted = new Set<number>();
  for (const [name, valueId] of Object.entries(selection)) {
    if (name !== dimName && valueId) wanted.add(valueId);
  }

  const result = new Set<number>();
  for (const valueId of dimValueIds) {
    const maybe = pool.some((variant) => {
      const ids = new Set(variant.optionValueIds);
      for (const id of wanted) if (!ids.has(id)) return false;
      return ids.has(valueId);
    });
    if (maybe) result.add(valueId);
  }
  return result;
}

/**
 * Resolve a selection to the exact local variant. When `dimNames` is given the
 * selection must contain a value for every dimension and must match a variant
 * exactly; otherwise null is returned (incomplete or impossible combinations).
 */
export function resolveVariant(
  variants: ProductVariantRecord[],
  selection: Selection,
  dimNames?: string[],
): ProductVariantRecord | null {
  if (dimNames && dimNames.some((name) => !selection[name])) return null;

  const selectedValues = Object.values(selection).filter(Boolean);
  if (selectedValues.length === 0) return null;

  const selectedSet = new Set(selectedValues);
  const matches = variants.filter((variant) => {
    const ids = new Set(variant.optionValueIds);
    for (const id of selectedSet) if (!ids.has(id)) return false;
    return true;
  });

  if (matches.length === 0) return null;

  // Prefer the variant whose option value set is exactly the selection, and
  // among those prefer one that is actually orderable (an identical disabled
  // row must not shadow the variant a customer can buy).
  const exact = matches.filter(
    (variant) =>
      variant.optionValueIds.length === selectedSet.size &&
      variant.optionValueIds.every((id) => selectedSet.has(id)),
  );
  if (exact.length > 0) return exact.find(isOrderable) ?? exact[0];

  // A full selection with no exact variant is an impossible combination.
  if (dimNames) return null;
  return matches.find(isOrderable) ?? matches[0];
}

/** Price label helpers driven by real variant prices. */

export function minPriceMinor(variants: ProductVariantRecord[]): number {
  const prices = orderableVariants(variants).map((v) => v.priceMinor);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

export function hasDistinctPrices(
  variants: ProductVariantRecord[],
): boolean {
  const prices = new Set(orderableVariants(variants).map((v) => v.priceMinor));
  return prices.size > 1;
}

/**
 * Price of a selected variant, or null when the selection is incomplete.
 * Never falls back to a different variant's price.
 */
export function selectedPriceMinor(
  variants: ProductVariantRecord[],
  selection: Selection,
  dimNames: string[],
): number | null {
  if (dimNames.some((name) => !selection[name])) return null;
  const variant = resolveVariant(variants, selection);
  return variant === null ? null : variant.priceMinor;
}