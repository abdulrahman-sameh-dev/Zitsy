/**
 * @jsxImportSource react
 */

import { formatDate, renderEmail } from "../render";
import type { OrderEmailModel, RenderedEmail } from "../types";
import {
  DetailList,
  EmailButton,
  EmailShell,
  EmailText,
  ItemList,
} from "./layout";

export function orderSubmittedSubject(model: OrderEmailModel): string {
  return `Your order is being prepared — ${model.orderNumber}`;
}

/**
 * §4 — sent when the paid order has been accepted by Printify. Wording follows
 * the recorded fulfillment state and never claims shipment or production the
 * system has not actually reported.
 */
export async function renderOrderSubmittedEmail(
  model: OrderEmailModel,
): Promise<RenderedEmail> {
  const subject = orderSubmittedSubject(model);
  const items = model.items.map((item) => ({
    title: item.title,
    variantTitle: item.variantTitle,
    quantity: item.quantity,
    lineTotal: "",
    imageUrl: item.imageUrl,
  }));

  const { html, text } = await renderEmail(
    <EmailShell
      preheader={`We're preparing your order ${model.orderNumber}.`}
      title="Your order is being prepared"
    >
      <EmailText>
        Good news — your order has been received by our production partner and
        is now being prepared.
      </EmailText>

      <DetailList
        rows={[
          { label: "Order number", value: model.orderNumber },
          { label: "Order date", value: formatDate(model.orderDate) },
          { label: "Status", value: model.statusLabel },
        ]}
      />

      <ItemList items={items} showLineTotals={false} />

      <EmailButton href={model.trackUrl} label="Track your order" />
    </EmailShell>,
  );

  return { subject, html, text };
}
