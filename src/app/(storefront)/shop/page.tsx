import { ProductCard } from "@/components/storefront/product-card";
import {
  getCategorySummaries,
  listProductSummaries,
  listProductsByCategorySlug,
} from "@/lib/catalog/query";

function plural(count: number): string {
  return count === 1 ? "product" : "products";
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { category } = await searchParams;
  const categorySlug = typeof category === "string" ? category : undefined;

  const [categories, allProducts, products] = await Promise.all([
    getCategorySummaries(),
    listProductSummaries(),
    categorySlug ? listProductsByCategorySlug(categorySlug) : Promise.resolve([]),
  ]);

  const shown = categorySlug ? products : allProducts;
  const activeCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <div className="flex flex-col gap-10 py-12">
      {/* Category filter bar */}
      <div className="container-page">
        <nav aria-label="Product categories" className="flex flex-wrap items-center gap-2">
          <a
            href="/shop"
            className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand-400"
          >
            All products
          </a>
          {categories.map((item) => (
            <a
              key={item.slug}
              href={`/shop?category=${encodeURIComponent(item.slug)}`}
              aria-current={item.slug === categorySlug ? "page" : undefined}
              className={
                item.slug === categorySlug
                  ? "rounded-full border border-brand-600 bg-brand-600 px-4 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-line bg-surface px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand-400"
              }
            >
              {item.name}
            </a>
          ))}
        </nav>
      </div>

      {/* Heading */}
      <div className="container-page">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {activeCategory ? activeCategory.name : "All products"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {activeCategory
            ? `${shown.length} ${plural(shown.length)} in this category, printed to order.`
            : `${shown.length} ${plural(shown.length)}, printed to order.`}
        </p>
      </div>

      {/* Grid or empty state */}
      {shown.length > 0 ? (
        <div className="container-page">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shown.map((product, index) => (
              <ProductCard key={product.slug} product={product} priority={index === 0} />
            ))}
          </div>
        </div>
      ) : (
        <div className="container-page">
          <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-ink">No products here yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
              This category is empty right now. New products will appear here
              automatically once they are published to the catalogue.
            </p>
            <a
              href="/shop"
              className="mt-6 inline-block rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
            >
              Browse all products
            </a>
          </div>
        </div>
      )}
    </div>
  );
}