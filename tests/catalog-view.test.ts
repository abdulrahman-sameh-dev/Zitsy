import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  getCategorySummaries,
  getFeaturedProducts,
  getVisibleProductBySlug,
  listProductSummaries,
  listProductsByCategorySlug,
  listSitemapProducts,
} from "@/lib/catalog/query";
import { syncCatalog } from "@/lib/catalog/sync";
import { db } from "@/lib/db/prisma";
import { pricingFromCost } from "@/lib/pricing";
import { PrintifyClient } from "@/lib/printify/client";
import type { PrintifyProduct } from "@/lib/printify/types";

const mug: PrintifyProduct = {
  id: "PRD-V1",
  title: "Test Classic Mug",
  description: "A mug for tests",
  tags: ["Mugs"],
  visible: true,
  blueprint_id: 68,
  print_provider_id: 9,
  options: [{ name: "Sizes", type: "size", values: [{ id: 301, title: "11oz" }, { id: 302, title: "15oz" }] }],
  variants: [
    { id: 5001, sku: "V1-11", price: 860, cost: 860, is_enabled: true, is_default: true, is_available: true, options: [301] },
    { id: 5002, sku: "V1-15", price: 900, cost: 900, is_enabled: true, is_default: false, is_available: true, options: [302] },
  ],
  images: [
    { src: "https://images-api.printify.com/mockup/v1-11.jpg", variant_ids: [5001], is_default: false },
    { src: "https://images-api.printify.com/mockup/v1-15.jpg", variant_ids: [5002], is_default: true },
  ],
};

const tote: PrintifyProduct = {
  id: "PRD-V2",
  title: "Test Tote Bag",
  description: "A tote for tests",
  tags: ["Tote Bags"],
  visible: true,
  blueprint_id: 12,
  print_provider_id: 3,
  options: [{ name: "Colors", type: "color", values: [{ id: 401, title: "Natural" }, { id: 402, title: "Black" }] }],
  variants: [
    { id: 6001, sku: "V2-N", price: 1500, cost: 1500, is_enabled: true, is_default: true, is_available: true, options: [401] },
    { id: 6002, sku: "V2-B", price: 1500, cost: 1500, is_enabled: true, is_default: false, is_available: true, options: [402] },
  ],
  images: [{ src: "https://images-api.printify.com/mockup/v2.jpg", variant_ids: [6001, 6002], is_default: true }],
};

const hidden: PrintifyProduct = {
  id: "PRD-V3",
  title: "Test Hidden Sticker",
  description: "",
  tags: ["Stickers"],
  visible: false,
  blueprint_id: 1,
  print_provider_id: 1,
  options: [{ name: "Sticker size", type: "size", values: [{ id: 501, title: "3 Inch" }] }],
  variants: [
    { id: 7001, sku: "V3", price: 500, cost: 500, is_enabled: true, is_default: true, is_available: true, options: [501] },
  ],
  images: [{ src: "https://images-api.printify.com/mockup/v3.jpg", is_default: true }],
};

beforeAll(async () => {
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ data: [mug, tote, hidden], next_page_url: null }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  await db.catalogSyncRun.deleteMany();
  await db.product.deleteMany();
  await syncCatalog(new PrintifyClient({ token: "tok", shopId: "shop-1" }));
});

describe("catalog queries (integration)", () => {
  it("lists only visible products for the storefront", async () => {
    const products = await listProductSummaries();
    const slugs = products.map((p) => p.slug).sort();
    expect(slugs).toEqual(["test-classic-mug", "test-tote-bag"]);
    for (const product of products) {
      expect(product.imageSrc).toContain("images-api.printify.com");
      expect(product.title).toBeTruthy();
    }
  });

  it("loads a product view with real option dimensions and variants", async () => {
    const view = await getVisibleProductBySlug("test-classic-mug");
    expect(view).not.toBeNull();
    expect(view?.dims.map((d) => d.name)).toEqual(["Sizes"]);
    expect(view?.dims[0].values.map((v) => v.title)).toEqual(["11oz", "15oz"]);
    expect(view?.variants).toHaveLength(2);
    expect(view?.availableVariantCount).toBe(2);
    expect(view?.images).toHaveLength(2);
  });

  it("returns null for hidden or unknown slugs", async () => {
    expect(await getVisibleProductBySlug("test-hidden-sticker")).toBeNull();
    expect(await getVisibleProductBySlug("no-such-product")).toBeNull();
  });

  it("derives bundled categories with real counts", async () => {
    const categories = await getCategorySummaries();
    expect(categories).toEqual([
      { slug: "mugs", name: "Mugs", productCount: 1, imageSrc: expect.any(String) },
      { slug: "totes", name: "Tote Bags", productCount: 1, imageSrc: expect.any(String) },
    ].sort((a, b) => b.productCount - a.productCount));
  });

  it("filters products by derived category slug", async () => {
    const totes = await listProductsByCategorySlug("totes");
    expect(totes.map((p) => p.slug)).toEqual(["test-tote-bag"]);
    expect(await listProductsByCategorySlug("stickers")).toEqual([]);
  });

  it("features the cheapest visible product from each category", async () => {
    const featured = await getFeaturedProducts(6);
    expect(featured.map((p) => p.slug)).toEqual(["test-classic-mug", "test-tote-bag"]);
    expect(featured[0].minPriceMinor).toBe(pricingFromCost(860)!.priceMinor);
  });

  it("exposes visible products for the sitemap", async () => {
    const entries = await listSitemapProducts();
    expect(entries.map((e) => e.slug).sort()).toEqual(["test-classic-mug", "test-tote-bag"]);
    expect(entries[0].updatedAt).toBeInstanceOf(Date);
  });
});