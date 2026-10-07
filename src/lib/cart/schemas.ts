import { z } from "zod";

/** One cart line per variant; the quantity is capped to a sensible UI bound. */
export const MAX_ITEM_QUANTITY = 99;
/** Guards against unbounded cart growth. */
export const MAX_CART_LINES = 50;

const quantity = z.number().int().min(1).max(MAX_ITEM_QUANTITY);

export const addItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity,
});

export const updateItemSchema = z.object({
  itemId: z.string().min(1),
  quantity,
});

export const removeItemSchema = z.object({
  itemId: z.string().min(1),
});

export type AddItemInput = z.infer<typeof addItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type RemoveItemInput = z.infer<typeof removeItemSchema>;