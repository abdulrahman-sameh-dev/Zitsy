import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";

import { ProductCard } from "@/components/storefront/product-card";
import { ProductGridSkeleton } from "@/components/storefront/product-grid-skeleton";
import { getCategorySummaries, getFeaturedProducts } from "@/lib/catalog/query";

async function FeaturedProducts() {
  await connection();
  const featured = await getFeaturedProducts(6);
  if (featured.length === 0) return null;
  return (
    <section className="container-page">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-2xl font-semibold tracking-tight text-ink">
          Featured products
        </h2>
        <Link
          href="/shop"
          className="text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          View all →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {featured.map((product, index) => (
          <ProductCard key={product.slug} product={product} priority={index === 0} />
        ))}
      </div>
    </section>
  );
}

function CategoryGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-line bg-surface"
        >
          <div className="aspect-[4/3] w-full animate-pulse bg-canvas" />
          <div className="p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-canvas" />
          </div>
        </div>
      ))}
    </div>
  );
}

async function CategoryGrid() {
  await connection();
  const categories = await getCategorySummaries();
  if (categories.length === 0) return null;
  return (
    <section className="container-page">
      <h2 className="mb-6 text-2xl font-semibold tracking-tight text-ink">
        Shop by category
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/shop?category=${encodeURIComponent(category.slug)}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas">
              {category.imageSrc ? (
                <Image
                  src={category.imageSrc}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : null}
            </div>
            <div className="flex items-center justify-between p-4">
              <span className="text-sm font-semibold text-ink">
                {category.name}
              </span>
              <span className="text-xs text-muted">
                {category.productCount}{" "}
                {category.productCount === 1 ? "item" : "items"}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-14 py-14">
      <section className="container-page">
        <div className="max-w-2xl">
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Products worth owning,
            <span className="text-brand-600"> made when you need them.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            T-shirts, mugs, stickers, candles, tote bags and more — printed to
            order and fulfilled by our production partners.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/shop"
              className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Shop everything
            </Link>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="container-page"><ProductGridSkeleton /></div>}>
        <FeaturedProducts />
      </Suspense>

      <Suspense fallback={<div className="container-page"><CategoryGridSkeleton /></div>}>
        <CategoryGrid />
      </Suspense>

      <section className="border-y border-line bg-surface">
        <div className="container-page grid gap-8 py-12 sm:grid-cols-3">
          <div>
            <h3 className="text-lg font-semibold text-ink">Printed to order</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Nothing sits in a warehouse. Your item is produced after you order,
              so nothing is wasted.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink">One place, many products</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Stickers, mugs, candles, apparel and more — with the real options
              each product is made in.
            </p>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink">Simple pricing</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Prices are shown in GBP. The price you see for a variant is the
              price you pay.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}