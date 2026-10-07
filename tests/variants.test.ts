import { describe, expect, it } from "vitest";

import type { ProductVariantRecord, Selection } from "@/lib/catalog/variants";
import {
  availableValueIdsForDim,
  buildOptionDims,
  hasDistinctPrices,
  isOrderableVariant,
  isSellableVariant,
  minPriceMinor,
  orderableVariants,
  resolveVariant,
  selectedPriceMinor,
} from "@/lib/catalog/variants";
import type { RawOptionDim, SellableVariantRecord } from "@/lib/catalog/variants";

function variant(
  id: number,
  optionValueIds: number[],
  price: number,
  extra: Partial<SellableVariantRecord> = {},
): SellableVariantRecord {
  return {
    id: `v-${id}`,
    printifyVariantId: id,
    title: optionValueIds.join("/"),
    priceMinor: price,
    costMinor: 500,
    currency: "GBP",
    isEnabled: true,
    isAvailable: true,
    optionValueIds,
    ...extra,
  };
}

describe("buildOptionDims", () => {
  it("preserves real dimension names (never renames Scent to Color)", () => {
    const options: RawOptionDim[] = [
      { name: "Scent", type: "scent", values: [{ id: 1, title: "Vanilla" }] },
      { name: "Size", type: "size", values: [{ id: 2, title: "8oz" }] },
    ];
    const dims = buildOptionDims(options, [variant(1000, [1, 2], 900)]);
    expect(dims.map((d) => d.name)).toEqual(["Scent", "Size"]);
  });

  it("keeps only values that exist in real variants", () => {
    const options: RawOptionDim[] = [
      {
        name: "Colors",
        type: "color",
        values: [
          { id: 10, title: "Black" },
          { id: 11, title: "Purple" },
        ],
      },
    ];
    const dims = buildOptionDims(options, [variant(1000, [10], 900)]);
    expect(dims[0].values).toEqual([{ valueId: 10, title: "Black" }]);
  });

  it("drops dimensions with no real values; returns [] for no options", () => {
    expect(buildOptionDims(null, [variant(1, [], 500)])).toEqual([]);
    expect(buildOptionDims([], [variant(1, [], 500)])).toEqual([]);
    const dims = buildOptionDims(
      [{ name: "Sizes", type: "size", values: [{ id: 7, title: "M" }] }],
      [variant(1, [999], 500)],
    );
    expect(dims).toHaveLength(0);
  });

  const colors: RawOptionDim = {
    name: "Colors",
    type: "color",
    values: [
      { id: 10, title: "Black" },
      { id: 11, title: "White" },
      { id: 12, title: "Red" },
      { id: 13, title: "Blue" },
      { id: 14, title: "Green" },
    ],
  };

  it("does not offer colors that only exist on disabled variants", () => {
    const dims = buildOptionDims(
      [colors],
      [
        variant(1, [10], 900), // Black sellable
        variant(2, [11], 900, { isEnabled: false }), // White disabled
        variant(3, [12], 900, { isAvailable: false }), // Red unavailable
      ],
    );
    expect(dims[0].values.map((v) => v.title)).toEqual(["Black"]);
  });

  it("does not offer values from variants without a usable cost", () => {
    const dims = buildOptionDims(
      [colors],
      [variant(1, [10], 900, { costMinor: 0 }), variant(2, [11], 900)],
    );
    expect(dims[0].values.map((v) => v.title)).toEqual(["White"]);
  });

  it("keeps every value of a sellable variant while dropping dead ones", () => {
    const dims = buildOptionDims(
      [colors],
      [
        variant(1, [10], 900),
        variant(2, [11], 900),
        variant(3, [12], 900, { isEnabled: false }),
        variant(4, [13], 900, { isEnabled: false }),
        variant(5, [14], 900, { isEnabled: false }),
      ],
    );
    expect(dims[0].values.map((v) => v.title)).toEqual(["Black", "White"]);
  });

  it("keeps raw values when nothing is sellable so an unavailable product still shows its options", () => {
    const dims = buildOptionDims(
      [colors],
      [variant(1, [10], 900, { isEnabled: false })],
    );
    expect(dims[0].values.map((v) => v.title)).toEqual(["Black"]);
  });

  it("works for dimensions other than Color/Size (scent, sticker shape)", () => {
    const options: RawOptionDim[] = [
      {
        name: "Scents",
        type: "scent",
        values: [
          { id: 21, title: "Vanilla" },
          { id: 22, title: "Coconut" },
          { id: 23, title: "Lavender" },
        ],
      },
      { name: "Size", type: "size", values: [{ id: 24, title: "9oz" }] },
    ];
    const dims = buildOptionDims(options, [
      variant(1, [21, 24], 900),
      variant(2, [22, 24], 900, { isEnabled: false }),
      variant(3, [23, 24], 900, { isAvailable: false }),
    ]);
    expect(dims.map((d) => d.name)).toEqual(["Scents", "Size"]);
    expect(dims[0].values.map((v) => v.title)).toEqual(["Vanilla"]);
    expect(dims[1].values.map((v) => v.title)).toEqual(["9oz"]);
  });
});

