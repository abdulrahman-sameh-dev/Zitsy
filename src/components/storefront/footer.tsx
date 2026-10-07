import Link from "next/link";

import { site } from "@/lib/config/public-env";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-lg font-bold tracking-tight text-ink">{site.name}</p>
          <p className="mt-1 text-sm text-muted">{site.tagline}</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
            Print-on-demand products, printed and fulfilled when you order.
            Prices in GBP. Markets supported: GB and DE.
          </p>
        </div>

        <nav aria-label="Footer">
          <p className="text-sm font-semibold text-ink">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/" className="text-muted transition-colors hover:text-brand-700">
                Home
              </Link>
            </li>
            <li>
              <Link href="/shop" className="text-muted transition-colors hover:text-brand-700">
                All products
              </Link>
            </li>
            <li>
              <Link href="/cart" className="text-muted transition-colors hover:text-brand-700">
                Cart
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Help">
          <p className="text-sm font-semibold text-ink">Help</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/track-order"
                className="text-muted transition-colors hover:text-brand-700"
              >
                Track Order
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                className="text-muted transition-colors hover:text-brand-700"
              >
                Contact Us
              </Link>
            </li>
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold text-ink">Good to know</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>Products are printed to order — production takes a few days.</li>
            <li>Delivery regions: United Kingdom and Germany.</li>
            <li>Payments are handled securely at checkout.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-1 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {site.name}. All rights reserved.
          </p>
          <p>Currency: GBP</p>
        </div>
      </div>
    </footer>
  );
}