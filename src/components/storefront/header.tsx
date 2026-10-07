import Link from "next/link";

import { loadCartCount } from "@/lib/cart/read";
import { site } from "@/lib/config/public-env";

function CartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
    >
      <path d="M6 6h15l-1.5 9h-13L4 3H2" />
      <circle cx="9" cy="20" r="1.4" transform="translate(0,-1)" />
      <circle cx="19" cy="20" r="1.4" transform="translate(0,-1)" />
    </svg>
  );
}

export async function Header() {
  const cartCount = await loadCartCount();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${site.name} home`}>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-sm font-extrabold text-white">
            Z
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight text-ink">{site.name}</span>
            <span className="hidden text-xs text-muted sm:inline">{site.tagline}</span>
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <Link
            href="/"
            className="rounded-md px-2.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-800 sm:px-3"
          >
            Home
          </Link>
          <Link
            href="/shop"
            className="rounded-md px-2.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand-800 sm:px-3"
          >
            Shop
          </Link>
        </nav>

        <Link
          href="/cart"
          aria-label={
            cartCount > 0 ? `Cart, ${cartCount} items` : "Cart, empty"
          }
          className="relative flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors hover:bg-brand-50 hover:text-brand-800"
        >
          <CartIcon />
          {cartCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-xs font-bold text-white"
            >
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          ) : null}
        </Link>
      </div>
    </header>
  );
}