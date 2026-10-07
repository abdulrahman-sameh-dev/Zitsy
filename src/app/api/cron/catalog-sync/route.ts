import { syncCatalog } from "@/lib/catalog/sync";
import { verifyCronAuth } from "@/lib/cron/auth";
import { log } from "@/lib/log";
import { getPrintifyClient } from "@/lib/printify/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled catalog reconciliation. Printify product webhooks keep the catalog
 * fresh in near-real-time; this cron is the safety net that converges any drift
 * (missed webhooks, changed prices/costs, deleted products) on a schedule.
 *
 * Secured with a shared secret (see `verifyCronAuth`).
 */
export async function GET(request: Request): Promise<Response> {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.message },
      { status: auth.status },
    );
  }

  try {
    const summary = await syncCatalog(getPrintifyClient());
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    log.error("cron catalog sync failed", { err });
    return Response.json({ ok: false, error: "sync failed" }, { status: 500 });
  }
}
