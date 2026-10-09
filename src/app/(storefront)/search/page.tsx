import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import { getCategorySummaries } from "@/lib/catalog/query";
import { searchVisibleProducts } from "@/lib/catalog/search";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Zitsy catalogue.",
  robots: { index: false, follow: true },
};

function plural(count: number): string {
  return count === 1 ? "product" : "products";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";

  const [results, categories] = await Promise.all([
    query ? searchVisibleProducts(query) : [],
    getCategorySummaries(),
  ]);

  return (
    <div className="flex flex-col gap-10 py-12">
      <div className="container-page">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Search
        </h1>
        <p className="mt-2 text-sm text-muted">
          Search the catalogue by title, description or tag.
        </p>

        <form action="/search" method="get" role="search" className="mt-6 max-w-xl">
          <label htmlFor="search-input" className="sr-only">
            Search products
          </label>
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 focus-within:border-brand-500">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 shrink-0 text-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="search-input"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Try “hoodie”, “tote” or “mug”"
              autoComplete="off"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-brand-700 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {query.length === 0 ? (
        <div className="container-page">
          <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-ink">What are you looking for?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              Search by title, tag or description — for example “hoodie”,
              “Black Ink” or “canvas tote”.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {categories.slice(0, 5).map((category) => (
                <Link
                  key={category.slug}
                  href={`/shop?category=${encodeURIComponent(category.slug)}`}
                  className="chip"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div className="container-page">
          <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-ink">
              No products match “{query}”
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              Try a different word, or browse the full catalogue below.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/search" className="btn-secondary">
                Clear search
              </Link>
              <Link href="/shop" className="btn-primary">
                Browse all products
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="container-page">
          <p className="mb-4 text-sm text-muted">
            {results.length} {plural(results.length)} matching “{query}”
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.map((product, index) => (
              <ProductCard key={product.slug} product={product} priority={index === 0} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}