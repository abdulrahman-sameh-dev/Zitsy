import { describe, expect, it } from "vitest";

import type { ImageRecord } from "@/lib/catalog/view";
import { imagesForVariant } from "@/lib/catalog/view";

const images: ImageRecord[] = [
  { src: "a.jpg", position: 0, isDefault: true, variantIds: [1001, 1002] },
  { src: "b.jpg", position: 1, isDefault: false, variantIds: [1002] },
  { src: "c.jpg", position: 2, isDefault: false, variantIds: [] },
];

describe("imagesForVariant", () => {
  it("returns the images tied to the selected variant", () => {
    expect(imagesForVariant(images, 1002).map((i) => i.src)).toEqual(["a.jpg", "b.jpg"]);
    expect(imagesForVariant(images, 1001).map((i) => i.src)).toEqual(["a.jpg"]);
  });

  it("falls back to all images when the variant has none", () => {
    expect(imagesForVariant(images, 9999).map((i) => i.src)).toEqual([
      "a.jpg",
      "b.jpg",
      "c.jpg",
    ]);
  });

  it("returns all images when no variant is selected", () => {
    expect(imagesForVariant(images, null)).toHaveLength(3);
  });
});