describe("availableValueIdsForDim", () => {
  it("disables combinations that do not exist as enabled variants", () => {
    const variants = [
      variant(1, [101, 1189], 3000), // Black 11oz
      variant(2, [102, 1189], 3200, { isEnabled: false }), // White 11oz disabled
      variant(3, [101, 1190], 3300), // Black 15oz
    ];
    const selection: Selection = { Sizes: 1189 };
    const colors = availableValueIdsForDim(
      "Colors",
      [101, 102],
      selection,
      variants,
    );
    expect([...colors].sort()).toEqual([101]);
  });

  it("keeps values free when nothing else is selected", () => {
    const variants = [variant(1, [101, 1189], 3000), variant(2, [102, 1190], 3200)];
    const colors = availableValueIdsForDim("Colors", [101, 102], {}, variants);
    expect([...colors].sort()).toEqual([101, 102]);
  });

  it("falls back to all variants when no variant is orderable", () => {
    const variants = [variant(1, [101], 3000, { isEnabled: false })];
    const colors = availableValueIdsForDim("Colors", [101], {}, variants);
    expect([...colors]).toEqual([101]);
  });

  it("updates compatible values for the other option (Black: S/M/L, White: M/L)", () => {
    // Color ids 10=Black 11=White, size ids 1=S 2=M 3=L
    const variants = [
      variant(1, [10, 1], 900),
      variant(2, [10, 2], 900),
      variant(3, [10, 3], 900),
      variant(4, [11, 2], 900),
      variant(5, [11, 3], 900),
    ];
    const colors = [10, 11];
    const sizes = [1, 2, 3];

    expect([...availableValueIdsForDim("Sizes", sizes, { Colors: 10 }, variants)].sort()).toEqual([1, 2, 3]);
    expect([...availableValueIdsForDim("Sizes", sizes, { Colors: 11 }, variants)].sort()).toEqual([2, 3]);
    expect([...availableValueIdsForDim("Colors", colors, { Sizes: 1 }, variants)].sort()).toEqual([10]);
    expect([...availableValueIdsForDim("Colors", colors, { Sizes: 3 }, variants)].sort()).toEqual([10, 11]);
  });

  it("never marks an incompatible combination as available", () => {
    const variants = [variant(1, [10, 2], 900), variant(2, [11, 3], 900)];
    // White (11) has no small (1)
    expect(availableValueIdsForDim("Sizes", [1, 2, 3], { Colors: 11 }, variants).has(1)).toBe(false);
    expect(resolveVariant(variants, { Colors: 11, Sizes: 1 }, ["Colors", "Sizes"])).toBeNull();
  });
});

