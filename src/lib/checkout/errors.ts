export type CheckoutErrorCode =
  | "empty_cart"
  | "cart_invalid"
  | "invalid_address"
  | "unsupported_country"
  | "shipping_unavailable"
  | "unprofitable_order"
  | "paypal_unavailable"
  | "amount_mismatch"
  | "currency_mismatch"
  | "payment_reference_mismatch"
  | "capture_failed"
  | "order_not_found"
  | "payment_not_payable";

const messages: Record<CheckoutErrorCode, string> = {
  empty_cart: "Your cart is empty.",
  cart_invalid:
    "Something in your cart is no longer available. Please review your cart and try again.",
  invalid_address:
    "We could not validate that delivery address for the selected country.",
  unsupported_country: "We currently ship to the UK and Germany only.",
  shipping_unavailable:
    "We could not calculate delivery to that address. Please check the address and try again.",
  unprofitable_order:
    "This order cannot be completed at the current price. Please review your cart or try a different product.",
  paypal_unavailable:
    "Payment is temporarily unavailable. Please try again shortly.",
  amount_mismatch: "The captured amount does not match your order total.",
  currency_mismatch: "The captured currency does not match your order currency.",
  payment_reference_mismatch:
    "The payment reference does not match your order.",
  capture_failed: "We could not confirm your payment. Please try again.",
  order_not_found: "We could not find that order.",
  payment_not_payable: "This order can no longer be paid.",
};

export class CheckoutError extends Error {
  readonly code: CheckoutErrorCode;
  readonly userMessage: string;

  constructor(code: CheckoutErrorCode) {
    super(code);
    this.name = "CheckoutError";
    this.code = code;
    this.userMessage = messages[code] ?? "Something went wrong. Please try again.";
  }
}