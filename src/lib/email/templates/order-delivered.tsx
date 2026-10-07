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

export function orderDeliveredSubject(model: OrderEmailModel): string {
  return `Your order has been delivered — ${model.orderNumber}`;
}

/** §6 — only sent when the delivered timestamp is authoritative. */
export async function renderOrderDeliveredEmail(
  model: OrderEmailModel,
): Promise<RenderedEmail> {
  const subject = orderDeliveredSubject(model);
  const items = model.items.map((item) => ({
    title: item.title,
    variantTitle: item.variantTitle,
    quantity: item.quantity,
    lineTotal: "",
    imageUrl: item.imageUrl,
  }));

  const rows = [
    { label: "Order number", value: model.orderNumber },
    {
      label: "Delivered",
      value: model.deliveredAt ? formatDate(model.deliveredAt) : "Delivered",
    },
    { label: "Destination", value: model.destinationCountry },
  ];

  const { html, text } = await renderEmail(
    <EmailShell
      preheader={`Your order ${model.orderNumber} has been delivered.`}
      title="Your order has been delivered"
    >
      <EmailText>
        Your order has arrived. We hope you enjoy it — thanks for ordering with
        Zitsy.
      </EmailText>

      <DetailList rows={rows} />

      <ItemList items={items} showLineTotals={false} />

      <EmailButton href={model.trackUrl} label="Track your order" />
    </EmailShell>,
  );

  return { subject, html, text };
}
