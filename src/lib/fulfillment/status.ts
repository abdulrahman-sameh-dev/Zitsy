import type { FulfillmentStatus } from "@/generated/prisma/enums";

/**
 * Printify exposes statuses as hyphenated strings (sometimes underscored in
 * older payloads). Map them onto Zitsy's own forward-only fulfillment enum.
 * Unknown values degrade to ACTION_REQUIRED so an operator can look at them
 * instead of silently losing the state.
 */
const PRINTIFY_STATUS_MAP: Record<string, FulfillmentStatus> = {
  pending: "SUBMITTED",
  "on-hold": "ON_HOLD",
  "sending-to-production": "SENDING_TO_PRODUCTION",
  "in-production": "IN_PRODUCTION",
  "partially-fulfilled": "PARTIALLY_FULFILLED",
  fulfilled: "FULFILLED",
  canceled: "CANCELLED",
  cancelled: "CANCELLED",
  "has-issues": "ACTION_REQUIRED",
  "not-connected": "ACTION_REQUIRED",
  "payment-not-received": "UNFULFILLABLE",
};

/** Normalize provider status: trim, lowercase, hyphens/underscores unified. */
export function normalizePrintifyStatus(raw: string): string {
  return raw.trim().toLowerCase().replace(/_/g, "-");
}

/** Map a raw Printify status string onto Zitsy's FulfillmentStatus. */
export function mapPrintifyStatus(raw: string | null | undefined): FulfillmentStatus {
  if (!raw) return "PENDING";
  return PRINTIFY_STATUS_MAP[normalizePrintifyStatus(raw)] ?? "ACTION_REQUIRED";
}

/**
 * Rank for forward-only progression. Higher never regresses to lower, except
 * terminal states and explicit problem states which always win.
 */
const RANK: Record<FulfillmentStatus, number> = {
  PENDING: 0,
  SUBMITTED: 1,
  ON_HOLD: 2,
  SENDING_TO_PRODUCTION: 3,
  IN_PRODUCTION: 4,
  PARTIALLY_FULFILLED: 5,
  FULFILLED: 6,
  CANCELLED: 7,
  ACTION_REQUIRED: 8,
  UNFULFILLABLE: 9,
};

const TERMINAL: ReadonlySet<FulfillmentStatus> = new Set([
  "FULFILLED",
  "CANCELLED",
  "UNFULFILLABLE",
]);

/** A status that requires a human to look at it. */
export function isProblemStatus(status: FulfillmentStatus): boolean {
  return status === "ACTION_REQUIRED" || status === "UNFULFILLABLE";
}

export function isTerminalFulfillment(status: FulfillmentStatus): boolean {
  return TERMINAL.has(status);
}

/**
 * Forward-only merge. Problem/terminal states always take effect so a human is
 * never silently ignored; otherwise a lower-ranked status never overwrites a
 * higher one (webhooks can arrive out of order).
 */
export function mergeFulfillmentStatus(
  current: FulfillmentStatus,
  incoming: FulfillmentStatus,
): FulfillmentStatus {
  if (isTerminalFulfillment(current)) return current;
  if (isProblemStatus(incoming) || isTerminalFulfillment(incoming)) return incoming;
  if (isProblemStatus(current)) return current;
  return RANK[incoming] >= RANK[current] ? incoming : current;
}

const LABELS: Record<FulfillmentStatus, string> = {
  PENDING: "Preparing your order",
  SUBMITTED: "Order received",
  ON_HOLD: "Order on hold",
  SENDING_TO_PRODUCTION: "Sending to production",
  IN_PRODUCTION: "In production",
  PARTIALLY_FULFILLED: "Partially shipped",
  FULFILLED: "Shipped",
  CANCELLED: "Cancelled",
  ACTION_REQUIRED: "Needs attention",
  UNFULFILLABLE: "Unable to fulfill",
};

export function fulfillmentLabel(status: FulfillmentStatus): string {
  return LABELS[status];
}