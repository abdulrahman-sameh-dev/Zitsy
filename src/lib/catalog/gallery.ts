/**
 * Selection-aware gallery logic. Pure functions with no I/O so the color →
 * image and color → size relationships can be unit-tested in isolation.
 *
 * Data reality: every Printify mockup row stores the variant ids it belongs to
 * (ProductImage.variantIds) and every variant row stores its colorName /
 * sizeName (from the "color" / "size" option type). Colors and images are
 * therefore matched by *variant set*, never by filename or image order.
 */

import type { ImageRecord } from "./view";
import type { ProductOptionDim, ProductVariantRecord } from "./variants";
import { isOrderableVariant } from "./variants";

export interface ColorGroup {
  /** Option value id of the color on the "color" dimension. */
  valueId: number;
  /** Display name of the color (e.g. "Sport Grey"). */
  title: string;
  /** Printify variant ids that belong to this color and are orderable. */
  variantIds: number[];
  /** Images whose variant set intersects this color (ordered front-first). */
  images: ImageRecord[];
  /** The representative front/first image used for swatches and initial load. */
  heroImage: ImageRecord | null;
}

export interface ColorGallery {
  colorDimName: string;
  groups: ColorGroup[];
  /** Images that belong to no color (rare; appended last when needed). */
  untagged: ImageRecord[];
}

/**
 * A best-effort, provider-agnostic name → hex map for common garment colours.
 * Where a colour name is unknown the UI falls back to a neutral swatch; the
 * accessible label always carries the real colour name.
 */
export const KNOWN_GARMENT_COLORS: Record<string, string> = {
  white: "#f4f4f2",
  black: "#232323",
  navy: "#223a5e",
  "dark navy": "#1d3050",
  "heather navy": "#5c6d8c",
  "heather indigo": "#55608f",
  indigo: "#4b4f9d",
  "sport grey": "#9a9a9d",
  "heather grey": "#b4b4b5",
  grey: "#8b8b8d",
  ash: "#d2d2ce",
  "ice grey": "#dfe4ea",
  "graphite heather": "#4d5057",
  "dark heather": "#414247",
  charcoal: "#3a3a3c",
  "garment dyed dark charcoal": "#3a3a3c",
  sand: "#d9c8a9",
  khaki: "#b7a57a",
  natural: "#e8e0d0",
  "athletic heather": "#cfcfc4",
  "heather military green": "#55604a",
  "military green": "#4a5d43",
  "forest green": "#2e5a3a",
  moss: "#5a6b3a",
  sage: "#9aa387",
  "light green": "#bbd8a8",
  "island green": "#3ca07b",
  seafoam: "#bfe0d5",
  "lagoon blue": "#1f9bbf",
  lagoon: "#0f7f8f",
  bay: "#1f9bbf",
  blue: "#3a5bd7",
  royal: "#3a5bd7",
  "carolina blue": "#6fa8dc",
  maroon: "#6f2830",
  "dark chocolate": "#3a2a20",
  pepper: "#5a5147",
  granitic: "#6b6b6e",
  hemp: "#bfae8f",
};

/** Parse the Printify camera label from an image src (front, back, …). */
export function cameraLabel(src: string): string {
  const match = /[?&]camera_label=([^&]+)/.exec(src);
  return match ? decodeURIComponent(match[1]) : "";
}

/** Canonical bucket so `front-2`, `person-3-back`, `folded-2` collapse. */
export function cameraBucket(label: string): string {
  if (!label) return "unknown";
  const stem = label.split("-")[0];
  if (stem === "size") return "size-chart";
  if (stem === "closeup" || label.includes("collar") || label.includes("sleeve")) {
    return "detail";
  }
  return stem;
}

/** Display priority for thumbnails: front first, product detail first. */
const CAMERA_RANK: Record<string, number> = {
  front: 0,
  back: 1,
  open: 2,
  folded: 3,
  hanging: 4,
  lifestyle: 5,
  person: 6,
  context: 7,
  detail: 8,
  "size-chart": 9,
  duo: 8,
  left: 1,
  right: 1,
  top: 1,
  bottom: 1,
};

