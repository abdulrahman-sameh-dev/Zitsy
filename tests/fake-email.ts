import type { EmailTransport, OutboundEmail } from "@/lib/email/client";

export interface CapturedEmail extends OutboundEmail {
  idempotencyKey: string;
}

/**
 * Deterministic in-memory email transport. Records every accepted send so tests
 * can assert on recipients, subjects, idempotency keys and rendered content.
 * It never touches the network — `tests/setup.ts` wires it in as the global
 * transport, mirroring the Printify client safety net.
 */
export class FakeEmailTransport implements EmailTransport {
  readonly sent: CapturedEmail[] = [];
  /** Fail the next send once (simulates a transient Resend outage). */
  failNext = false;
  /** Fail every send until cleared. */
  failAll = false;

  reset(): void {
    this.sent.length = 0;
    this.failNext = false;
    this.failAll = false;
  }

  async send(
    email: OutboundEmail,
    options: { idempotencyKey: string },
  ): Promise<{ id: string | null }> {
    if (this.failAll || this.failNext) {
      this.failNext = false;
      throw new Error("resend unavailable (test transport)");
    }
    this.sent.push({ ...email, idempotencyKey: options.idempotencyKey });
    return { id: `test-message-${this.sent.length}` };
  }
}

export const fakeEmail = new FakeEmailTransport();

/** A transport that always fails — for tests that inject `SendEmailDeps`. */
export const failingEmail: EmailTransport = {
  async send() {
    throw new Error("resend unavailable (injected transport)");
  },
};
