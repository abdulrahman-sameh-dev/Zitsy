/**
 * Pure cart projection: turns persisted cart rows into a serializable view
 * using CURRENT server-side variant prices and availability. No I/O.
 */

export type UnavailableReason =
  | "product_hidden"
  | "variant_disabled"
  | "variant_unavailable";

export interface CartLineView {
  itemId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  imageSrc: string | null;
  quantity: number;
  /** Current server price for the variant. */
  unitPriceMinor: number;
  /** Price captured when the item was added/updated, for change detection. */
  recordedPriceMinor: number;
  lineTotalMinor: number;
  currency: string;
  available: boolean;
  unavailableReason: UnavailableReason | null;
  priceChanged: boolean;
}

export interface CartView {
  lines: CartLineView[];
  /** Sum of every line quantity (used for the header badge). */
  totalQuantity: number;
  /** Sum of available line quantities. */
  availableQuantity: number;
  /** Available lines only. */
  subtotalMinor: number;
  currency: string;
  hasUnavailable: boolean;
  priceChanged: boolean;
  canCheckout: boolean;
}

export interface CartItemRecord {
  id: string;
  quantity: number;
  unitPriceMinor: number;
  currency: string;
  variant: {
    id: string;
    title: string;
    priceMinor: number;
    currency: string;
    isEnabled: boolean;
    isAvailable: boolean;
    product: {
      id: string;
      slug: string;
      title: string;
      visible: boolean;
      images: Array<{ src: string }>;
    };
  };
}

export interface CartRecord {
  items: CartItemRecord[];
}

export function emptyCartView(currency: string): CartView {
  return {
    lines: [],
    totalQuantity: 0,
    availableQuantity: 0,
    subtotalMinor: 0,
    currency,
    hasUnavailable: false,
    priceChanged: false,
    canCheckout: false,
  };
}

function unavailableReason(item: CartItemRecord): UnavailableReason | null {
  const { variant } = item;
  if (!variant.product.visible) return "product_hidden";
  if (!variant.isEnabled) return "variant_disabled";
  if (!variant.isAvailable) return "variant_unavailable";
  return null;
}

export function buildCartView(
  cart: CartRecord | null,
  fallbackCurrency: string,
): CartView {
  if (!cart || cart.items.length === 0) return emptyCartView(fallbackCurrency);

  const lines: CartLineView[] = cart.items.map((item) => {
    const reason = unavailableReason(item);
    const available = reason === null;
    const unitPriceMinor = item.variant.priceMinor;
    const priceChanged = available && unitPriceMinor !== item.unitPriceMinor;

    return {
      itemId: item.id,
      productId: item.variant.product.id,
      productSlug: item.variant.product.slug,
      productTitle: item.variant.product.title,
      variantId: item.variant.id,
      variantTitle: item.variant.title,
      imageSrc: item.variant.product.images[0]?.src ?? null,
      quantity: item.quantity,
      unitPriceMinor,
      recordedPriceMinor: item.unitPriceMinor,
      lineTotalMinor: unitPriceMinor * item.quantity,
      currency: item.variant.currency,
      available,
      unavailableReason: reason,
      priceChanged,
    };
  });

  const availableLines = lines.filter((line) => line.available);
  const subtotalMinor = availableLines.reduce(
    (sum, line) => sum + line.lineTotalMinor,
    0,
  );

  return {
    lines,
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    availableQuantity: availableLines.reduce((sum, line) => sum + line.quantity, 0),
    subtotalMinor,
    currency: availableLines[0]?.currency ?? lines[0].currency,
    hasUnavailable: lines.some((line) => !line.available),
    priceChanged: lines.some((line) => line.priceChanged),
    canCheckout: availableLines.length > 0 && lines.every((line) => line.available),
  };
}