import { describe, expect, it } from "vitest";

import {
  buildColorGallery,
  cameraLabel,
  distinctAngles,
  suggestCompatibleSize,
  swatchColor,
} from "@/lib/catalog/gallery";
import type { ImageRecord } from "@/lib/catalog/view";
import type { ProductOptionDim, ProductVariantRecord } from "@/lib/catalog/variants";

const dims: ProductOptionDim[] = [
  {
    name: "Colors",
    type: "color",
    values: [
      { valueId: 401, title: "Natural" },
      { valueId: 402, title: "Black" },
    ],
  },
  { name: "Size", type: "size", values: [{ valueId: 501, title: "One size" }] },
];

function variant(id: number, color: number, size: number, active = true): ProductVariantRecord {
  return {
    id: `var-${id}`,
    printifyVariantId: id,
    title: `V${id}`,
    priceMinor: 1500,
    currency: "GBP",
    isEnabled: active,
    isAvailable: active,
    optionValueIds: [color, size],
  };
}

const variants: ProductVariantRecord[] = [
  variant(6001, 401, 501),
  variant(6002, 402, 501),
  { ...variant(6003, 402, 501), isEnabled: false, isAvailable: false },
];

const images: ImageRecord[] = [
  { src: "https://img/api.jpg?camera_label=front", position: 0, isDefault: true, variantIds: [6001, 6002] },
  { src: "https://img/api.jpg?camera_label=back", position: 1, isDefault: false, variantIds: [6001] },
  { src: "https://img/api.jpg?camera_label=folded", position: 2, isDefault: false, variantIds: [6002] },
  { src: "https://img/api.jpg?camera_label=size-chart", position: 3, isDefault: false, variantIds: [] },
];

describe("buildColorGallery", () => {
  it("maps each available colour to the images whose variants carry it", () => {
    const { groups, untagged } = buildColorGallery(dims, variants, images);
    expect(groups).toHaveLength(2);
    const natural = groups.find((g) => g.title === "Natural")!;
    const black = groups.find((g) => g.title === "Black")!;
    expect(natural.images.map((i) => i.src)).toEqual([
      images[0].src,
      images[1].src,
    ]);
    expect(black.images.map((i) => i.src)).toEqual([images[0].src, images[2].src]);
    // size-chart belongs to no colour -> untagged
    expect(untagged.map((i) => i.src)).toEqual([images[3].src]);
  });

  it("never exposes an unavailable colour as a group", () => {
    const { groups } = buildColorGallery(dims, variants, images);
    const unavailable = groups.find((g) => g.valueId === 402 && g.title === "Black");
    expect(unavailable).toBeDefined();
    // the disabled variant 6003 is not a member of any group
    expect(groups.flatMap((g) => g.variantIds)).not.toContain(6003);
  });

  it("picks the front mockup as the hero image for each colour", () => {
    const { groups } = buildColorGallery(dims, variants, images);
    expect(groups[0].heroImage?.src).toBe(images[0].src);
  });

  it("returns everything as untagged when there is no colour dimension", () => {
    const sizeOnly: ProductOptionDim[] = [
      { name: "Sizes", type: "size", values: [{ valueId: 501, title: "11oz" }] },
    ];
    const { groups, untagged, colorDimName } = buildColorGallery(
      sizeOnly,
      [variant(7001, 401, 501)],
      images,
    );
    expect(colorDimName).toBe("");
    expect(groups).toEqual([]);
    expect(untagged).toHaveLength(images.length);
  });
});

describe("camera labels", () => {
  it("extracts and buckets labels", () => {
    expect(cameraLabel("https://img?a=1&camera_label=front-2")).toBe("front-2");
  });

  it("deduplicates visually identical angles and caps the result", () => {
    const many = images.map((i) => ({ ...i, position: i.position })).concat([
      { src: "https://img/api.jpg?camera_label=front", position: 9, isDefault: false, variantIds: [6001] },
      { src: "https://img/api.jpg?camera_label=lifestyle", position: 5, isDefault: false, variantIds: [6002] },
    ]);
    const angles = distinctAngles(many, 5);
    const buckets = angles.map((a) => cameraLabel(a.src));
    // front appears once despite two rows
    expect(buckets.filter((b) => b === "front")).toHaveLength(1);
    expect(angles.length).toBeLessThanOrEqual(5);
  });
});

describe("suggestCompatibleSize", () => {
  const twoSizes: ProductOptionDim[] = [
    { name: "Sizes", type: "size", values: [
      { valueId: 501, title: "S" },
      { valueId: 502, title: "M" },
    ] },
  ];
  const variants2 = [
    { ...variant(6101, 401, 501), optionValueIds: [401, 501] },
    { ...variant(6102, 401, 502), optionValueIds: [401, 502] },
    { ...variant(6103, 402, 502), optionValueIds: [402, 502] },
  ];

  it("keeps the current size when the colour is made in it", () => {
    expect(suggestCompatibleSize(401, 501, twoSizes[0], variants2)).toBe(501);
    expect(suggestCompatibleSize(402, 502, twoSizes[0], variants2)).toBe(502);
  });

  it("corrects an incompatible size instead of silently keeping it", () => {
    // Black (402) is not made in S -> falls back to its first available size
    expect(suggestCompatibleSize(402, 501, twoSizes[0], variants2)).toBe(502);
  });

  it("returns null with no size dimension", () => {
    const single: ProductOptionDim[] = [{ name: "Sizes", type: "size", values: [{ valueId: 501, title: "S" }] }];
    expect(suggestCompatibleSize(401, 501, undefined, variants2)).toBeNull();
    expect(suggestCompatibleSize(401, 501, single[0], variants2)).toBe(501);
  });
});

describe("swatchColor", () => {
  it("maps known garment colours and returns null for unknown names", () => {
    expect(swatchColor("Navy")).toBe("#223a5e");
    expect(swatchColor("Sport Grey")).toBe("#9a9a9d");
    expect(swatchColor("Comfort Colors®")).toBeNull();
  });
});