import { serverEnv } from "@/lib/config/env";

/** Raised by the transport when Resend (or its stub) rejects a send. */
export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailSendError";
  }
}

const SECRET_VALUES: Array<{ key: string; value: string | undefined }> = [
  { key: "RESEND_API_KEY", value: serverEnv.RESEND_API_KEY },
  { key: "DATABASE_URL", value: serverEnv.DATABASE_URL },
  { key: "AUTH_SECRET", value: serverEnv.AUTH_SECRET },
  { key: "PRINTIFY_API_TOKEN", value: serverEnv.PRINTIFY_API_TOKEN },
  { key: "PRINTIFY_WEBHOOK_SECRET", value: serverEnv.PRINTIFY_WEBHOOK_SECRET },
  { key: "PAYPAL_CLIENT_SECRET", value: serverEnv.PAYPAL_CLIENT_SECRET },
  { key: "PAYPAL_WEBHOOK_ID", value: serverEnv.PAYPAL_WEBHOOK_ID },
];

const PATTERN_SECRETS =
  /(re_[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9._~+/=-]+|(?:api[-_]?key|secret|token|password)["']?\s*[:=]\s*["']?[^\s"',}]+)/gi;

/**
 * Provider errors are written to `EmailLog.error` and to the server log, never
 * to a customer. Anything that could carry a credential is redacted first and
 * the result is capped so a hostile provider response cannot flood the log.
 */
export function sanitizeEmailError(err: unknown): string {
  const raw =
    err instanceof Error
      ? `${err.name}: ${err.message}`
      : typeof err === "string"
        ? err
        : "unknown email error";

  let message = raw.replace(/\s+/g, " ").trim();
  for (const secret of SECRET_VALUES) {
    if (secret.value && secret.value.length >= 6) {
      message = message.split(secret.value).join("[redacted]");
    }
  }
  message = message.replace(PATTERN_SECRETS, "[redacted]");
  return message.slice(0, 400);
}
