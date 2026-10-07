import { PrintifyApiError } from "@/lib/printify/client";

export type FulfillmentErrorCode =
  | "order_not_found"
  | "order_not_paid"
  | "payment_not_completed"
  | "no_items"
  | "invalid_variant"
  | "unsupported_country"
  | "invalid_address"
  | "already_submitted"
  | "not_submitted"
  | "printify_unavailable"
  | "printify_rejected"
  | "ambiguous_create";

const MESSAGES: Record<FulfillmentErrorCode, string> = {
  order_not_found: "We could not find that order.",
  order_not_paid: "This order has not been paid.",
  payment_not_completed: "This order has no completed payment.",
  no_items: "This order has no items to fulfill.",
  invalid_variant:
    "An item in this order can no longer be fulfilled. Support has been notified.",
  unsupported_country: "We can only fulfill orders to the UK and Germany.",
  invalid_address: "The delivery address is incomplete and cannot be fulfilled.",
  already_submitted: "This order has already been submitted to Printify.",
  not_submitted: "This order has not been submitted to Printify yet.",
  printify_unavailable:
    "Fulfillment is temporarily unavailable. We will retry automatically.",
  printify_rejected:
    "Printify rejected this order. Support has been notified.",
  ambiguous_create:
    "Fulfillment is being confirmed. We will not resubmit automatically.",
};

/** A classified fulfillment failure. Never carries secrets or raw provider data. */
export class FulfillmentError extends Error {
  readonly code: FulfillmentErrorCode;
  readonly userMessage: string;
  /** Whether a naive retry could succeed (rate limit / temporary outage). */
  readonly retryable: boolean;

  constructor(code: FulfillmentErrorCode, retryable = false) {
    super(code);
    this.name = "FulfillmentError";
    this.code = code;
    this.userMessage = MESSAGES[code];
    this.retryable = retryable;
  }
}

export interface ClassifiedPrintifyError {
  code: FulfillmentErrorCode;
  retryable: boolean;
  /**
   * True when the request may have reached Printify and produced an order, so
   * retrying could duplicate it. Such creates must be reconciled first.
   */
  ambiguous: boolean;
  /** Short, secret-free classification for logs / persisted fulfillmentError. */
  detail: string;
}

/**
 * Classify a Printify API failure. Distinguishes validation (terminal),
 * authentication/configuration (operational), rate limit (retryable), and
 * network/timeout/5xx (retryable *and* ambiguous — the order may have been
 * created before the failure).
 */
export function classifyPrintifyError(err: unknown): ClassifiedPrintifyError {
  if (err instanceof PrintifyApiError) {
    const status = err.status;
    if (status === 0) {
      return {
        code: "ambiguous_create",
        retryable: true,
        ambiguous: true,
        detail: "network_error_or_timeout",
      };
    }
    if (status === 401 || status === 403) {
      return {
        code: "printify_unavailable",
        retryable: false,
        ambiguous: false,
        detail: `auth_error_${status}`,
      };
    }
    if (status === 429) {
      return {
        code: "printify_unavailable",
        retryable: true,
        ambiguous: false,
        detail: "rate_limited",
      };
    }
    if (status >= 500) {
      return {
        code: "printify_unavailable",
        retryable: true,
        ambiguous: true,
        detail: `server_error_${status}`,
      };
    }
    return {
      code: "printify_rejected",
      retryable: false,
      ambiguous: false,
      detail: `validation_error_${status}`,
    };
  }
  return {
    code: "printify_unavailable",
    retryable: true,
    ambiguous: false,
    detail: err instanceof Error ? err.name : "unknown_error",
  };
}