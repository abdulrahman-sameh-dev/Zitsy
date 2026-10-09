import { db } from "@/lib/db/prisma";
import type { ProductSummary } from "@/lib/catalog/query";

type SearchableProduct = {
  slug: string;
  title: string;
  minPriceMinor: number;
  currency: string;
  tags: string[];
  description: string;
  images: Array<{ src: string }>;
};

function toSummary(product: SearchableProduct): ProductSummary {
  return {
    slug: product.slug,
    title: product.title,
    minPriceMinor: product.minPriceMinor,
    currency: product.currency,
    tags: product.tags,
    imageSrc: product.images[0]?.src ?? null,
    imageAlt: product.title,
  };
}

/** Very small visible catalogue — filter in memory for reliable substring
 *  matching across title, description and tags (works offline). */
export async function searchVisibleProducts(query: string): Promise<ProductSummary[]> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 4);

  if (terms.length === 0) return [];

  const products = await db.product.findMany({
    where: { visible: true },
    select: {
      slug: true,
      title: true,
      description: true,
      minPriceMinor: true,
      currency: true,
      tags: true,
      images: { take: 1, orderBy: [{ isDefault: "desc" }, { position: "asc" }] },
    },
    orderBy: { title: "asc" },
  });

  return products
    .filter((product) => {
      const searchable = `${product.title} ${product.description} ${product.tags.join(" ")}`.toLowerCase();
      return terms.every((term) => searchable.includes(term));
    })
    .map(toSummary);
}