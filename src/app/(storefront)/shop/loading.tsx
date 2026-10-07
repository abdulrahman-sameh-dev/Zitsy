import { ProductGridSkeleton } from "@/components/storefront/product-grid-skeleton";

export default function StorefrontLoading() {
  return (
    <div className="flex flex-col gap-10 py-12">
      <div className="container-page space-y-3">
        <div className="h-8 w-64 animate-pulse rounded bg-canvas" />
        <div className="h-4 w-40 animate-pulse rounded bg-canvas" />
      </div>
      <div className="container-page">
        <ProductGridSkeleton />
      </div>
    </div>
  );
}