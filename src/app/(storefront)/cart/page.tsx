import type { Metadata } from "next";

import { CartView } from "@/components/storefront/cart-view";
import { loadCartView } from "@/lib/cart/read";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the items in your Zitsy cart.",
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const cart = await loadCartView();
  return <CartView cart={cart} />;
}