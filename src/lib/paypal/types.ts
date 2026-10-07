/**
 * Minimal gateway surface the checkout/webhook code depends on. Kept as an
 * interface so tests can inject a deterministic fake instead of hitting PayPal.
 */
export interface PaypalGateway {
  createOrder(input: PaypalCreateOrderInput): Promise<PaypalOrder>;
  captureOrder(paypalOrderId: string, requestId?: string): Promise<PaypalOrder>;
  getOrder(paypalOrderId: string): Promise<PaypalOrder>;
  verifyWebhookSignature(
    input: PaypalVerifyWebhookInput,
  ): Promise<PaypalVerifyWebhookResult>;
}

export interface PaypalMoney {
  currency_code: string;
  value: string;
}

export interface PaypalCapture {
  id: string;
  status: string;
  amount?: PaypalMoney;
  create_time?: string;
  update_time?: string;
  custom_id?: string;
}

export interface PaypalOrder {
  id: string;
  status: string;
  purchase_units?: Array<{
    reference_id?: string;
    custom_id?: string;
    amount?: PaypalMoney;
    payments?: { captures?: PaypalCapture[] };
  }>;
  payer?: {
    email_address?: string;
    name?: { given_name?: string; surname?: string };
  };
  links?: PaypalLink[];
}

export interface PaypalLink {
  href: string;
  rel: string;
  method?: string;
}

export interface PaypalCreateOrderInput {
  amount: PaypalMoney;
  referenceId: string;
  customId: string;
  description: string;
}

export interface PaypalVerifyWebhookInput {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId: string;
  webhookEvent: unknown;
}

export interface PaypalVerifyWebhookResult {
  verification_status: string;
}

export interface PaypalWebhookEvent {
  id: string;
  event_type: string;
  resource_type?: string;
  resource?: Record<string, unknown>;
  create_time?: string;
}