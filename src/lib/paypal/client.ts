import { serverEnv } from "@/lib/config/env";

import { paypalBaseUrl } from "./config";
import type { PaypalOrder } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;

function bodyName(body: unknown): string {
  if (body && typeof body === "object" && "name" in body) {
    return String((body as { name?: unknown }).name ?? "");
  }
  return "";
}

export class PayPalApiError extends Error {
  readonly status: number;
  /** PayPal error machine name, e.g. `ORDER_ALREADY_CAPTURED`. */
  readonly paypalName: string;
  readonly body: unknown;

  constructor(message: string, status: number, paypalName: string, body?: unknown) {
    super(message);
    this.name = "PayPalApiError";
    this.status = status;
    this.paypalName = paypalName;
    this.body = body;
  }
}

export class PayPalClient {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private tokenCache: { value: string; expiresAt: number } | null = null;

  constructor(opts: {
    clientId: string;
    clientSecret: string;
    baseUrl?: string;
    timeoutMs?: number;
  }) {
    if (!opts.clientId || !opts.clientSecret) {
      throw new Error("PayPalClient requires a client id and secret");
    }
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.baseUrl = (opts.baseUrl ?? paypalBaseUrl()).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      throw new PayPalApiError(
        aborted ? `PayPal request timed out: ${url}` : `PayPal request failed: ${url}`,
        0,
        aborted ? "TIMEOUT" : "NETWORK",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private async parseBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  private throwApiError(response: Response, body: unknown, url: string): never {
    const detail =
      body && typeof body === "object" && "message" in body
        ? String((body as { message?: unknown }).message)
        : undefined;
    throw new PayPalApiError(
      detail ?? `PayPal API error (${response.status}) for ${url}`,
      response.status,
      bodyName(body),
      body,
    );
  }

  /** OAuth2 client-credentials grant, cached until shortly before expiry. */
  async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now) {
      return this.tokenCache.value;
    }

    const basic = Buffer.from(
      `${this.clientId}:${this.clientSecret}`,
    ).toString("base64");
    const response = await this.fetchWithTimeout(
      `${this.baseUrl}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      },
    );

    const body = await this.parseBody(response);
    if (!response.ok) this.throwApiError(response, body, "oauth2/token");

    const token = (body as { access_token?: string }).access_token;
    const expiresIn = Number((body as { expires_in?: number }).expires_in ?? 0);
    if (!token) {
      throw new PayPalApiError("PayPal token response missing access_token", 0, "TOKEN");
    }
    this.tokenCache = {
      value: token,
      expiresAt: now + Math.max(expiresIn - 30, 30) * 1000,
    };
    return token;
  }

  private async request<T>(
    path: string,
    opts: { method: "GET" | "POST"; body?: unknown; requestId?: string },
  ): Promise<T> {
    const token = await this.accessToken();
    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: opts.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(opts.requestId ? { "PayPal-Request-Id": opts.requestId } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const body = await this.parseBody(response);
    if (!response.ok) this.throwApiError(response, body, path);
    return body as T;
  }

  createOrder(input: {
    referenceId: string;
    customId: string;
    description?: string;
    amount: { currency_code: string; value: string };
  }): Promise<PaypalOrder> {
    return this.request<PaypalOrder>("/v2/checkout/orders", {
      method: "POST",
      body: {
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: input.referenceId,
            custom_id: input.customId,
            description: input.description,
            amount: input.amount,
          },
        ],
      },
    });
  }

  captureOrder(paypalOrderId: string, requestId?: string): Promise<PaypalOrder> {
    return this.request<PaypalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      { method: "POST", body: {}, requestId },
    );
  }

  getOrder(paypalOrderId: string): Promise<PaypalOrder> {
    return this.request<PaypalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
      { method: "GET" },
    );
  }

  verifyWebhookSignature(input: {
    transmissionId: string;
    transmissionTime: string;
    certUrl: string;
    authAlgo: string;
    transmissionSig: string;
    webhookId: string;
    webhookEvent: unknown;
  }): Promise<{ verification_status: string }> {
    return this.request<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: {
          transmission_id: input.transmissionId,
          transmission_time: input.transmissionTime,
          cert_url: input.certUrl,
          auth_algo: input.authAlgo,
          transmission_sig: input.transmissionSig,
          webhook_id: input.webhookId,
          webhook_event: input.webhookEvent,
        },
      },
    );
  }
}

export function getPayPalClient(): PayPalClient {
  if (!serverEnv.PAYPAL_CLIENT_ID || !serverEnv.PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "PayPal is not configured: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required",
    );
  }
  return new PayPalClient({
    clientId: serverEnv.PAYPAL_CLIENT_ID,
    clientSecret: serverEnv.PAYPAL_CLIENT_SECRET,
  });
}