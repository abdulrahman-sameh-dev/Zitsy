import { CartView } from "@/components/storefront/cart-view";
import { loadCartView } from "@/lib/cart/read";

export const metadata = {
  title: "Cart",
};

export default async function CartPage() {
  const cart = await loadCartView();
  return <CartView cart={cart} />;
}