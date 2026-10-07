/**
 * @jsxImportSource react
 */

import { formatMoney } from "@/lib/money";

import { formatDate, renderEmail } from "../render";
import type { OrderEmailModel, RenderedEmail } from "../types";
import {
  DetailList,
  EmailButton,
  EmailShell,
  EmailText,
  ItemList,
  SummaryRows,
} from "./layout";

export function orderConfirmedSubject(model: OrderEmailModel): string {
  return `Order confirmed — ${model.orderNumber}`;
}

/** §3.A — sent once the payment is server-verified as captured. */
export async function renderOrderConfirmedEmail(
  model: OrderEmailModel,
): Promise<RenderedEmail> {
  const subject = orderConfirmedSubject(model);
  const items = model.items.map((item) => ({
    title: item.title,
    variantTitle: item.variantTitle,
    quantity: item.quantity,
    lineTotal: formatMoney(item.totalPriceMinor, model.currency),
    imageUrl: item.imageUrl,
  }));

  const { html, text } = await renderEmail(
    <EmailShell
      preheader={`Your order ${model.orderNumber} is confirmed.`}
      title="Your order is confirmed"
    >
      <EmailText>
        Thanks {model.address.recipientName} — we&apos;ve received your payment
        and your order is confirmed. We&apos;ll let you know as soon as it moves
        into preparation.
      </EmailText>

      <DetailList
        rows={[
          { label: "Order number", value: model.orderNumber },
          { label: "Order date", value: formatDate(model.orderDate) },
          { label: "Status", value: model.statusLabel },
          { label: "Shipping to", value: model.destination },
        ]}
      />

      <ItemList items={items} />

      <div style={{ marginTop: 16 }}>
        <SummaryRows
          rows={[
            { label: "Subtotal", value: formatMoney(model.subtotalMinor, model.currency) },
            {
              label: "Shipping",
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
        <strong style={{ color: "#18181b" }}>Shipping to</strong>
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

      <EmailButton href={model.trackUrl} label="Track your order" />

      <EmailText>
        Your tracking page shows the live preparation, shipping and delivery
        status — no account needed.
      </EmailText>
    </EmailShell>,
  );

  return { subject, html, text };
}
