export default function ProductLoading() {
  return (
    <div className="container-page flex flex-col gap-8 py-10 sm:py-14">
      <div className="h-5 w-64 animate-pulse rounded bg-canvas-deep" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square w-full animate-pulse rounded-xl bg-canvas-deep" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 animate-pulse rounded bg-canvas-deep" />
          <div className="h-6 w-28 animate-pulse rounded bg-canvas-deep" />
          <div className="h-10 w-full animate-pulse rounded bg-canvas-deep" />
          <div className="h-10 w-full animate-pulse rounded bg-canvas-deep" />
          <div className="h-12 w-full animate-pulse rounded bg-brand-700/30" />
        </div>
      </div>
    </div>
  );
}