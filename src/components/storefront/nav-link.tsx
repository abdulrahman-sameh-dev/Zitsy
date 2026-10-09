"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  exact = false,
  hideOnMobile = false,
  children,
}: {
  href: string;
  /** Match only the exact path (for the homepage). */
  exact?: boolean;
  hideOnMobile?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? `rounded-md px-2.5 py-2 text-sm font-semibold text-brand-800 sm:px-3 ${hideOnMobile ? "hidden sm:inline-flex" : "inline-flex"}`
          : `rounded-md px-2.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-brand-50 hover:text-brand-800 sm:px-3 ${hideOnMobile ? "hidden sm:inline-flex" : "inline-flex"}`
      }
    >
      {children}
    </Link>
  );
}