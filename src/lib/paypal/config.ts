import { serverEnv } from "@/lib/config/env";

/** Only payment provider for the MVP. */
export const PAYPAL_PROVIDER = "paypal";

export const PAYPAL_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com";
export const PAYPAL_LIVE_BASE_URL = "https://api-m.paypal.com";

export function paypalBaseUrl(): string {
  return serverEnv.PAYPAL_ENVIRONMENT === "production"
    ? PAYPAL_LIVE_BASE_URL
    : PAYPAL_SANDBOX_BASE_URL;
}

/** Server-side API calls are possible (client id + secret present). */
export function isPaypalConfigured(): boolean {
  return Boolean(serverEnv.PAYPAL_CLIENT_ID && serverEnv.PAYPAL_CLIENT_SECRET);
}

/** Webhook signature verification is possible (needs the registered webhook id). */
export function isPaypalWebhookConfigured(): boolean {
  return isPaypalConfigured() && Boolean(serverEnv.PAYPAL_WEBHOOK_ID);
}