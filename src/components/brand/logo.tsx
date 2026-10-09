import Link from "next/link";

import { site } from "@/lib/config/public-env";

export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <rect x="1" y="1" width="46" height="46" rx="10.5" fill="currentColor" />
      <path
        d="M13.5 16.5h21L13.5 31.5h21"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="37.5" cy="10.5" r="1.9" fill="#f0fdf4" />
    </svg>
  );
}

export function Logo({
  tone = "dark",
  showTagline = false,
  href,
  className,
}: {
  /** "light" renders the wordmark for on-dark surfaces; "dark" for on-light. */
  tone?: "dark" | "light";
  showTagline?: boolean;
  href?: string;
  className?: string;
}) {
  const wordmarkColor = tone === "light" ? "text-canvas" : "text-ink";
  const taglineColor = tone === "light" ? "text-muted-light" : "text-muted";

  const content = (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9 shrink-0 text-brand-700" />
      <span className="flex flex-col leading-none">
        <span
          className={`font-display text-[1.35rem] font-bold tracking-tight ${wordmarkColor}`}
        >
          {site.name}
        </span>
        {showTagline ? (
          <span className={`mt-1 text-xs ${taglineColor}`}>{site.tagline}</span>
        ) : null}
      </span>
    </span>
  );

  if (href) {
    return (
      <Link href={href} aria-label={`${site.name} — ${site.tagline}`} className={className}>
        {content}
      </Link>
    );
  }
  return <span className={className}>{content}</span>;
}