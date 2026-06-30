import type Stripe from "stripe";

export const STRIPE_PAYMENT_SOURCE = "swift-portal";

export function buildStripePaymentMetadata(params: {
  paymentId: string;
  projectId?: string;
  clientId?: string;
}): Stripe.MetadataParam {
  const meta: Record<string, string> = {
    paymentId: params.paymentId,
    payment_id: params.paymentId,
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

export function parsePaymentIdFromMetadata(
  metadata: Stripe.Metadata | null | undefined
): string | undefined {
  if (!metadata) return undefined;
  return metadata.paymentId || metadata.payment_id || undefined;
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
