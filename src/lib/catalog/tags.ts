/**
 * Fulfillment/marketing tags that describe production capabilities rather than
 * the garment actually sold (e.g. "Glitter print" or "Embroidery" appear on a
 * plain DTG mockup purely because the print provider supports that technique).
 * Showing them on the product page implies the item is glitter/embroidered,
 * which the pre-designed design is not. The raw tags are still indexed for
 * search and category derivation — this filter only affects what is displayed.
 */

const BLOCKED_DISPLAY_TAGS = new Set(
  [
    "personalization picks",
    "new mockups",
    "best seller",
    "bestseller",
    "trending",
    "hot right now",
    "staff pick",
    "new",
    "tiktok",
    "instagram",
    "facebook",
    "glitter",
    "glitter print",
    "puff",
    "puffy",
    "puff print",
    "metallic",
    "metallic print",
    "raised print",
    "textured print",
    "embroidery",
    "embroidered",
    "holographic",
    "holographic print",
    "foil",
    "foil print",
  ],
);

/** Tags safe to show a customer, preserving order. */
export function displayTags(tags: string[]): string[] {
  return tags.filter((tag) => !BLOCKED_DISPLAY_TAGS.has(tag.trim().toLowerCase()));
}