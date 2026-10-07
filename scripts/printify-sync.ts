import "dotenv/config";

import { syncCatalog } from "../src/lib/catalog/sync";
import { appUrl, integrations } from "../src/lib/config/env";
import { db } from "../src/lib/db/prisma";
import { getPrintifyClient } from "../src/lib/printify/client";
import { ensurePrintifyWebhooks } from "../src/lib/printify/webhooks";

async function main(): Promise<void> {
  if (!integrations.printify) {
    console.error(
      "Printify is not configured. Set PRINTIFY_API_TOKEN and PRINTIFY_SHOP_ID in .env",
    );
    process.exit(1);
  }

  const client = getPrintifyClient();

  if (integrations.printifyWebhooks) {
    const webhookUrl = `${appUrl()}/api/webhooks/printify`;
    try {
      const result = await ensurePrintifyWebhooks(client, webhookUrl);
      console.log(
        `Webhooks reconciled against ${webhookUrl}: created=${result.created.join(",") || "-"} updated=${result.updated.join(",") || "-"}`,
      );
    } catch (err) {
      console.error("Webhook reconciliation failed (continuing with sync):", err);
    }
  } else {
    console.log("Webhooks skipped: PRINTIFY_WEBHOOK_SECRET not set.");
  }

  const summary = await syncCatalog(client);
  console.log(
    `Sync done: ${summary.productsSeen} seen, ${summary.productsUpserted} upserted, ${summary.productsHidden} hidden, ${summary.errors.length} errors`,
  );

  await db.$disconnect();
  process.exit(summary.errors.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});