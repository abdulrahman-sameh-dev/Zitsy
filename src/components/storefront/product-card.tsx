import Image from "next/image";
import Link from "next/link";

import { formatMoney } from "@/lib/money";
import type { ProductSummary } from "@/lib/catalog/query";

export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductSummary;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-shadow focus-visible:outline-brand-600 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-canvas">
        {product.imageSrc ? (
          <Image
            src={product.imageSrc}
            alt={`${product.title}`}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            No image
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="line-clamp-2 text-sm font-medium text-ink">{product.title}</h3>
        {product.minPriceMinor > 0 ? (
          <p className="mt-auto pt-1 text-sm font-semibold text-brand-700">
            {formatMoney(product.minPriceMinor, product.currency)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}