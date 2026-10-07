/**
 * @jsxImportSource react
 */

import { formatDateTime, renderEmail } from "../render";
import type { RenderedEmail } from "../types";
import { EmailShell, EmailText, DetailList } from "./layout";

export interface SupportMessageData {
  /** Category wording, e.g. "Shipping question". */
  category: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string | null;
  message: string;
  submittedAt: Date;
  /** Present only when the supplied order number matched a real order. */
  orderSummary: string[] | null;
}

export interface SupportReceivedData {
  category: string;
  customerName: string;
  orderNumber: string | null;
}

export function supportMessageSubject(data: SupportMessageData): string {
  const order = data.orderNumber ? ` (${data.orderNumber})` : "";
  return `[${data.category}] Message from ${data.customerName}${order}`;
}

/** §16 — the store receives the message; the store replies to the customer. */
export async function renderSupportMessageEmail(
  data: SupportMessageData,
): Promise<RenderedEmail> {
  const subject = supportMessageSubject(data);

  const rows = [
    { label: "Category", value: data.category },
    { label: "Customer", value: data.customerName },
    { label: "Customer email", value: data.customerEmail },
    { label: "Order number", value: data.orderNumber ?? "Not supplied" },
    { label: "Received", value: formatDateTime(data.submittedAt) },
  ];

  const { html, text } = await renderEmail(
    <EmailShell
      internal
      preheader={`New support message from ${data.customerName}.`}
      title="New support message"
    >
      <DetailList rows={rows} />

      {data.orderSummary ? (
        <EmailText>
          <strong style={{ color: "#18181b" }}>Verified order summary</strong>
          <br />
          {data.orderSummary.map((line) => (
            <span key={line}>
              {line}
              <br />
            </span>
          ))}
        </EmailText>
      ) : null}

      <EmailText>
        <strong style={{ color: "#18181b" }}>Message</strong>
      </EmailText>
      <EmailText>{data.message}</EmailText>
    </EmailShell>,
  );

  return { subject, html, text };
}

export function supportReceivedSubject(): string {
  return "We've received your message";
}

/** §17 — optional confirmation sent back to the customer. */
export async function renderSupportReceivedEmail(
  data: SupportReceivedData,
): Promise<RenderedEmail> {
  const subject = supportReceivedSubject();

  const { html, text } = await renderEmail(
    <EmailShell
      preheader="Your message has been received."
      title="Your message has been received"
    >
      <EmailText>
        Hi {data.customerName} — thanks for getting in touch. We&apos;ve
        received your message and will reply to this email address.
      </EmailText>

      <DetailList
        rows={[
          { label: "Category", value: data.category },
          { label: "Order number", value: data.orderNumber ?? "Not supplied" },
        ]}
      />

      <EmailText>
        We don&apos;t have a published response time yet, so please keep an eye
        on your inbox (and spam folder) for our reply.
      </EmailText>
    </EmailShell>,
  );

  return { subject, html, text };
}