export function cameraRank(label: string): number {
  return CAMERA_RANK[cameraBucket(label)] ?? 10;
}

/**
 * One representative image per camera angle, in a sensible order, capped at
 * `cap`. Prevents 100+ near-duplicate size mockups from flooding the gallery.
 */
export function distinctAngles(images: ImageRecord[], cap: number): ImageRecord[] {
  const seen = new Set<string>();
  const picks: Array<{ rank: number; image: ImageRecord }> = [];
  for (const image of images) {
    const bucket = cameraBucket(cameraLabel(image.src));
    if (seen.has(bucket)) continue;
    seen.add(bucket);
    picks.push({ rank: cameraRank(cameraLabel(image.src)), image });
  }
  picks.sort((a, b) => a.rank - b.rank || a.image.position - b.image.position);
  return picks.slice(0, cap).map((p) => p.image);
}

/** Images for a color group sorted so the front/default mockup leads. */
function sortForDisplay(images: ImageRecord[]): ImageRecord[] {
  return [...images].sort((a, b) => {
    const rankA = cameraRank(cameraLabel(a.src));
    const rankB = cameraRank(cameraLabel(b.src));
    if (rankA !== rankB) return rankA - rankB;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.position - b.position;
  });
}

/**
 * Build the color-aware gallery for a product. Colors come from the option
 * dimension of type "color"; each color's images are matched through the
 * orderable variants that carry that color's option value id.
 *
 * Products without a color dimension get `groups: []` + all images as untagged
 * so the caller can fall back to the variant-scale gallery.
 */
export function buildColorGallery(
  dims: ProductOptionDim[],
  variants: ProductVariantRecord[],
  images: ImageRecord[],
): ColorGallery {
  const colorDim = dims.find((dim) => dim.type === "color");
  if (!colorDim) return { colorDimName: "", groups: [], untagged: images };

  const orderable = variants.filter(isOrderableVariant);
  const groups: ColorGroup[] = [];

  for (const value of colorDim.values) {
    const members = orderable.filter((variant) =>
      variant.optionValueIds.includes(value.valueId),
    );
    if (members.length === 0) continue;

    const variantIds = members.map((member) => member.printifyVariantId);
    const colorImages = sortForDisplay(
      images.filter((image) =>
        image.variantIds.some((id) => variantIds.includes(id)),
      ),
    );
    const heroImage =
      colorImages.find(
        (image) => image.isDefault && cameraRank(cameraLabel(image.src)) === 0,
      ) ??
      colorImages.find((image) => cameraRank(cameraLabel(image.src)) === 0) ??
      colorImages[0] ??
      null;

    groups.push({ valueId: value.valueId, title: value.title, variantIds, images: colorImages, heroImage });
  }

  const assigned = new Set(
    groups.flatMap((group) => group.images.map((image) => image.src)),
  );
  const untagged = images.filter((image) => !assigned.has(image.src));

  return { colorDimName: colorDim.name, groups, untagged };
}

/**
 * A size that stays compatible with the newly selected colour. When the
 * currently chosen size is still made in that colour it is returned unchanged;
 * otherwise the first size available for the colour is returned so a colour
 * change never silently keeps an impossible size.
 */
export function suggestCompatibleSize(
  colorValueId: number,
  currentSizeValueId: number | undefined,
  sizeDim: ProductOptionDim | undefined,
  variants: ProductVariantRecord[],
): number | null {
  if (!sizeDim) return null;
  const members = variants.filter(
    (variant) =>
      isOrderableVariant(variant) &&
      variant.optionValueIds.includes(colorValueId),
  );
  const available = new Set<number>();
  for (const variant of members) {
    for (const id of variant.optionValueIds) {
      if (sizeDim.values.some((value) => value.valueId === id)) available.add(id);
    }
  }
  if (currentSizeValueId !== undefined && available.has(currentSizeValueId)) {
    return currentSizeValueId;
  }
  const first = sizeDim.values.find((value) => available.has(value.valueId));
  return first?.valueId ?? null;
}

/** Hex for a known garment colour name, or null when unknown. */
export function swatchColor(title: string): string | null {
  const key = title.trim().toLowerCase();
  return KNOWN_GARMENT_COLORS[key] ?? null;
}