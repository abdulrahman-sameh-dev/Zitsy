import { NextResponse, type NextRequest } from "next/server";

import { integrations, serverEnv } from "@/lib/config/env";
import { log } from "@/lib/log";
import { getPrintifyClient } from "@/lib/printify/client";
import { processPrintifyWebhook } from "@/lib/printify/handlers";
import type { PrintifyWebhookEvent } from "@/lib/printify/types";
import { verifyPrintifySignature } from "@/lib/printify/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!integrations.printifyWebhooks) {
    return NextResponse.json(
      { error: "Printify webhooks are not configured" },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-pfy-signature");
  const secret = serverEnv.PRINTIFY_WEBHOOK_SECRET!;

  if (!verifyPrintifySignature(rawBody, signature, secret)) {
    log.warn("printify webhook rejected: bad signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: PrintifyWebhookEvent;
  try {
    payload = JSON.parse(rawBody) as PrintifyWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const status = await processPrintifyWebhook(
      getPrintifyClient(),
      payload,
    );
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    log.error("printify webhook processing failed", { err });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}