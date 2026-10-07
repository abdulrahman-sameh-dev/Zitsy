import { Prisma, type PrismaClient } from "@/generated/prisma/client";

import { storeCurrency } from "@/lib/config/env";
import { db } from "@/lib/db/prisma";
import { log } from "@/lib/log";
import { pricingFromCost } from "@/lib/pricing";
import type { PrintifyClient } from "@/lib/printify/client";
import type { PrintifyProduct } from "@/lib/printify/types";

import {
  toSlug,
  uniqueSlug,
  variantDisplayTitle,
  variantOptionTitle,
} from "./slug";

type Tx = Prisma.TransactionClient;

export interface SyncSummary {
  productsSeen: number;
  productsUpserted: number;
  productsHidden: number;
  errors: string[];
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Upsert one Printify product (and replace its images + variants) atomically.
 * Safe to call repeatedly — from the full sync, from a webhook, or from a retry.
 */
export async function upsertProductFromApi(
  product: PrintifyProduct,
  tx: Tx | PrismaClient = db,
): Promise<{ created: boolean }> {
  const currency = storeCurrency();
  const options = product.options ?? [];
  const variants = product.variants ?? [];
  // The advertised "From" price must be one a customer can actually buy, so
  // only variants that will be enabled, available and priced count towards it.
  const sellablePrices = variants
    .filter((v) => (v.is_enabled ?? true) && (v.is_available ?? true))
    .map((v) => pricingFromCost(v.cost))
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((p) => p.priceMinor);
  const minPriceMinor = sellablePrices.length > 0 ? Math.min(...sellablePrices) : 0;

  const existing = await tx.product.findUnique({
    where: { printifyId: product.id },
    select: { id: true, slug: true },
  });

  const slug = existing?.slug ?? (await uniqueSlug(toSlug(product.title), tx));

  const record = await tx.product.upsert({
    where: { printifyId: product.id },
    create: {
      printifyId: product.id,
      slug,
      title: product.title,
      description: product.description ?? "",
      tags: product.tags ?? [],
      options: options as unknown as Prisma.InputJsonValue,
      visible: product.visible ?? true,
      blueprintId: product.blueprint_id ?? null,
      printProviderId: product.print_provider_id ?? null,
      currency,
      minPriceMinor,
    },
    update: {
      title: product.title,
      description: product.description ?? "",
      tags: product.tags ?? [],
      options: options as unknown as Prisma.InputJsonValue,
      visible: product.visible ?? true,
      blueprintId: product.blueprint_id ?? null,
      printProviderId: product.print_provider_id ?? null,
      currency,
      minPriceMinor,
      syncedAt: new Date(),
    },
  });

  await tx.productImage.deleteMany({ where: { productId: record.id } });
  const images = product.images ?? [];
  if (images.length > 0) {
    await tx.productImage.createMany({
      data: images.map((img, pos) => ({
        productId: record.id,
        src: img.src,
        position: pos,
        isDefault: img.is_default ?? pos === 0,
        variantIds: img.variant_ids ?? [],
      })),
    });
  }

  // Variants are upserted by (productId, printifyVariantId) so their cuid is
  // stable across syncs — cart items and order items reference it. Variants
  // that disappear from Printify are disabled (not deleted) so existing cart
  // lines survive and can be surfaced as unavailable.
  const incomingIds = variants.map((v) => v.id);
  for (const variant of variants) {
    const pricing = pricingFromCost(variant.cost);
    const sellable = pricing !== null;
    if (!sellable) {
      log.warn("variant has no fulfillment cost; disabling", {
        productId: product.id,
        variantId: variant.id,
      });
    }
    const data = {
      title: variantDisplayTitle(options, variant),
      sku: variant.sku ?? null,
      priceMinor: pricing?.priceMinor ?? 0,
      costMinor: pricing?.costMinor ?? 0,
      currency,
      isEnabled: (variant.is_enabled ?? true) && sellable,
      isAvailable: (variant.is_available ?? true) && sellable,
      isDefault: variant.is_default ?? false,
      colorName: variantOptionTitle(options, variant, "color"),
      sizeName: variantOptionTitle(options, variant, "size"),
      optionValueIds: variant.options ?? [],
    };
    await tx.productVariant.upsert({
      where: {
        productId_printifyVariantId: {
          productId: record.id,
          printifyVariantId: variant.id,
        },
      },
      create: {
        productId: record.id,
        printifyVariantId: variant.id,
        ...data,
      },
      update: data,
    });
  }

  await tx.productVariant.updateMany({
    where: { productId: record.id, printifyVariantId: { notIn: incomingIds } },
    data: { isEnabled: false, isAvailable: false },
  });

  return { created: !existing };
}

/**
 * Full one-way sync from Printify to the storefront read model.
 * Products missing from the Printify catalog are hidden (not deleted) so
 * historic order references stay valid.
 */
export async function syncCatalog(
  client: PrintifyClient,
): Promise<SyncSummary> {
  // Overlap guard: never run two full syncs at once (scheduled + manual). A run
  // that has been "running" for over 30 minutes is treated as stale/crashed.
  const staleBefore = new Date(Date.now() - 30 * 60 * 1000);
  const active = await db.catalogSyncRun.findFirst({
    where: { type: "full", finishedAt: null, startedAt: { gt: staleBefore } },
    orderBy: { startedAt: "desc" },
  });
  if (active) {
    log.warn("catalog sync skipped: another run in progress", { runId: active.id });
    return {
      productsSeen: 0,
      productsUpserted: 0,
      productsHidden: 0,
      errors: ["skipped: sync already running"],
    };
  }

  const run = await db.catalogSyncRun.create({ data: { type: "full" } });
  const summary: SyncSummary = {
    productsSeen: 0,
    productsUpserted: 0,
    productsHidden: 0,
    errors: [],
  };

  try {
    const products = await client.getAllProducts();
    summary.productsSeen = products.length;
    const seenIds: string[] = [];

    for (const product of products) {
      try {
        await upsertProductFromApi(product);
        summary.productsUpserted += 1;
        seenIds.push(product.id);
      } catch (err) {
        summary.errors.push(`product ${product.id}: ${message(err)}`);
        log.error("product upsert failed", { productId: product.id, err });
      }
    }

    if (seenIds.length > 0) {
      const hidden = await db.product.updateMany({
        where: { printifyId: { notIn: seenIds }, visible: true },
        data: { visible: false, syncedAt: new Date() },
      });
      summary.productsHidden = hidden.count;
    }

    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "ok",
        productsSeen: summary.productsSeen,
        productsUpserted: summary.productsUpserted,
        finishedAt: new Date(),
      },
    });
  } catch (err) {
    await db.catalogSyncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: message(err).slice(0, 2000),
        productsSeen: summary.productsSeen,
        productsUpserted: summary.productsUpserted,
        finishedAt: new Date(),
      },
    });
    summary.errors.push(message(err));
    log.error("catalog sync failed", { runId: run.id, err });
  }

  log.info("catalog sync finished", summary as unknown as Record<string, unknown>);
  return summary;
}