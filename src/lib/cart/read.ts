import { storeCurrency } from "@/lib/config/env";

import { readCartTokenHash } from "./session";
import { getCartViewByTokenHash } from "./service";
import { emptyCartView, type CartView } from "./view";

/** Read-only cart view for the current request. Never creates a cart/cookie. */
export async function loadCartView(): Promise<CartView> {
  const tokenHash = await readCartTokenHash();
  if (!tokenHash) return emptyCartView(storeCurrency());
  return getCartViewByTokenHash(tokenHash);
}

/** Badge count (sum of line quantities). */
export async function loadCartCount(): Promise<number> {
  const view = await loadCartView();
  return view.totalQuantity;
}