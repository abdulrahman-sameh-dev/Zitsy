/**
 * @jsxImportSource react
 */

import { renderEmail } from "../render";
import type { OrderEmailModel, RenderedEmail } from "../types";
import {
  DetailList,
  EmailButton,
  EmailShell,
  EmailText,
  ItemList,
} from "./layout";

export function orderShippedSubject(model: OrderEmailModel): string {
  return `Your order is on the way — ${model.orderNumber}`;
}

/**
 * §5 — only reached once Printify reported shipment data that actually carries
 * a tracking number/URL. Carrier and tracking values are shown verbatim; never
 * invented.
 */
export async function renderOrderShippedEmail(
  model: OrderEmailModel,
): Promise<RenderedEmail> {
  const subject = orderShippedSubject(model);
  const tracking = model.tracking;
  const items = model.items.map((item) => ({
    title: item.title,
    variantTitle: item.variantTitle,
    quantity: item.quantity,
    lineTotal: "",
    imageUrl: item.imageUrl,
  }));

  const rows = [
    { label: "Order number", value: model.orderNumber },
    { label: "Status", value: "Shipped" },
    { label: "Destination", value: model.destinationCountry },
  ];
  if (tracking?.carrier) rows.push({ label: "Carrier", value: tracking.carrier });
  if (tracking?.number) rows.push({ label: "Tracking number", value: tracking.number });

  const { html, text } = await renderEmail(
    <EmailShell
      preheader={`Your order ${model.orderNumber} is on the way.`}
      title="Your order is on the way"
    >
      <EmailText>
        Your order has shipped. You can follow it with the carrier below or on
        your Zitsy tracking page.
      </EmailText>

      <DetailList rows={rows} />

      <ItemList items={items} showLineTotals={false} />

      <EmailButton href={model.trackUrl} label="Track your order" />

      {tracking?.url ? (
        <EmailText>
          <a href={tracking.url}>Open carrier tracking</a>
        </EmailText>
      ) : null}
    </EmailShell>,
  );

  return { subject, html, text };
}
