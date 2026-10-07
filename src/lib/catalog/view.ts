import type {
  ProductOptionDim,
  ProductVariantRecord,
  RawOptionDim,
  SellableVariantRecord,
} from "./variants";
import { buildOptionDims, isOrderableVariant } from "./variants";

export interface ImageRecord {
  src: string;
  position: number;
  isDefault: boolean;
  variantIds: number[];
}

export interface ProductViewRecord {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  currency: string;
  minPriceMinor: number;
  dims: ProductOptionDim[];
  variants: ProductVariantRecord[];
  images: ImageRecord[];
  availableVariantCount: number;
}

export interface ViewVariant {
  id: string;
  printifyVariantId: number;
  title: string;
  priceMinor: number;
  costMinor: number;
  currency: string;
  isEnabled: boolean;
  isAvailable: boolean;
  optionValueIds: number[];
}

export interface ViewImage {
  src: string;
  position: number;
  isDefault: boolean;
  variantIds: number[];
}

export interface ViewProduct {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  currency: string;
  minPriceMinor: number;
  options: unknown;
  variants: ViewVariant[];
  images: ViewImage[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function rawOptions(options: unknown): RawOptionDim[] | null {
  if (!Array.isArray(options)) return null;
  const dims: RawOptionDim[] = [];
  for (const entry of options) {
    if (!isRecord(entry)) continue;
    const name = typeof entry.name === "string" ? entry.name : "";
    const type = typeof entry.type === "string" ? entry.type : "";
    const values: RawOptionDim["values"] = [];
    if (Array.isArray(entry.values)) {
      for (const value of entry.values) {
        if (isRecord(value)) {
          const id = typeof value.id === "number" ? value.id : Number(value.id);
          const title = typeof value.title === "string" ? value.title : "";
          if (Number.isFinite(id) && title) values.push({ id, title });
        }
      }
    }
    if (name && type) dims.push({ name, type, values });
  }
  return dims;
}

/**
 * Images to show for a selected variant: the images that include it, or the
 * full set when the variant has no dedicated images. Returns all images when
 * no variant is selected.
 */
export function imagesForVariant(
  images: ImageRecord[],
  printifyVariantId: number | null,
): ImageRecord[] {
  if (printifyVariantId === null) return images;
  const matching = images.filter((image) =>
    image.variantIds.includes(printifyVariantId),
  );
  return matching.length > 0 ? matching : images;
}

/** Convert a Prisma product (with variants + images) into a serializable view. */
export function buildProductView(product: ViewProduct): ProductViewRecord {
  // Browser-facing rows: cost is deliberately not part of this shape so the
  // production cost / margin never reaches the client.
  const variants: ProductVariantRecord[] = product.variants.map((variant) => ({
    id: variant.id,
    printifyVariantId: variant.printifyVariantId,
    title: variant.title,
    priceMinor: variant.priceMinor,
    currency: variant.currency,
    isEnabled: variant.isEnabled,
    isAvailable: variant.isAvailable,
    optionValueIds: variant.optionValueIds,
  }));

  // Server-only rows (cost included): option values are derived from the
  // variants that can actually be sold, including the cost requirement.
  const sellableSource: SellableVariantRecord[] = product.variants.map(
    (variant) => ({
      id: variant.id,
      printifyVariantId: variant.printifyVariantId,
      title: variant.title,
      priceMinor: variant.priceMinor,
      costMinor: variant.costMinor,
      currency: variant.currency,
      isEnabled: variant.isEnabled,
      isAvailable: variant.isAvailable,
      optionValueIds: variant.optionValueIds,
    }),
  );

  const dims = buildOptionDims(rawOptions(product.options), sellableSource);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    tags: product.tags,
    currency: product.currency,
    minPriceMinor: product.minPriceMinor,
    dims,
    variants,
    images: product.images.map((image) => ({
      src: image.src,
      position: image.position,
      isDefault: image.isDefault,
      variantIds: image.variantIds,
    })),
    availableVariantCount: variants.filter(isOrderableVariant).length,
  };
}