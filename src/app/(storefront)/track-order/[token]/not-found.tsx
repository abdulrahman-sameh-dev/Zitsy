import Link from "next/link";

export default function TrackOrderNotFound() {
  return (
    <div className="container-page flex flex-col items-center gap-5 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        We couldn&apos;t find that order
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        This tracking link is no longer valid, or the address was typed
        incorrectly. Check the link in your order email, or look up your order
        with your order number.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/track-order"
          className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Track my order
        </Link>
        <Link
          href="/contact"
          className="rounded-md border border-line bg-surface px-6 py-3 text-sm font-semibold text-ink transition-colors hover:border-brand-400"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
}
