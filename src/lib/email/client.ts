import { Resend } from "resend";

import { serverEnv } from "@/lib/config/env";

import { emailConfig } from "./config";
import { EmailSendError } from "./errors";

/** A fully rendered message. Templates are rendered before anything is sent. */
export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a reply goes — used so the store can answer a contact form. */
  replyTo?: string;
}

export interface EmailTransport {
  send(
    email: OutboundEmail,
    options: { idempotencyKey: string },
  ): Promise<{ id: string | null }>;
}

/**
 * The only place the Resend SDK is touched. Kept free of template and business
 * logic so tests can substitute a transport without touching any caller.
 *
 * `RESEND_API_URL` (optional, test-only) points the SDK at a local stub so
 * automated runs can never reach a real recipient.
 */
export function getEmailTransport(): EmailTransport {
  return {
    async send(email, options) {
      const cfg = emailConfig();
      const client = new Resend(
        serverEnv.RESEND_API_KEY,
        cfg.apiBaseUrl ? { baseUrl: cfg.apiBaseUrl } : undefined,
      );

      const { data, error } = await client.emails.send(
        {
          from: cfg.from,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        },
        // Second, provider-level defence: Resend itself drops retries that
        // arrive with the same key.
        { idempotencyKey: options.idempotencyKey },
      );

      if (error) throw new EmailSendError(error.message);
      return { id: data?.id ?? null };
    },
  };
}
