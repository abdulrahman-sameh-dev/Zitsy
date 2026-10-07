/**
 * Builds the PayPal JS SDK `createOrder` callback.
 *
 * The installed Buttons SDK (loaded from paypal.com/sdk/js) requires this
 * callback to resolve to a PayPal **order ID string**. The legacy
 * `{ orderID }` shape ("Expected an order id to be passed") and our internal
 * Zitsy order id are both invalid here. The value must be the id returned by
 * PayPal when the server created the order.
 */
export function createOrderCallback(
  paypalOrderId: string,
): () => Promise<string> {
  return async () => paypalOrderId;
}