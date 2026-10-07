export interface PrintifyOptionValue {
  id: number;
  title: string;
}

export interface PrintifyOption {
  name: string;
  type: string;
  values: PrintifyOptionValue[];
}

export interface PrintifyVariant {
  id: number;
  sku?: string;
  cost?: number;
  price: number;
  title?: string;
  grams?: number;
  is_enabled?: boolean;
  is_default?: boolean;
  is_available?: boolean;
  options: number[];
}

export interface PrintifyImage {
  src: string;
  variant_ids?: number[];
  position?: string;
  is_default?: boolean;
}

export interface PrintifyProduct {
  id: string;
  title: string;
  description?: string | null;
  tags?: string[];
  options?: PrintifyOption[];
  variants?: PrintifyVariant[];
  images?: PrintifyImage[];
  created_at?: string;
  updated_at?: string;
  visible?: boolean;
  blueprint_id?: number;
  print_provider_id?: number;
}

export interface PrintifyProductList {
  current_page?: number;
  data: PrintifyProduct[];
  last_page?: number;
  next_page_url?: string | null;
  per_page?: number;
  total?: number;
}

export interface PrintifyWebhook {
  id: string;
  url: string;
  topic: string;
  shop_id?: string;
  secret?: string;
}

export interface PrintifyAddressTo {
  first_name: string;
  last_name: string;
  region?: string | null;
  address1: string;
  address2?: string;
  city: string;
  zip: string;
  email: string;
  phone?: string;
  country: string;
}

export interface PrintifyLineItem {
  product_id: string;
  variant_id: number;
  quantity: number;
}

export interface PrintifyShippingRequest {
  line_items: PrintifyLineItem[];
  address_to: PrintifyAddressTo;
}

export interface PrintifyCreateOrderRequest extends PrintifyShippingRequest {
  external_id?: string;
  label?: string;
  shipping_method?: number;
  send_shipping_notification?: boolean;
}

export interface PrintifyShipment {
  carrier?: string;
  number?: string;
  url?: string;
  delivered_at?: string | null;
}

export interface PrintifyOrderLineItem {
  product_id?: string;
  variant_id?: number;
  quantity?: number;
  status?: string;
  metadata?: {
    title?: string;
    sku?: string | null;
    variant_label?: string;
    external_id?: string | null;
    [key: string]: unknown;
  };
}

export interface PrintifyOrder {
  id: string;
  status?: string;
  /** Merchant-supplied stable reference echoed back by Printify. */
  external_id?: string | null;
  address_to?: PrintifyAddressTo;
  line_items?: PrintifyOrderLineItem[];
  metadata?: {
    shop_order_label?: string | null;
    shop_order_id?: number;
    [key: string]: unknown;
  } | null;
  total_price?: number;
  total_shipping?: number;
  shipments?: PrintifyShipment[];
  sent_to_production_at?: string | null;
  fulfilled_at?: string | null;
  created_at?: string;
}

export interface PrintifyOrderList {
  current_page?: number;
  data: PrintifyOrder[];
  last_page?: number;
  next_page_url?: string | null;
  per_page?: number;
  total?: number;
}

/**
 * The subset of the Printify client that fulfillment depends on. Keeping this
 * boundary tiny lets tests inject a deterministic fake without any network.
 */
export interface PrintifyOrderGateway {
  createOrder(body: PrintifyCreateOrderRequest): Promise<PrintifyOrder>;
  getOrder(orderId: string): Promise<PrintifyOrder>;
  sendToProduction(orderId: string): Promise<PrintifyOrder>;
  listOrders(page?: number, limit?: number): Promise<PrintifyOrderList>;
}

export interface PrintifyShippingCosts {
  standard?: number;
  express?: number;
  priority?: number;
  economy?: number;
}

export interface PrintifyWebhookEvent {
  id?: string;
  type?: string;
  created_at?: string;
  shop_id?: string | number;
  resource?: {
    id?: string;
    type?: string;
    data?: Record<string, unknown>;
  };
  data?: Record<string, unknown>;
}