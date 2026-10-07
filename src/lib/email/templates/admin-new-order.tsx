/**
 * @jsxImportSource react
 */

import { formatMoney } from "@/lib/money";

import { formatDateTime, renderEmail } from "../render";
import type { OrderEmailModel, RenderedEmail } from "../types";
import {
  DetailList,
  EmailShell,
  EmailText,
  ItemList,
  SummaryRows,
} from "./layout";

export function adminNewOrderSubject(model: OrderEmailModel): string {
  return `New paid order ${model.orderNumber}`;
}

/**
 * §7 — internal notification for the store owner: enough detail to understand
 * the order without opening the database. Contains no cost, no profit and no
 * credentials.
 */
export async function renderAdminNewOrderEmail(
  model: OrderEmailModel,
): Promise<RenderedEmail> {
  const subject = adminNewOrderSubject(model);
  const items = model.items.map((item) => ({
    title: item.title,
    variantTitle: item.variantTitle,
    quantity: item.quantity,
    lineTotal: formatMoney(item.totalPriceMinor, model.currency),
    imageUrl: item.imageUrl,
  }));

  const rows = [
    { label: "Order number", value: model.orderNumber },
    { label: "Placed", value: formatDateTime(model.orderDate) },
    { label: "Customer", value: model.address.recipientName },
    { label: "Customer email", value: model.email },
    { label: "Fulfillment", value: model.statusLabel },
    { label: "PayPal order ID", value: model.paypalOrderId ?? "—" },
  ];
  if (model.printifyOrderId) {
    rows.push({ label: "Printify order", value: model.printifyOrderId });
  }
  if (model.submittedAt) {
    rows.push({ label: "Submitted to Printify", value: formatDateTime(model.submittedAt) });
  }

  const { html, text } = await renderEmail(
    <EmailShell
      internal
      preheader={`New paid order ${model.orderNumber} from ${model.address.recipientName}.`}
      title="New paid order"
    >
      <DetailList rows={rows} />

      <EmailText>
        <strong style={{ color: "#18181b" }}>Ship to</strong>
        <br />
        {model.address.recipientName}
        <br />
        {model.address.line1}
        {model.address.line2 ? (
          <>
            <br />
            {model.address.line2}
          </>
        ) : null}
        <br />
        {model.address.city}
        {model.address.region ? `, ${model.address.region}` : ""}{" "}
        {model.address.postalCode}
        <br />
        {model.address.countryName}
      </EmailText>

      <ItemList items={items} />

      <div style={{ marginTop: 16 }}>
        <SummaryRows
          rows={[
            { label: "Subtotal", value: formatMoney(model.subtotalMinor, model.currency) },
            {
              label: "Shipping charged",
              value:
                model.shippingMinor === 0
                  ? "Free"
                  : formatMoney(model.shippingMinor, model.currency),
            },
            { label: "Total", value: formatMoney(model.totalMinor, model.currency), strong: true },
          ]}
        />
      </div>

      <EmailText>
        This is an internal notification. PostgreSQL remains the source of
        truth for this order.
      </EmailText>
    </EmailShell>,
  );

  return { subject, html, text };
}
