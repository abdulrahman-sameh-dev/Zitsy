import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductView } from "@/components/storefront/product-view";
import { deriveCategoryForProduct } from "@/lib/catalog/categories";
import { getVisibleProductBySlug } from "@/lib/catalog/query";
import { site } from "@/lib/config/public-env";
import { toDecimalString } from "@/lib/money";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getVisibleProductBySlug(slug);
  if (!product) return {};
  const image = product.images[0]?.src;
  return {
    title: product.title,
    description: product.description || undefined,
    alternates: { canonical: `${site.url}/product/${product.slug}` },
    openGraph: {
      title: product.title,
      description: product.description || undefined,
      url: `${site.url}/product/${product.slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getVisibleProductBySlug(slug);
  if (!product) notFound();

  const category = deriveCategoryForProduct(product.tags);
  const inStock = product.availableVariantCount > 0;
  const firstImage = product.images[0]?.src;

  const structured = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    ...(product.description ? { description: product.description } : {}),
    ...(firstImage ? { image: [firstImage] } : {}),
    url: `${site.url}/product/${product.slug}`,
    offers: {
      "@type": "Offer",
      ...(product.minPriceMinor > 0
        ? {
            price: toDecimalString(product.minPriceMinor),
            priceCurrency: product.currency,
          }
        : {}),
      availability: inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: `${site.url}/product/${product.slug}`,
    },
  };

  return (
    <div className="container-page flex flex-col gap-10 py-10 sm:py-14">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/shop" className="transition-colors hover:text-brand-700">
              Shop
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href={`/shop?category=${encodeURIComponent(category.slug)}`}
              className="transition-colors hover:text-brand-700"
            >
              {category.name}
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink">
            {product.title}
          </li>
        </ol>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <ProductView product={product} />

        {/* Description */}
        <div className="order-last flex flex-col gap-8 lg:order-none">
          {product.description ? (
            <section
              aria-labelledby="description-heading"
              className="prose-none rounded-xl border border-line bg-surface p-6"
            >
              <h2
                id="description-heading"
                className="text-sm font-semibold uppercase tracking-wide text-muted"
              >
                About this product
              </h2>
              <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink">
                {product.description}
              </div>
            </section>
          ) : null}

          {product.tags.length > 0 ? (
            <section aria-labelledby="tags-heading">
              <h2
                id="tags-heading"
                className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted"
              >
                Tags
              </h2>
              <ul className="flex flex-wrap gap-2">
                {product.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, "\\u003c"),
        }}
      />
    </div>
  );
}