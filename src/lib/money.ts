/** Money is always handled as integer minor units (pence). */

export function formatMoney(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(minor / 100);
}

/** Decimal string accepted by PayPal ("12.34"). Never parses client input. */
export function toDecimalString(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function quantityLabel(quantity: number): string {
  return quantity === 1 ? "1 item" : `${quantity} items`;
}
