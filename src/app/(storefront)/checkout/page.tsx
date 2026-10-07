import { connection } from "next/server";

import { CheckoutForm } from "@/components/checkout/checkout-form";
import { loadCartView } from "@/lib/cart/read";
import { paypalClientId } from "@/lib/config/env";

export const metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  await connection();
  const cart = await loadCartView();

  if (cart.lines.length === 0) {
    return (
      <div className="container-page flex flex-col items-center gap-5 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Your cart is empty
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Add something to your cart before checking out.
        </p>
        <a
          href="/shop"
          className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Browse products
        </a>
      </div>
    );
  }

  if (!cart.canCheckout) {
    return (
      <div className="container-page flex flex-col items-center gap-5 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Your cart needs attention
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted">
          Some items are unavailable or have changed. Please review your cart to
          continue.
        </p>
        <a
          href="/cart"
          className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
        >
          Review cart
        </a>
      </div>
    );
  }

  const shippingMinor = 0;
  const totalMinor = cart.subtotalMinor + shippingMinor;

  return (
    <div className="container-page py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Checkout
      </h1>
      <p className="mt-2 text-sm text-muted">
        Enter your delivery details, then pay securely with PayPal.
      </p>
      <div className="mt-8">
        <CheckoutForm
          lines={cart.lines.map((line) => ({
            title: line.productTitle,
            variantTitle: line.variantTitle,
            quantity: line.quantity,
            totalPriceMinor: line.lineTotalMinor,
            currency: line.currency,
          }))}
          subtotalMinor={cart.subtotalMinor}
          shippingMinor={shippingMinor}
          totalMinor={totalMinor}
          currency={cart.currency}
          paypalClientId={paypalClientId()}
        />
      </div>
    </div>
  );
}