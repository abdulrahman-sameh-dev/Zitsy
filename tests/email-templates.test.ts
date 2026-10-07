import { describe, expect, it } from "vitest";

import { serverEnv } from "@/lib/config/env";
import { formatMoney } from "@/lib/money";
import {
  adminNewOrderSubject,
  renderAdminNewOrderEmail,
} from "@/lib/email/templates/admin-new-order";
import { renderOrderConfirmedEmail } from "@/lib/email/templates/order-confirmed";
import { renderOrderDeliveredEmail } from "@/lib/email/templates/order-delivered";
import { renderOrderShippedEmail } from "@/lib/email/templates/order-shipped";
import { renderOrderSubmittedEmail } from "@/lib/email/templates/order-submitted";
import {
  renderSupportMessageEmail,
  renderSupportReceivedEmail,
  supportMessageSubject,
} from "@/lib/email/templates/support-message";
import type { OrderEmailModel } from "@/lib/email/types";

const model: OrderEmailModel = {
  orderNumber: "ZS-ABC12345",
  orderDate: new Date("2026-10-01T10:00:00.000Z"),
  email: "buyer@example.com",
  currency: "GBP",
  subtotalMinor: 5000,
  shippingMinor: 399,
  totalMinor: 5399,
  statusLabel: "Preparing",
  destination: "London, United Kingdom",
  destinationCountry: "United Kingdom",
  items: [
    {
      title: "Sunny Cat Tee",
      variantTitle: "Black / M",
      quantity: 2,
      unitPriceMinor: 2500,
      totalPriceMinor: 5000,
      imageUrl: "https://cdn.example.com/cat.jpg",
    },
  ],
  address: {
    recipientName: "Jane Smith",
    line1: "1 Main Street",
    line2: null,
    city: "London",
    region: null,
    postalCode: "SW1A 1AA",
    country: "GB",
    countryName: "United Kingdom",
  },
  tracking: null,
  trackUrl: "https://zitsy.example.com/track-order/tok_abc",
  supportUrl: "https://zitsy.example.com/contact",
  submittedAt: null,
  deliveredAt: null,
  paypalOrderId: "PP-ORDER-123",
  printifyOrderId: null,
};

const withTracking: OrderEmailModel = {
  ...model,
  tracking: {
    carrier: "USPS",
    number: "TRACK-999",
    url: "https://track.example/TRACK-999",
  },
};

function expectNoSecrets(email: { html: string; text: string }) {
  const secrets = [
    serverEnv.RESEND_API_KEY,
    serverEnv.DATABASE_URL,
    serverEnv.AUTH_SECRET,
    serverEnv.PRINTIFY_API_TOKEN,
    serverEnv.PRINTIFY_WEBHOOK_SECRET,
    serverEnv.PAYPAL_CLIENT_SECRET,
  ].filter((secret): secret is string => Boolean(secret) && secret.length >= 6);

  for (const secret of secrets) {
    expect(email.html).not.toContain(secret);
    expect(email.text).not.toContain(secret);
  }
  expect(email.html).not.toMatch(/re_[A-Za-z0-9_-]{8,}/);
}

const customerRenderers = [
  ["order-confirmed", renderOrderConfirmedEmail],
  ["order-submitted", renderOrderSubmittedEmail],
  ["order-shipped", renderOrderShippedEmail],
  ["order-delivered", renderOrderDeliveredEmail],
] as const;

