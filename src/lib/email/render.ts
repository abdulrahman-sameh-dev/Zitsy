import type { ReactNode } from "react";
import { render, toPlainText } from "@react-email/render";

/** Render a template to HTML plus a plain-text alternative for mail clients. */
export async function renderEmail(node: ReactNode): Promise<{ html: string; text: string }> {
  const html = await render(node);
  return { html, text: toPlainText(html) };
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "7 October 2026" */
export function formatDate(value: Date): string {
  return DATE_FORMAT.format(value);
}

/** "7 October 2026, 14:32" */
export function formatDateTime(value: Date): string {
  return TIME_FORMAT.format(value);
}
