import { PrintifyApiError } from "@/lib/printify/client";
import type {
  PrintifyCreateOrderRequest,
  PrintifyOrder,
  PrintifyOrderGateway,
  PrintifyOrderList,
  PrintifyShipment,
  PrintifyShippingCosts,
  PrintifyShippingRequest,
} from "@/lib/printify/types";

/** A deterministic in-memory Printify order gateway for fulfillment tests. */
export class FakePrintify implements PrintifyOrderGateway {
  readonly createCalls: PrintifyCreateOrderRequest[] = [];
  readonly getCalls: string[] = [];
  readonly sendToProductionCalls: string[] = [];
  readonly listCalls: Array<{ page: number; limit: number }> = [];

  orderId: string;
  status: string;
  createError: Error | null = null;
  sendError: Error | null = null;
  listError: Error | null = null;
  /** Orders returned by listOrders (used for external_id reconciliation). */
  orders: PrintifyOrder[] = [];
  shipments: PrintifyShipment[] = [];
  /** Total shipping Printify books for created/fetched orders (source currency). */
  totalShipping?: number;

  constructor(init?: { id?: string; status?: string }) {
    this.orderId = init?.id ?? "PFY-ORDER-1";
    this.status = init?.status ?? "pending";
  }

  async createOrder(body: PrintifyCreateOrderRequest): Promise<PrintifyOrder> {
    this.createCalls.push(body);
    if (this.createError) throw this.createError;
    return {
      id: this.orderId,
      status: this.status,
      external_id: body.external_id ?? null,
      address_to: body.address_to,
      line_items: body.line_items,
      total_shipping: this.totalShipping,
      shipments: this.shipments,
      sent_to_production_at: null,
      fulfilled_at: null,
    };
  }

  async getOrder(orderId: string): Promise<PrintifyOrder> {
    this.getCalls.push(orderId);
    return {
      id: orderId,
      status: this.status,
      total_shipping: this.totalShipping,
      shipments: this.shipments,
    };
  }

  async sendToProduction(orderId: string): Promise<PrintifyOrder> {
    this.sendToProductionCalls.push(orderId);
    if (this.sendError) throw this.sendError;
    this.status = "sending-to-production";
    return { id: orderId, status: this.status };
  }

  async listOrders(page = 1, limit = 10): Promise<PrintifyOrderList> {
    this.listCalls.push({ page, limit });
    if (this.listError) throw this.listError;
    const start = (page - 1) * limit;
    return {
      data: this.orders.slice(start, start + limit),
      next_page_url: null,
      total: this.orders.length,
    };
  }
}

/** A deterministic Printify shipping gateway for quote/checkout tests. */
export class FakeShipping {
  readonly calls: PrintifyShippingRequest[] = [];
  /** Standard shipping rate, in the Printify source currency (USD minor). */
  standard = 1039;
  error: Error | null = null;

  async getShippingCosts(body: PrintifyShippingRequest): Promise<PrintifyShippingCosts> {
    this.calls.push(body);
    if (this.error) throw this.error;
    return {
      standard: this.standard,
      economy: this.standard,
      express: this.standard * 2,
    };
  }
}

export const printifyErrors = {
  timeout: () => new PrintifyApiError("timed out", 0, "https://api.printify.com"),
  server: () => new PrintifyApiError("server error", 500, "https://api.printify.com"),
  rateLimited: () =>
    new PrintifyApiError("rate limited", 429, "https://api.printify.com"),
  rejected: () =>
    new PrintifyApiError("bad request", 400, "https://api.printify.com"),
  unauthorized: () =>
    new PrintifyApiError("unauthorized", 401, "https://api.printify.com"),
};