describe("resolveVariant", () => {
  const variants = [
    variant(1, [101, 1189], 3000),
    variant(2, [102, 1189], 3200),
    variant(3, [101, 1190], 3300),
  ];

  it("resolves an exact combination", () => {
    expect(resolveVariant(variants, { Colors: 102, Sizes: 1189 })?.priceMinor).toBe(3200);
  });

  it("returns null for an empty or partial selection when dimensions are known", () => {
    const dims = ["Colors", "Sizes"];
    expect(resolveVariant(variants, {})).toBeNull();
    expect(resolveVariant(variants, { Colors: 101 }, dims)).toBeNull();
  });

  it("returns null when the combination does not exist", () => {
    expect(resolveVariant(variants, { Colors: 102, Sizes: 1190 })).toBeNull();
  });

  it("prefers an exact variant over a superset match", () => {
    const supersets = [variant(1, [101, 1189], 3000), variant(2, [101, 1189, 777], 3100)];
    expect(resolveVariant(supersets, { Colors: 101, Sizes: 1189 })?.id).toBe("v-1");
  });

  it("resolves the exact Printify variant id for the complete combination", () => {
    const resolved = resolveVariant(variants, { Colors: 102, Sizes: 1189 }, ["Colors", "Sizes"]);
    expect(resolved?.printifyVariantId).toBe(2);
    expect(resolved?.optionValueIds).toEqual([102, 1189]);
  });

  it("never resolves on a shared option alone when dimensions are known", () => {
    // Shares only the color: must not be returned for a full selection.
    const partial = [variant(1, [101], 900), variant(2, [101, 1189], 3000)];
    expect(resolveVariant(partial, { Colors: 101, Sizes: 1190 }, ["Colors", "Sizes"])).toBeNull();
    expect(resolveVariant(partial, { Colors: 101, Sizes: 1189 }, ["Colors", "Sizes"])?.printifyVariantId).toBe(2);
  });

  it("prefers the orderable variant when an identical disabled row exists", () => {
    const dupes = [
      variant(1, [101, 1189], 3000, { isEnabled: false }),
      variant(2, [101, 1189], 3000),
    ];
    expect(resolveVariant(dupes, { Colors: 101, Sizes: 1189 }, ["Colors", "Sizes"])?.id).toBe("v-2");
  });
});

describe("pricing helpers", () => {
  const variants = [
    variant(1, [101], 3000),
    variant(2, [102], 3200),
    variant(3, [103], 3200, { isEnabled: false }),
  ];

  it("minPriceMinor and hasDistinctPrices ignore disabled variants", () => {
    expect(minPriceMinor(variants)).toBe(3000);
    expect(hasDistinctPrices(variants)).toBe(true);
    expect(minPriceMinor([variant(9, [1], 500, { isEnabled: false }), variant(8, [2], 900)])).toBe(900);
    expect(hasDistinctPrices([variant(1, [101], 3000), variant(2, [102], 3000)])).toBe(false);
  });

  it("minPriceMinor is 0 when nothing is orderable", () => {
    expect(minPriceMinor([variant(1, [1], 600, { isEnabled: false })])).toBe(0);
  });

  it("selectedPriceMinor is null until all dimensions are chosen", () => {
    const dims = ["Colors", "Sizes"];
    expect(selectedPriceMinor(variants, { Colors: 101 }, dims)).toBeNull();
    expect(selectedPriceMinor(variants, { Colors: 101, Sizes: 1189 }, dims)).toBeNull();
    const twoDim: ProductVariantRecord[] = [
      variant(1, [101, 1189], 3000),
      variant(2, [102, 1189], 3200),
    ];
    expect(selectedPriceMinor(twoDim, { Colors: 102, Sizes: 1189 }, dims)).toBe(3200);
  });
});

describe("orderableVariants", () => {
  it("keeps only enabled and available variants", () => {
    const variants = [
      variant(1, [101], 3000),
      variant(2, [102], 3200, { isEnabled: false }),
      variant(3, [103], 3400, { isAvailable: false }),
    ];
    expect(orderableVariants(variants).map((v) => v.id)).toEqual(["v-1"]);
  });

  it("rejects rows without a real Printify id, price or option combination", () => {
    expect(isOrderableVariant(variant(1, [101], 3000))).toBe(true);
    expect(isOrderableVariant(variant(0, [101], 3000))).toBe(false);
    expect(isOrderableVariant(variant(1, [101], 0))).toBe(false);
    expect(isOrderableVariant(variant(1, [], 3000))).toBe(false);
  });

  it("sellability additionally requires a usable fulfillment cost", () => {
    expect(isSellableVariant(variant(1, [101], 3000))).toBe(true);
    expect(isSellableVariant(variant(1, [101], 3000, { costMinor: 0 }))).toBe(false);
  });
});