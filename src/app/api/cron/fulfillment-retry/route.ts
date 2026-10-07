import { verifyCronAuth } from "@/lib/cron/auth";
import { db } from "@/lib/db/prisma";
import { fulfillPaidOrder } from "@/lib/fulfillment/service";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Recovery sweep for paid orders whose Printify submission failed transiently
 * (429 / 5xx → `printify_unavailable`). Fulfillment has no queue, so without
 * this a paid order could sit in PENDING forever even though every dependency
 * has recovered.
 *
 * Deliberately narrow: ambiguous creates (`ambiguous_create`, where the request
 * may or may not have reached Printify) are never recreated automatically —
 * they are reconciled by the existing create path and otherwise wait for
 * support, which is what the customer-facing message says. Data problems
 * (missing variant, invalid address) are excluded for the same reason: retrying
 * cannot fix them.
 *
 * `fulfillPaidOrder` is idempotent (an existing Printify id is never replaced)
 * and never throws, so a sweep can never double-submit an order.
 */
const RETRYABLE_ERROR_PREFIX = "printify_unavailable:";
const MAX_ATTEMPTS = 10;
const BATCH_SIZE = 20;

export async function GET(request: Request): Promise<Response> {
  const auth = verifyCronAuth(request);
  if (!auth.ok) {
    return Response.json(
      { ok: false, error: auth.message },
      { status: auth.status },
    );
  }

  try {
    const stuck = await db.order.findMany({
      where: {
        status: "PAID",
        printifyOrderId: null,
        fulfillmentAttempts: { lt: MAX_ATTEMPTS },
        fulfillmentError: { startsWith: RETRYABLE_ERROR_PREFIX },
      },
      select: { id: true, orderNumber: true },
      orderBy: { updatedAt: "asc" },
      take: BATCH_SIZE,
    });

    let succeeded = 0;
    let failed = 0;
    for (const order of stuck) {
      const result = await fulfillPaidOrder(order.id);
      if (result.status === "failed") {
        failed += 1;
        log.warn("fulfillment retry failed", {
          orderId: order.id,
          code: result.code,
        });
      } else {
        succeeded += 1;
      }
    }

    return Response.json({
      ok: true,
      checked: stuck.length,
      succeeded,
      failed,
    });
  } catch (err) {
    log.error("cron fulfillment retry failed", { err });
    return Response.json(
      { ok: false, error: "retry failed" },
      { status: 500 },
    );
  }
}
