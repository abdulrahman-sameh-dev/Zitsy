import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/generated/prisma/enums";
import { appUrl } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import { fulfillmentLabel } from "@/lib/fulfillment/status";
import { countryName } from "@/lib/markets";

/** 192 bits of entropy, base64url encoded (32 characters). */
const TOKEN_BYTES = 24;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const ORDER_NUMBER_PATTERN = /^ZS-[A-Z0-9]{4,16}$/;

type TrackingOrder = Prisma.OrderGetPayload<{
  include: {
    items: { include: { product: { include: { images: true } } } };
    payment: true;
  };
}>;

const TRACKING_INCLUDE = {
  items: { include: { product: { include: { images: true } } } },
  payment: true,
} satisfies Prisma.OrderInclude;

export function generateTrackingToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Cheap pre-query guard so random junk never reaches the database. */
export function isValidTrackingToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

/**
 * Normalizes customer input to the stored format. Returns null when the input
 * cannot possibly be an order number (the caller must answer generically).
 */
export function normalizeOrderNumber(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  const withPrefix = cleaned.startsWith("ZS-") ? cleaned : `ZS-${cleaned}`;
  return ORDER_NUMBER_PATTERN.test(withPrefix) ? withPrefix : null;
}

export function trackUrlForToken(token: string): string {
  return `${appUrl()}/track-order/${token}`;
}

/**
 * Idempotently assign the order's tracking token. Tokens are generated once
 * per order and are never derived from the order number (§10).
 */
export async function ensureTrackingToken(orderId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const order = await db.order.findUnique({
      where: { id: orderId },
      select: { trackingToken: true },
    });
    if (!order) return null;
    if (order.trackingToken) return order.trackingToken;

    const token = generateTrackingToken();
    try {
      await db.order.updateMany({
        where: { id: orderId, trackingToken: null },
        data: { trackingToken: token },
      });
    } catch (err) {
      // Unique collision on the token itself (practically impossible) — retry.
      if (
        !(err instanceof Error) ||
        !("code" in err) ||
        (err as { code?: string }).code !== "P2002"
      ) {
        throw err;
      }
    }
  }
  const final = await db.order.findUnique({
    where: { id: orderId },
    select: { trackingToken: true },
  });
  return final?.trackingToken ?? null;
}

/** Login-free order lookup straight from the secure email link. */
export async function findOrderByTrackingToken(token: string): Promise<TrackingOrder | null> {
  if (!isValidTrackingToken(token)) return null;
  return db.order.findUnique({
    where: { trackingToken: token },
    include: TRACKING_INCLUDE,
  });
}

/**
 * Manual lookup: BOTH the order number and the customer email must match.
 * Callers must not distinguish "no such order" from "wrong email" (§11).
 */
export async function lookupOrderByNumberAndEmail(
  orderNumberInput: string,
  emailInput: string,
): Promise<TrackingOrder | null> {
  const orderNumber = normalizeOrderNumber(orderNumberInput);
  const email = emailInput.trim().toLowerCase();
  if (!orderNumber || !email) return null;

  return db.order.findFirst({
    where: {
      orderNumber,
      email: { equals: email, mode: "insensitive" },
    },
    include: TRACKING_INCLUDE,
  });
}

export interface TrackingItemView {
  title: string;
  variantTitle: string;
  quantity: number;
  unitPriceMinor: number;
  totalPriceMinor: number;
  imageUrl: string | null;
}

export interface TrackingStep {
  key: "confirmed" | "preparing" | "shipped" | "delivered";
  label: string;
  state: "done" | "current" | "todo";
  at: Date | null;
}

export interface TrackingView {
  orderNumber: string;
  placedAt: Date;
  paidAt: Date | null;
  statusLabel: string;
  paymentLabel: string;
  fulfillmentLabel: string;
  steps: TrackingStep[];
  items: TrackingItemView[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  currency: string;
  destination: { city: string; countryName: string };
  tracking: { carrier: string | null; number: string | null; url: string | null } | null;
  lastUpdated: Date;
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Order received",
  PAYMENT_PENDING: "Awaiting payment",
  PAID: "Confirmed",
  PAYMENT_FAILED: "Payment failed",
  FULFILLMENT_PENDING: "Preparing",
  IN_PRODUCTION: "Preparing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Awaiting payment",
  COMPLETED: "Paid",
  FAILED: "Payment failed",
  CANCELLED: "Payment cancelled",
};

function resolveImageUrl(src: string | null): string | null {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/")) return `${appUrl()}${src}`;
  return null;
}

function buildSteps(order: TrackingOrder): TrackingStep[] {
  const raw: Array<{
    key: TrackingStep["key"];
    label: string;
    done: boolean;
    at: Date | null;
  }> = [
    {
      key: "confirmed",
      label: "Order confirmed",
      done: order.status === "PAID" || Boolean(order.paidAt),
      at: order.paidAt,
    },
    {
      key: "preparing",
      label: "Preparing your order",
      done: Boolean(order.printifySubmittedAt) || order.fulfillmentStatus !== "PENDING",
      at: order.printifySubmittedAt,
    },
    {
      key: "shipped",
      label: "Shipped",
      done:
        Boolean(order.trackingNumber || order.trackingUrl) ||
        order.fulfillmentStatus === "FULFILLED",
      at: order.printifyFulfilledAt,
    },
    {
      key: "delivered",
      label: "Delivered",
      done: Boolean(order.deliveredAt),
      at: order.deliveredAt,
    },
  ];

  const firstOpen = raw.findIndex((step) => !step.done);
  return raw.map((step, index) => ({
    key: step.key,
    label: step.label,
    at: step.at,
    state: step.done
      ? ("done" as const)
      : index === firstOpen
        ? ("current" as const)
        : ("todo" as const),
  }));
}

/**
 * Customer-facing projection of the existing source of truth (§12, §19).
 * Deliberately omits database ids, PayPal/Printify references, cost and profit.
 */
export function toTrackingView(order: TrackingOrder): TrackingView {
  const country = countryName(order.country);
  return {
    orderNumber: order.orderNumber,
    placedAt: order.placedAt ?? order.createdAt,
    paidAt: order.paidAt,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    paymentLabel: PAYMENT_LABELS[order.payment?.status ?? "PENDING"],
    fulfillmentLabel: fulfillmentLabel(order.fulfillmentStatus as FulfillmentStatus),
    steps: buildSteps(order),
    items: order.items.map((item) => ({
      title: item.title,
      variantTitle: item.variantTitle,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      totalPriceMinor: item.totalPriceMinor,
      imageUrl: item.product.images.length
        ? resolveImageUrl(
            (item.product.images.find((image) => image.isDefault) ?? item.product.images[0])
              .src,
          )
        : null,
    })),
    subtotalMinor: order.subtotalMinor,
    shippingMinor: order.shippingMinor,
    totalMinor: order.totalMinor,
    currency: order.currency,
    destination: { city: order.city, countryName: country },
    tracking: order.trackingNumber || order.trackingUrl
      ? {
          carrier: order.trackingCarrier,
          number: order.trackingNumber,
          url: order.trackingUrl,
        }
      : null,
    lastUpdated: order.printifyLastSyncedAt ?? order.updatedAt,
  };
}
