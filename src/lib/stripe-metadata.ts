import type Stripe from "stripe";

export const STRIPE_PAYMENT_SOURCE = "swift-portal";

export function buildStripePaymentMetadata(params: {
  paymentId: string;
  businessId: string;
  projectId?: string;
  clientId?: string;
}): Stripe.MetadataParam {
  const meta: Record<string, string> = {
    paymentId: params.paymentId,
    payment_id: params.paymentId,
    businessId: params.businessId,
    business_id: params.businessId,
    source: STRIPE_PAYMENT_SOURCE,
  };
  if (params.projectId) {
    meta.projectId = params.projectId;
    meta.project_id = params.projectId;
  }
  if (params.clientId) {
    meta.clientId = params.clientId;
    meta.client_id = params.clientId;
  }
  return meta;
}

/** Card fee the client paid on top of the invoice amount (cents), stamped on card checkouts. */
export const CLIENT_FEE_METADATA_KEY = "client_fee_cents";

export function parseClientFeeFromMetadata(metadata: Stripe.Metadata | null | undefined): number {
  const raw = metadata?.[CLIENT_FEE_METADATA_KEY];
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function parsePaymentIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | undefined {
  if (!metadata) return undefined;
  return metadata.paymentId || metadata.payment_id || undefined;
}

export function parseBusinessIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | undefined {
  if (!metadata) return undefined;
  return metadata.businessId || metadata.business_id || undefined;
}

export function extractStripeId(
  value: string | { id: string } | null | undefined
): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  return value.id;
}

/** Safe metadata for webhook logs — never includes secrets. */
export function sanitizeMetadataForLog(
  metadata: Stripe.Metadata | null | undefined
): Record<string, string> {
  if (!metadata) return {};
  const allowed = [
    "paymentId",
    "payment_id",
    "businessId",
    "business_id",
    "projectId",
    "project_id",
    "clientId",
    "client_id",
    "source",
    "quote_id",
    "project_name",
  ];
  const out: Record<string, string> = {};
  for (const key of allowed) {
    if (metadata[key]) out[key] = metadata[key];
  }
  return out;
}
