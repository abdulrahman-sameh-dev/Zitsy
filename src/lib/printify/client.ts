import { serverEnv } from "@/lib/config/env";

import type {
  PrintifyCreateOrderRequest,
  PrintifyOrder,
  PrintifyOrderList,
  PrintifyProduct,
  PrintifyProductList,
  PrintifyShippingCosts,
  PrintifyShippingRequest,
  PrintifyWebhook,
} from "./types";

const DEFAULT_BASE_URL = "https://api.printify.com/v1";
const DEFAULT_TIMEOUT_MS = 30_000;

export class PrintifyApiError extends Error {
  readonly status: number;
  readonly body: unknown;
  readonly url: string;

  constructor(message: string, status: number, url: string, body?: unknown) {
    super(message);
    this.name = "PrintifyApiError";
    this.status = status;
    this.body = body;
    this.url = url;
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export class PrintifyClient {
  private readonly token: string;
  private readonly shopId: string;
  private readonly baseUrl: string;
  private readonly userAgent: string;

  constructor(opts: {
    token: string;
    shopId: string;
    baseUrl?: string;
    userAgent?: string;
  }) {
    if (!opts.token) throw new Error("PrintifyClient requires an API token");
    if (!opts.shopId) throw new Error("PrintifyClient requires a shop id");
    this.token = opts.token;
    this.shopId = opts.shopId;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.userAgent = opts.userAgent ?? "ZitsyStore/1.0";
  }

  private buildUrl(
    path: string,
    params?: RequestOptions["params"],
  ): URL {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url;
  }

  private async request<T>(
    path: string,
    opts: RequestOptions = {},
  ): Promise<T> {
    const url = this.buildUrl(path, opts.params);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: opts.method ?? "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${this.token}`,
          "User-Agent": this.userAgent,
          ...(opts.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new PrintifyApiError(
        aborted ? `Printify request timed out: ${path}` : `Printify request failed: ${path}`,
        0,
        url.toString(),
      );
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!response.ok) {
      const detail =
        body && typeof body === "object" && "message" in (body as object)
          ? String((body as { message?: unknown }).message)
          : undefined;
      throw new PrintifyApiError(
        detail ?? `Printify API error (${response.status})`,
        response.status,
        url.toString(),
        body,
      );
    }

    return body as T;
  }

  listProducts(page = 1, perPage = 50): Promise<PrintifyProductList> {
    return this.request<PrintifyProductList>("/shops/{shop_id}/products.json".replace("{shop_id}", this.shopId), {
      params: { page, limit: perPage },
    });
  }

  async getAllProducts(): Promise<PrintifyProduct[]> {
    const products: PrintifyProduct[] = [];
    let page = 1;
    for (;;) {
      const result = await this.listProducts(page);
      products.push(...result.data);
      if (!result.next_page_url || result.data.length === 0) break;
      page += 1;
    }
    return products;
  }

  getProduct(productId: string): Promise<PrintifyProduct> {
    return this.request<PrintifyProduct>(
      `/shops/${this.shopId}/products/${productId}.json`,
    );
  }

  getShippingCosts(body: PrintifyShippingRequest): Promise<PrintifyShippingCosts> {
    return this.request<PrintifyShippingCosts>(
      `/shops/${this.shopId}/orders/shipping.json`,
      { method: "POST", body },
    );
  }

  createOrder(body: PrintifyCreateOrderRequest): Promise<PrintifyOrder> {
    return this.request<PrintifyOrder>(`/shops/${this.shopId}/orders.json`, {
      method: "POST",
      body,
    });
  }

  getOrder(orderId: string): Promise<PrintifyOrder> {
    return this.request<PrintifyOrder>(`/shops/${this.shopId}/orders/${orderId}.json`);
  }

  listOrders(page = 1, limit = 10): Promise<PrintifyOrderList> {
    return this.request<PrintifyOrderList>(`/shops/${this.shopId}/orders.json`, {
      params: { page, limit },
    });
  }

  async getAllOrders(maxPages = 20): Promise<PrintifyOrder[]> {
    const orders: PrintifyOrder[] = [];
    let page = 1;
    while (page <= maxPages) {
      const result = await this.listOrders(page);
      orders.push(...result.data);
      if (!result.next_page_url || result.data.length === 0) break;
      page += 1;
    }
    return orders;
  }

  sendToProduction(orderId: string): Promise<PrintifyOrder> {
    return this.request<PrintifyOrder>(
      `/shops/${this.shopId}/orders/${orderId}/send_to_production.json`,
      { method: "POST" },
    );
  }

  listWebhooks(): Promise<PrintifyWebhook[]> {
    return this.request<PrintifyWebhook[]>(`/shops/${this.shopId}/webhooks.json`);
  }

  createWebhook(opts: {
    topic: string;
    url: string;
  }): Promise<PrintifyWebhook> {
    return this.request<PrintifyWebhook>(`/shops/${this.shopId}/webhooks.json`, {
      method: "POST",
      body: opts,
    });
  }

  updateWebhook(webhookId: string, url: string): Promise<PrintifyWebhook> {
    return this.request<PrintifyWebhook>(
      `/shops/${this.shopId}/webhooks/${webhookId}.json`,
      { method: "PUT", body: { url } },
    );
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request<unknown>(`/shops/${this.shopId}/webhooks/${webhookId}.json`, {
      method: "DELETE",
    });
  }
}

export function getPrintifyClient(): PrintifyClient {
  if (!serverEnv.PRINTIFY_API_TOKEN || !serverEnv.PRINTIFY_SHOP_ID) {
    throw new Error(
      "Printify is not configured: PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID are required",
    );
  }
  return new PrintifyClient({
    token: serverEnv.PRINTIFY_API_TOKEN,
    shopId: serverEnv.PRINTIFY_SHOP_ID,
    userAgent: serverEnv.PRINTIFY_USER_AGENT || undefined,
  });
}