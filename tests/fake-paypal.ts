import type {
  PaypalCapture,
  PaypalCreateOrderInput,
  PaypalGateway,
  PaypalOrder,
} from "@/lib/paypal/types";

export const CUSTOMER = {
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  country: "GB",
  address1: "1 Analytical Engine Way",
  city: "London",
  postalCode: "EC1A 1BB",
  phone: "+447700900000",
} as const;

export function completedCapture(value: string, currency = "GBP"): PaypalCapture {
  return {
    id: "CAP-1",
    status: "COMPLETED",
    amount: { currency_code: currency, value },
  };
}

export function completedOrder(
  orderId: string,
  referenceId: string,
  value: string,
  currency = "GBP",
): PaypalOrder {
  return {
    id: orderId,
    status: "COMPLETED",
    purchase_units: [
      {
        reference_id: referenceId,
        custom_id: referenceId,
        amount: { currency_code: currency, value },
        payments: { captures: [completedCapture(value, currency)] },
      },
    ],
  };
}

/**
 * Deterministic in-memory PayPal. `captureOrder`/`getOrder` return whatever the
 * factory builds, so tests control the authoritative response PayPal would send.
 */
export class FakePaypal implements PaypalGateway {
  readonly created: PaypalCreateOrderInput[] = [];
  readonly captureRequests: string[] = [];
  paypalOrderId = "PP-ORDER-1";
  captureError: Error | null = null;
  private createdCount = 0;
  private readonly build: (paypalOrderId: string) => PaypalOrder;

  constructor(build: (paypalOrderId: string) => PaypalOrder) {
    this.build = build;
  }

  async createOrder(input: PaypalCreateOrderInput): Promise<PaypalOrder> {
    this.created.push(input);
    this.createdCount += 1;
    const id =
      this.createdCount === 1
        ? this.paypalOrderId
        : `${this.paypalOrderId}-${this.createdCount}`;
    return {
      id,
      status: "CREATED",
      purchase_units: [
        {
          reference_id: input.referenceId,
          custom_id: input.customId,
          amount: input.amount,
        },
      ],
    };
  }

  async captureOrder(paypalOrderId: string, requestId?: string) {
    this.captureRequests.push(`${paypalOrderId}:${requestId ?? ""}`);
    if (this.captureError) throw this.captureError;
    return this.build(paypalOrderId);
  }

  async getOrder(paypalOrderId: string): Promise<PaypalOrder> {
    return this.build(paypalOrderId);
  }

  async verifyWebhookSignature(): Promise<{ verification_status: string }> {
    return { verification_status: "SUCCESS" };
  }
}