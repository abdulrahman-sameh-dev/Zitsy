import { describe, expect, it } from "vitest";

import { displayTags } from "@/lib/catalog/tags";

describe("displayTags", () => {
  it("keeps real product attributes", () => {
    const tags = ["Men's Clothing", "Sweatshirts", "Unisex", "Crew neck", "Regular fit"];
    expect(displayTags(tags)).toEqual(tags);
  });

  it("drops Printify marketing / capability tags case-insensitively", () => {
    expect(
      displayTags([
        "TikTok",
        "New Mockups",
        "Glitter print",
        "Puff",
        "Puffy",
        "Embroidery",
        "PERSONALIZATION PICKS",
      ]),
    ).toEqual([]);
  });

  it("keeps order and only filters, never mutates input", () => {
    const tags = ["Hoodies", "Glitter", "Women's Clothing"];
    const out = displayTags(tags);
    expect(out).toEqual(["Hoodies", "Women's Clothing"]);
    expect(tags).toEqual(["Hoodies", "Glitter", "Women's Clothing"]);
  });
});