describe("customer order emails", () => {
  it.each(customerRenderers)("%s renders subject, order facts and a tracking link", async (_name, render) => {
    const email = await render(model);

    expect(email.subject).toContain(model.orderNumber);
    expect(email.text).toContain(model.orderNumber);
    expect(email.html).toContain(model.orderNumber);
    expect(email.html).toContain(model.trackUrl);
    expect(email.html).toContain("Sunny Cat Tee");
    expect(email.html).toContain("Black / M");
    expect(email.html).toContain("Qty");
    expect(email.html).toContain("contact form");
    expect(email.html).not.toContain("Internal store notification");
    expect(email.text.length).toBeGreaterThan(0);
    expectNoSecrets(email);
  });

  it("shows prices, totals and the address on the confirmation", async () => {
    const email = await renderOrderConfirmedEmail(model);
    expect(email.html).toContain(model.address.recipientName);
    expect(email.html).toContain(formatMoney(model.subtotalMinor, model.currency));
    expect(email.html).toContain(formatMoney(model.totalMinor, model.currency));
    expect(email.html).toContain("SW1A 1AA");
    expect(email.html).toContain("United Kingdom");
  });

  it("carries carrier and tracking details verbatim when present", async () => {
    const email = await renderOrderShippedEmail(withTracking);
    expect(email.html).toContain("USPS");
    expect(email.html).toContain("TRACK-999");
    expect(email.html).toContain("https://track.example/TRACK-999");
    expect(email.text).toContain("TRACK-999");
  });

  it("never invents tracking details when they are missing", async () => {
    const email = await renderOrderShippedEmail(model);
    expect(email.html).not.toContain("TRACK-");
    expect(email.html).not.toMatch(/tracking number/i);
  });

  it("shows the authoritative delivered date", async () => {
    const email = await renderOrderDeliveredEmail({
      ...model,
      deliveredAt: new Date("2026-10-07T12:00:00.000Z"),
    });
    expect(email.html).toContain("7 October 2026");
  });

  it("marks the order as submitted to Printify in the submitted email", async () => {
    const email = await renderOrderSubmittedEmail({
      ...model,
      submittedAt: new Date("2026-10-02T09:30:00.000Z"),
    });
    expect(email.text).toContain("ZS-ABC12345");
    expect(email.html).toContain(model.trackUrl);
  });
});

describe("admin new-order email", () => {
  it("includes the internal detail a store owner needs", async () => {
    const email = await renderAdminNewOrderEmail(model);

    expect(adminNewOrderSubject(model)).toContain(model.orderNumber);
    expect(email.html).toContain("PP-ORDER-123");
    expect(email.html).toContain("buyer@example.com");
    expect(email.html).toContain("1 Main Street");
    expect(email.html).toContain("Internal store notification");
    expect(email.html).toContain(formatMoney(model.totalMinor, model.currency));
    expectNoSecrets(email);
  });

  it("leaks no cost, profit, credentials or customer-only tracking token", async () => {
    const email = await renderAdminNewOrderEmail(model);
    expect(email.html.toLowerCase()).not.toContain("cost");
    expect(email.html.toLowerCase()).not.toContain("profit");
    expect(email.html).not.toContain(model.trackUrl);
    expect(email.text.toLowerCase()).not.toContain("cost");
  });

  it("omits the Printify reference until one exists", async () => {
    const email = await renderAdminNewOrderEmail(model);
    expect(email.html).not.toContain("Printify order");
  });
});

describe("support emails", () => {
  const data = {
    category: "Order question",
    customerName: "Jane Smith",
    customerEmail: "jane@example.com",
    orderNumber: "ZS-ABC12345",
    message: "Where is my order? <script>alert(1)</script>",
    submittedAt: new Date("2026-10-07T10:00:00.000Z"),
    orderSummary: [
      "Order ZS-ABC12345",
      "Placed: 1 October 2026",
      "Fulfillment: Preparing",
      "Total: £53.99",
    ] as string[] | null,
  };

  it("renders the store-facing message with reply-to context", async () => {
    const email = await renderSupportMessageEmail(data);

    expect(supportMessageSubject(data)).toBe(
      "[Order question] Message from Jane Smith (ZS-ABC12345)",
    );
    expect(email.html).toContain("jane@example.com");
    expect(email.html).toContain("Order question");
    expect(email.html).toContain("Order ZS-ABC12345");
    expect(email.html).toContain("Total: £53.99");
    expect(email.text).toContain("Jane Smith");
    expectNoSecrets(email);
  });

  it("escapes customer-supplied markup", async () => {
    const email = await renderSupportMessageEmail(data);
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>alert(1)</script>");
  });

  it("shows no order summary when the number did not verify", async () => {
    const email = await renderSupportMessageEmail({ ...data, orderSummary: null });
    expect(email.html).not.toContain("Verified order summary");
    expect(email.html).not.toContain("Total: £53.99");
  });

  it("sends a receipt to the customer without order facts", async () => {
    const email = await renderSupportReceivedEmail({
      category: "Order question",
      customerName: "Jane Smith",
      orderNumber: null,
    });

    expect(email.subject).toContain("received");
    expect(email.html).toContain("Jane Smith");
    expect(email.html).not.toContain("Total: £53.99");
    expect(email.text.length).toBeGreaterThan(0);
    expectNoSecrets(email);
  });
});
