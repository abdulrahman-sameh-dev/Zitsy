import { expect, test } from "@playwright/test";

import { supportEmail } from "@/lib/config/env";
import { notifyOrderPaid } from "@/lib/email/order-notifications";

import { extractTrackUrl, readCapturedEmails } from "./resend-stub";
import { resetStore, seedPaidOrder } from "./seed";

test.beforeAll(async () => {
  await resetStore();
});

test.afterAll(async () => {
  await resetStore();
});

test("the confirmation email carries a working, login-free tracking link", async ({ page }) => {
  const order = await seedPaidOrder();

  await notifyOrderPaid(order.id);

  const emails = readCapturedEmails();
  const confirmation = emails.filter(
    (entry) => entry.to === order.email && entry.subject.includes(order.orderNumber),
  );
  expect(confirmation.length).toBeGreaterThan(0);

  const body = confirmation[0];
  expect(body.html).toContain(order.orderNumber);
  expect(body.html).toContain(order.productTitle);
  expect(body.text ?? "").toContain(order.orderNumber);

  const trackUrl = extractTrackUrl(body.html);
  expect(trackUrl).toMatch(/\/track-order\/[A-Za-z0-9_-]{16,}$/);

  // The store is notified about the same paid order.
  const admin = emails.filter(
    (entry) => entry.to === supportEmail() && entry.subject.includes(order.orderNumber),
  );
  expect(admin.length).toBeGreaterThan(0);

  // The link opens the right order straight away — no login, no lookup form.
  await page.goto(trackUrl!);
  await expect(page).toHaveURL(/\/track-order\/[A-Za-z0-9_-]{16,}$/);
  await expect(page.getByRole("heading", { name: order.orderNumber })).toBeVisible();
  await expect(page.getByText(order.productTitle)).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
});
