/** Minimal product-type category derivation from real Printify tags. */

export interface DerivedCategory {
  slug: string;
  name: string;
}

interface CategoryRule extends DerivedCategory {
  /** Lowercased tag terms that identify this product type. */
  match: string[];
}

const PRIORITY: CategoryRule[] = [
  { slug: "stickers", name: "Stickers", match: ["stickers", "sticker"] },
  { slug: "candles", name: "Candles", match: ["candles", "candle", "scented candles", "candles -"] },
  { slug: "mugs", name: "Mugs", match: ["mugs", "mug", "coffee mugs"] },
  { slug: "backpacks", name: "Backpacks", match: ["backpacks", "backpack"] },
  { slug: "totes", name: "Tote Bags", match: ["tote bags", "totes", "tote bag", "tote"] },
  { slug: "bags", name: "Bags", match: ["bags", "bag"] },
  { slug: "hoodies", name: "Hoodies", match: ["hoodies", "hoodie"] },
  { slug: "sweatshirts", name: "Sweatshirts", match: ["sweatshirts", "sweatshirt", "crewnecks", "crewneck"] },
  { slug: "t-shirts", name: "T-Shirts", match: ["t-shirts", "t-shirt", "tshirts", "tshirt", "tee shirts"] },
];

/**
 * A tag identifies a category when it is the term itself, ends with the term
 * as a standalone word ("Vinyl Stickers" → stickers), or the term is a
 * standalone word inside the tag ("Coffee Mugs" → mugs).
 */
function tagMatches(tag: string, rule: CategoryRule): boolean {
  const lower = tag.toLowerCase();
  for (const term of rule.match) {
    if (lower === term) return true;
    if (lower.endsWith(` ${term}`) || lower.endsWith(`-${term}`)) return true;
    const words = lower.split(/[^a-z0-9]+/).filter(Boolean);
    if (words.length > 1 && words.includes(term)) return true;
  }
  return false;
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "other"
  );
}

/**
 * Deterministically assign a product type category from its real tags.
 * Matches the most specific known product type first; if none matches, falls
 * back to the first tag and finally to "Other".
 */
export function deriveCategoryForProduct(tags: string[]): DerivedCategory {
  for (const rule of PRIORITY) {
    if (tags.some((tag) => tagMatches(tag, rule))) {
      return { slug: rule.slug, name: rule.name };
    }
  }

  if (tags.length > 0) {
    return { slug: slugify(tags[0]), name: tags[0] };
  }
  return { slug: "other", name: "Other" };
}

export interface CategorySummary extends DerivedCategory {
  productCount: number;
}

export function summarizeCategories(
  products: Array<{ tags: string[]; minPriceMinor: number }>,
): CategorySummary[] {
  const groups = new Map<string, { name: string; slug: string; count: number }>();
  for (const product of products) {
    const category = deriveCategoryForProduct(product.tags);
    const current = groups.get(category.slug);
    if (current) {
      current.count += 1;
    } else {
      groups.set(category.slug, { ...category, count: 1 });
    }
  }
  return [...groups.values()]
    .map(({ name, slug, count }) => ({ name, slug, productCount: count }))
    .sort((a, b) => b.productCount - a.productCount);
}