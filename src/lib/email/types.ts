/** Shared, provider-agnostic shape every order email renders from. */
export interface EmailOrderItem {
  title: string;
  variantTitle: string;
  quantity: number;
  unitPriceMinor: number;
  totalPriceMinor: number;
  imageUrl: string | null;
}

export interface OrderEmailAddress {
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
  countryName: string;
}

export interface OrderEmailTracking {
  carrier: string | null;
  number: string | null;
  url: string | null;
}

/**
 * Everything a template may show — and nothing it must not (no database ids,
 * no cost, no profit, no provider credentials).
 */
export interface OrderEmailModel {
  orderNumber: string;
  /** Paid date when known, otherwise the time the order was placed. */
  orderDate: Date;
  email: string;
  currency: string;
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
  /** Customer-facing fulfillment wording (never a raw enum). */
  statusLabel: string;
  /** Broad destination summary, e.g. "London, United Kingdom". */
  destination: string;
  /** Country-only destination for messages that show shipment facts. */
  destinationCountry: string;
  items: EmailOrderItem[];
  address: OrderEmailAddress;
  tracking: OrderEmailTracking | null;
  /** Secure login-free tracking URL (`/track-order/<token>`). */
  trackUrl: string;
  supportUrl: string;
  submittedAt: Date | null;
  deliveredAt: Date | null;
  /** Internal notification fields — never rendered for customers. */
  paypalOrderId: string | null;
  printifyOrderId: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
