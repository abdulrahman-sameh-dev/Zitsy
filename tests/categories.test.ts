import { describe, expect, it } from "vitest";

import {
  deriveCategoryForProduct,
  summarizeCategories,
} from "@/lib/catalog/categories";

describe("deriveCategoryForProduct", () => {
  it("matches a known product type tag exactly", () => {
    expect(deriveCategoryForProduct(["Stickers"])).toEqual({
      slug: "stickers",
      name: "Stickers",
    });
    expect(deriveCategoryForProduct(["Hoodies"])).toEqual({
      slug: "hoodies",
      name: "Hoodies",
    });
  });

  it("matches composite tag values by ending", () => {
    expect(deriveCategoryForProduct(["Sticker Shape", "Vinyl Stickers"])).toEqual({
      slug: "stickers",
      name: "Stickers",
    });
    expect(deriveCategoryForProduct(["Tote Bags"])).toEqual({
      slug: "totes",
      name: "Tote Bags",
    });
  });

  it("lets Tote Bags win over the generic Bags bucket", () => {
    expect(deriveCategoryForProduct(["Tote Bags", "Bags"]).slug).toBe("totes");
    expect(deriveCategoryForProduct(["Backpacks", "Bags"]).slug).toBe("backpacks");
    expect(deriveCategoryForProduct(["Bags"]).slug).toBe("bags");
  });

  it("falls back to the first real tag when nothing matches", () => {
    expect(deriveCategoryForProduct(["Vanilla Scent"])).toEqual({
      slug: "vanilla-scent",
      name: "Vanilla Scent",
    });
  });

  it("matches terms embedded in multi-word tags", () => {
    expect(deriveCategoryForProduct(["Coffee Mugs"]).slug).toBe("mugs");
    expect(deriveCategoryForProduct(["Crewneck"]).slug).toBe("sweatshirts");
  });

  it("returns Other only when there are no tags", () => {
    expect(deriveCategoryForProduct([])).toEqual({ slug: "other", name: "Other" });
  });
});

describe("summarizeCategories", () => {
  it("counts products per derived category and sorts by count", () => {
    const products = [
      { tags: ["Stickers"], minPriceMinor: 500 },
      { tags: ["Vinyl Stickers"], minPriceMinor: 700 },
      { tags: ["Mugs"], minPriceMinor: 860 },
      { tags: ["Tote Bags", "Bags"], minPriceMinor: 1500 },
    ];
    expect(summarizeCategories(products)).toEqual([
      { slug: "stickers", name: "Stickers", productCount: 2 },
      { slug: "mugs", name: "Mugs", productCount: 1 },
      { slug: "totes", name: "Tote Bags", productCount: 1 },
    ]);
  });

  it("returns an empty list for no products", () => {
    expect(summarizeCategories([])).toEqual([]);
  });
});