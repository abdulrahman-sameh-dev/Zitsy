/**
 * @jsxImportSource react
 */

import type { ReactNode } from "react";

import { site } from "@/lib/config/public-env";

import { contactUrl } from "../config";

const INK = "#18181b";
const MUTED = "#71717a";
const LINE = "#e4e4e7";
const BRAND = "#16a34a";
const BRAND_DARK = "#15803d";

const FONT =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Shared shell every transactional email renders inside. */
export function EmailShell({
  preheader,
  title,
  internal = false,
  children,
}: {
  preheader: string;
  title: string;
  /** Store-facing message: swaps the customer footer copy. */
  internal?: boolean;
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: "#f4f5f7", fontFamily: FONT }}>
        {/* Hidden preheader shown in inbox previews. */}
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 }}>
          {preheader}
        </div>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          style={{ backgroundColor: "#f4f5f7", borderCollapse: "collapse" }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "24px 12px" }}>
                <table
                  role="presentation"
                  width="100%"
                  style={{
                    width: "100%",
                    maxWidth: 560,
                    backgroundColor: "#ffffff",
                    borderRadius: 12,
                    border: `1px solid ${LINE}`,
                    borderCollapse: "separate",
                  }}
                >
                  <tbody>
                    <tr>
                      <td style={{ padding: "24px 32px", borderBottom: `1px solid ${LINE}` }}>
                        <span style={{ fontSize: 20, fontWeight: 700, color: INK }}>
                          {site.name}
                        </span>
                        <span style={{ fontSize: 13, color: MUTED }}>{site.tagline}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "28px 32px" }}>
                        <h1
                          style={{
                            margin: "0 0 16px",
                            fontSize: 22,
                            lineHeight: "1.3",
                            color: INK,
                          }}
                        >
                          {title}
                        </h1>
                        {children}
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          padding: "20px 32px",
                          borderTop: `1px solid ${LINE}`,
                          fontSize: 12,
                          lineHeight: "1.5",
                          color: MUTED,
                        }}
                      >
                        {internal ? (
                          <p style={{ margin: "0 0 8px" }}>
                            Internal store notification. No customer action is
                            required; the database remains the source of truth.
                          </p>
                        ) : (
                          <p style={{ margin: "0 0 8px" }}>
                            You are receiving this message because an order was
                            placed on {site.name}. Need help? Reply to this
                            email or use our{" "}
                            <a href={contactUrl()} style={{ color: BRAND_DARK }}>
                              contact form
                            </a>
                            .
                          </p>
                        )}
                        <p style={{ margin: 0 }}>{site.tagline}</p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

/** Primary action button. Kept as a table cell for Outlook-class clients. */
export function EmailButton({ href, label }: { href: string; label: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "20px 0 0" }}>
      <tbody>
        <tr>
          <td
            align="center"
            style={{
              backgroundColor: BRAND,
              borderRadius: 8,
              padding: "12px 24px",
            }}
          >
            <a
              href={href}
              style={{
                display: "inline-block",
                fontSize: 15,
                fontWeight: 600,
                color: "#ffffff",
                textDecoration: "none",
              }}
            >
              {label}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Label / value summary rows (totals, order meta). */
export function SummaryRows({
  rows,
}: {
  rows: Array<{ label: string; value: string; strong?: boolean }>;
}) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td
              style={{
                padding: "6px 0",
                fontSize: 14,
                color: MUTED,
                borderBottom: row.strong ? `2px solid ${LINE}` : "none",
              }}
            >
              {row.label}
            </td>
            <td
              align="right"
              style={{
                padding: "6px 0",
                fontSize: row.strong ? 16 : 14,
                fontWeight: row.strong ? 700 : 500,
                color: INK,
                borderBottom: row.strong ? `2px solid ${LINE}` : "none",
              }}
            >
              {row.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface EmailItem {
  title: string;
  variantTitle: string;
  quantity: number;
  lineTotal: string;
  imageUrl?: string | null;
}

/** Ordered items with optional product thumbnails. */
export function ItemList({
  items,
  showLineTotals = true,
}: {
  items: EmailItem[];
  showLineTotals?: boolean;
}) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        {items.map((item) => (
          <tr key={`${item.title}-${item.variantTitle}`}>
            <td style={{ padding: "10px 0", verticalAlign: "top", width: 56 }}>
              {item.imageUrl ? (
                // Email HTML: next/image is not available outside the Next runtime.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  width={48}
                  height={48}
                  alt={item.title}
                  style={{
                    display: "block",
                    width: 48,
                    height: 48,
                    borderRadius: 6,
                    objectFit: "cover",
                    border: `1px solid ${LINE}`,
                  }}
                />
              ) : null}
            </td>
            <td style={{ padding: "10px 12px", verticalAlign: "top" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: INK }}>
                {item.title}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>
                {item.variantTitle}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>
                Qty {item.quantity}
              </p>
            </td>
            {showLineTotals ? (
              <td
                align="right"
                style={{ padding: "10px 0", verticalAlign: "top", fontSize: 14, color: INK }}
              >
                {item.lineTotal}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Body paragraph. */
export function EmailText({ children }: { children: ReactNode }) {
  return (
    <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: "1.6", color: MUTED }}>
      {children}
    </p>
  );
}

/** Shipment facts block (carrier / tracking number / destination). */
export function DetailList({
  rows,
}: {
  rows: Array<{ label: string; value: string; href?: string }>;
}) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{
        borderCollapse: "collapse",
        backgroundColor: "#fafafa",
        borderRadius: 8,
        border: `1px solid ${LINE}`,
        margin: "16px 0",
      }}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td style={{ padding: "8px 14px", fontSize: 13, color: MUTED }}>{row.label}</td>
            <td
              align="right"
              style={{ padding: "8px 14px", fontSize: 13, color: INK, fontWeight: 600 }}
            >
              {row.href ? (
                <a href={row.href} style={{ color: BRAND_DARK }}>
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
