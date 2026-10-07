export type CartErrorCode =
  | "invalid_input"
  | "variant_not_found"
  | "variant_product_mismatch"
  | "product_unavailable"
  | "variant_disabled"
  | "variant_unavailable"
  | "item_not_found"
  | "cart_full";

const MESSAGES: Record<CartErrorCode, string> = {
  invalid_input: "That request was not valid.",
  variant_not_found: "This option is no longer available.",
  variant_product_mismatch: "That option does not belong to this product.",
  product_unavailable: "This product is no longer available.",
  variant_disabled: "This option is no longer sold.",
  variant_unavailable: "This option is currently unavailable.",
  item_not_found: "That item is no longer in your cart.",
  cart_full: "Your cart is full. Remove an item to add another.",
};

/** A safe, user-facing cart failure. Never carries sensitive detail. */
export class CartError extends Error {
  readonly code: CartErrorCode;
  readonly userMessage: string;

  constructor(code: CartErrorCode) {
    super(code);
    this.name = "CartError";
    this.code = code;
    this.userMessage = MESSAGES[code];
  }
}