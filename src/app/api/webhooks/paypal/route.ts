import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/config/env";
import { log } from "@/lib/log";
import { getPayPalClient } from "@/lib/paypal/client";
import { isPaypalWebhookConfigured } from "@/lib/paypal/config";
import type { PaypalWebhookEvent } from "@/lib/paypal/types";
import { processPaypalWebhook } from "@/lib/paypal/webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isPaypalWebhookConfigured()) {
    return NextResponse.json(
      { error: "PayPal webhooks are not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();

  let payload: PaypalWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as PaypalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const transmissionId = request.headers.get("paypal-transmission-id");
  const transmissionTime = request.headers.get("paypal-transmission-time");
  const transmissionSig = request.headers.get("paypal-transmission-sig");
  const certUrl = request.headers.get("paypal-cert-url");
  const authAlgo = request.headers.get("paypal-auth-algo");

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo
  ) {
    log.warn("paypal webhook rejected: missing transmission headers");
    return NextResponse.json({ error: "missing headers" }, { status: 400 });
  }

  try {
    const { verification_status } = await getPayPalClient().verifyWebhookSignature({
      transmissionId,
      transmissionTime,
      certUrl,
      authAlgo,
      transmissionSig,
      webhookId: serverEnv.PAYPAL_WEBHOOK_ID!,
      webhookEvent: payload,
    });

    if (verification_status !== "SUCCESS") {
      log.warn("paypal webhook rejected: bad signature", { verification_status });
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
  } catch (err) {
    log.error("paypal webhook verification failed", { err });
    return NextResponse.json({ error: "verification failed" }, { status: 500 });
  }

  try {
    const status = await processPaypalWebhook(payload, getPayPalClient());
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    log.error("paypal webhook processing failed", { err });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}