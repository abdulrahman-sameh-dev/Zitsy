import {
  appUrl,
  emailFrom,
  integrations,
  resendApiUrl,
  supportEmail,
} from "@/lib/config/env";
import { log } from "@/lib/log";

export interface EmailConfig {
  /** Resend + sender identity configured and links point at the real site. */
  enabled: boolean;
  /** Store-side recipient configured (admin notifications, contact form). */
  supportEnabled: boolean;
  from: string;
  supportRecipient: string;
  /** Canonical public application URL used by every link inside an email. */
  baseUrl: string;
  /** Test-only Resend API override; empty means the real Resend API. */
  apiBaseUrl: string;
}

const LOCAL_HOST = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i;

function canonicalBaseUrl(): string {
  const base = appUrl();
  if (LOCAL_HOST.test(base) && process.env.NODE_ENV === "production") {
    // §23: production email links must never be localhost. Refusing to send is
    // safer than silently shipping links a customer cannot open.
    log.error("email disabled: NEXT_PUBLIC_APP_URL points at localhost in production");
    return "";
  }
  return base;
}

export function emailConfig(): EmailConfig {
  const base = canonicalBaseUrl();
  return {
    enabled: integrations.email && base.length > 0,
    supportEnabled: integrations.support && base.length > 0,
    from: emailFrom(),
    supportRecipient: supportEmail(),
    baseUrl: base,
    apiBaseUrl: resendApiUrl(),
  };
}

/** Absolute URL on the canonical application origin (never localhost in prod). */
export function absoluteUrl(path: string): string {
  const base = appUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function contactUrl(): string {
  return absoluteUrl("/contact");
}
