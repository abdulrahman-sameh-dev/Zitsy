import { expect, test } from "@playwright/test";

test("footer links customers to order tracking and support", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("contentinfo");

  await expect(footer.getByRole("link", { name: "Track Order" })).toHaveAttribute(
    "href",
    "/track-order",
  );
  await expect(footer.getByRole("link", { name: "Contact Us" })).toHaveAttribute(
    "href",
    "/contact",
  );
});

test("the tracking page links back to support", async ({ page }) => {
  await page.goto("/track-order");
  await expect(page.getByRole("link", { name: "Contact us" })).toHaveAttribute(
    "href",
    "/contact",
  );
});
