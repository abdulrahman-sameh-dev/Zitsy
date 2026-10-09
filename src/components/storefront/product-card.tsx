import Image from "next/image";
import Link from "next/link";

import { deriveCategoryForProduct } from "@/lib/catalog/categories";
import { formatMoney } from "@/lib/money";
import type { ProductSummary } from "@/lib/catalog/query";

/**
 * Editorial product card — a soft green "print tile".
 *
 * Image handling: every mockup in the catalogue is square (1200×1200) with the
 * garment/artwork centred on white, so the card keeps a square surface and
 * renders the image with `object-contain` inside a small float inset. The
 * artwork is never cropped to `cover`, and the inset is real breathing room
 * (applied to an inner wrapper — not padding on the tile, which `Image fill`
 * would ignore). Different product types therefore keep their natural
 * composition instead of being forced into an identical crop.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  const category = deriveCategoryForProduct(product.tags);
  const fromPrice = product.minPriceMinor > 0;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-[0_14px_30px_-18px_rgba(3,46,21,0.35)] focus-visible:outline-brand-700"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-brand-50">
        {product.imageSrc ? (
          <div className="absolute inset-[6%]">
            <Image
              src={product.imageSrc}
              alt={product.title}
              fill
              priority={priority}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-contain transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-brand-700">
          {category.name}
        </p>
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-ink">
          {product.title}
        </h3>
        <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
          {fromPrice ? (
            <p className="text-sm font-semibold text-brand-800">
              {formatMoney(product.minPriceMinor, product.currency)}
            </p>
          ) : null}
          <span className="inline-flex translate-y-[1px] items-center gap-1 text-xs font-medium text-brand-700 transition-transform duration-200 group-hover:-translate-y-px group-hover:text-brand-800">
            View
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
            >
              <path d="M4 10h11" />
              <path d="m11 6 4 4-4 4" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}