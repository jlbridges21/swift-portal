import { createServiceClient } from "@/lib/supabase/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { parsePayLinkToken, verifyPayLinkToken } from "@/lib/pay-link";
import type { Payment } from "@/lib/types";

export type PublicPayBusiness = {
  id: string;
  slug: string;
  name: string;
  status: string;
  custom_domain: string | null;
  custom_domain_status: string | null;
  custom_domain_vercel_verified: boolean | null;
  custom_domain_misconfigured: boolean | null;
};

/** What the public pay page may show. Nothing else about the project leaves the server. */
export type PublicPayView = {
  description: string;
  amountCents: number;
  dueDate: string | null;
  status: "open" | "paid" | "processing" | "cancelled";
  paidAt: string | null;
  receiptUrl: string | null;
};

export type ResolvedPublicPayment = {
  payment: Payment;
  business: PublicPayBusiness;
  businessId: string;
};

/**
 * Resolve a signed pay link for the current host. Returns null (→ 404) when the token is
 * malformed, the signature does not match the payment's business, or the link is opened on
 * another business's domain — so a link never crosses tenants.
 */
export async function resolvePublicPayment(token: string): Promise<ResolvedPublicPayment | null> {
  const parsed = parsePayLinkToken(token);
  if (!parsed) return null;

  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return null;

  const db = await createServiceClient();
  const { data } = await db
    .from("payments")
    .select("*")
    .eq("id", parsed.paymentId)
    .eq("business_id", host.businessId)
    .maybeSingle();
  const payment = data as Payment | null;
  if (!payment?.business_id || payment.business_id !== host.businessId) return null;
  if (!verifyPayLinkToken(token, payment.business_id)) return null;

  const { data: business } = await db
    .from("businesses")
    .select("id, slug, name, status, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured")
    .eq("id", payment.business_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!business || business.status !== "active") return null;

  return { payment, business: business as PublicPayBusiness, businessId: payment.business_id };
}

export function publicPayView(payment: Payment): PublicPayView {
  const status =
    payment.status === "paid"
      ? "paid"
      : payment.status === "processing"
        ? "processing"
        : payment.status === "pending" || payment.status === "sent"
          ? "open"
          : "cancelled"; // cancelled, draft, refunded… — not payable from a link
  return {
    description: payment.description,
    amountCents: payment.amount,
    dueDate: payment.due_date,
    status,
    paidAt: payment.paid_at,
    receiptUrl: payment.stripe_receipt_url,
  };
}

export function requestIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
