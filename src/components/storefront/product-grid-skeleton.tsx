import { cn } from "@/lib/utils";

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="overflow-hidden rounded-xl border border-line bg-surface"
          aria-hidden="true"
        >
          <div className="aspect-square animate-pulse bg-canvas" />
          <div className="space-y-2 p-4">
            <div className={cn("h-3 rounded bg-canvas", index % 2 === 0 ? "w-3/4" : "w-1/2")} />
            <div className="h-3 w-1/3 rounded bg-canvas" />
          </div>
        </div>
      ))}
    </div>
  );
}