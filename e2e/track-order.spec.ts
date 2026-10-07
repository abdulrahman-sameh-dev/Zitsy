import { expect, test } from "@playwright/test";

import { resetStore, seedPaidOrder } from "./seed";

/** One message must cover every failure mode (no order enumeration). */
const GENERIC_FAILURE = "couldn't find an order matching those details";

const ORDER_NUMBER = "ZS-XXXXXXXX";
const EMAIL_PLACEHOLDER = "you@example.com";

async function lookup(
  page: import("@playwright/test").Page,
  orderNumber: string,
  email: string,
) {
  await page.goto("/track-order");
  await page.getByPlaceholder(ORDER_NUMBER).fill(orderNumber);
  await page.getByPlaceholder(EMAIL_PLACEHOLDER).fill(email);
  await page.getByRole("button", { name: "Find my order" }).click();
}

test.beforeAll(async () => {
  await resetStore();
});

test.afterAll(async () => {
  await resetStore();
});

test("opens the login-free tracking page", async ({ page }) => {
  await page.goto("/track-order");
  await expect(page.getByRole("heading", { name: "Track your order" })).toBeVisible();
  await expect(page.getByPlaceholder(ORDER_NUMBER)).toBeVisible();
  await expect(page.getByPlaceholder(EMAIL_PLACEHOLDER)).toBeVisible();
  await expect(page.getByText("No account needed.")).toBeVisible();
});

test("returns one generic failure for details that match nothing", async ({ page }) => {
  await lookup(page, "ZS-UNKNOWN01", "nobody@example.com");

  await expect(page.getByText(GENERIC_FAILURE)).toBeVisible();
  await expect(page).toHaveURL("/track-order");
});

test("returns the same generic failure for a wrong email", async ({ page }) => {
  const order = await seedPaidOrder();

  await lookup(page, order.orderNumber, "wrong@example.com");

  await expect(page.getByText(GENERIC_FAILURE)).toBeVisible();
  await expect(page).toHaveURL("/track-order");
  await expect(page.getByText(order.productTitle)).toHaveCount(0);
});

test("finds the order with the right number and email", async ({ page }) => {
  const order = await seedPaidOrder();

  await lookup(page, order.orderNumber, order.email.toUpperCase());

  await expect(page).toHaveURL(/\/track-order\/[A-Za-z0-9_-]{16,}/);
  await expect(page.getByRole("heading", { name: order.orderNumber })).toBeVisible();
  await expect(page.getByText(order.productTitle)).toBeVisible();
  await expect(page.getByText(order.variantTitle)).toBeVisible();
  await expect(page.getByText("Order confirmed")).toBeVisible();
  await expect(page.getByText("London, United Kingdom")).toBeVisible();
  const totalRow = page.locator("dt", { hasText: /^Total$/ }).locator("+ dd");
  await expect(totalRow).toHaveText("£25.00");
});

test("shows carrier tracking details when they exist", async ({ page }) => {
  const order = await seedPaidOrder({ tracking: true });

  await lookup(page, order.orderNumber, order.email);

  await expect(page).toHaveURL(/\/track-order\/[A-Za-z0-9_-]{16,}/);
  await expect(page.getByText("Tracking", { exact: true })).toBeVisible();
  await expect(page.getByText("USPS")).toBeVisible();
  await expect(page.getByText(order.trackingNumber!)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open carrier tracking" })).toHaveAttribute(
    "href",
    order.trackingUrl!,
  );
});
