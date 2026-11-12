/**
 * Who may open a ShootPortal payment receipt.
 *
 * - Business owners/admins: any payment of their business (deleted projects included).
 * - Staff: payments on projects they can access, and only with the money.view permission.
 * - Clients: payments on projects they are assigned to, unless the business hides
 *   Payments for that project. Share viewers (project_shares) never see receipts.
 * - Signed pay link holders: only that one payment, with client/project details removed.
 *
 * Every lookup is scoped to the current tenant's business_id, and the payment's project is
 * checked against the URL so a receipt can never be shown under another project.
 */
import { getProfile } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { resolveProjectAccess } from "@/lib/project-access";
import { staffCan } from "@/lib/staff-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { resolvePublicPayment } from "@/lib/public-pay";
import type { PaymentReceipt } from "@/lib/payment-receipt";
import type { Payment, Profile } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ReceiptAudience = "business" | "client";

export type AuthorizedReceipt = {
  payment: Payment;
  businessId: string;
  audience: ReceiptAudience;
  profile: Profile;
};

export type ReceiptAuthFailure = "unauthenticated" | "not_found";

export async function authorizeReceiptViewer(
  paymentId: string,
  opts?: { projectId?: string }
): Promise<{ ok: true; value: AuthorizedReceipt } | { ok: false; reason: ReceiptAuthFailure }> {
  const profile = await getProfile();
  if (!profile) return { ok: false, reason: "unauthenticated" };
  if (!UUID_RE.test(paymentId)) return { ok: false, reason: "not_found" };
  if (opts?.projectId && !UUID_RE.test(opts.projectId)) return { ok: false, reason: "not_found" };

  const tenant = await getTenantContext();
  if (!tenant) return { ok: false, reason: "not_found" };
  const businessId = tenant.businessId;

  const db = await createTenantServiceClient(businessId);
  const { data } = await db.from("payments").select("*").eq("id", paymentId).maybeSingle();
  const payment = data as Payment | null;
  if (!payment || !payment.project_id) return { ok: false, reason: "not_found" };
  if (payment.business_id && payment.business_id !== businessId) return { ok: false, reason: "not_found" };
  if (opts?.projectId && opts.projectId !== payment.project_id) return { ok: false, reason: "not_found" };

  const access = await resolveProjectAccess(profile, payment.project_id, {
    tenantBusinessId: businessId,
    includeDeleted: true,
  });
  if (!access.allowed || access.kind === "share") return { ok: false, reason: "not_found" };
  if (access.businessId && access.businessId !== businessId) return { ok: false, reason: "not_found" };

  if (access.kind === "admin") {
    if (profile.role === "staff" && !staffCan(profile, "money.view")) return { ok: false, reason: "not_found" };
    return { ok: true, value: { payment, businessId, audience: "business", profile } };
  }

  // Assigned client: honour the business's per-project Payments visibility.
  const { data: project } = await db
    .from("projects")
    .select("client_section_payments")
    .eq("id", payment.project_id)
    .maybeSingle();
  if ((project as { client_section_payments?: boolean } | null)?.client_section_payments === false) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, value: { payment, businessId, audience: "client", profile } };
}

/** Signed pay-link (/pay/{token}) holder: that payment only, on its own business's domain. */
export async function authorizePayLinkReceipt(token: string): Promise<{ payment: Payment; businessId: string } | null> {
  const resolved = await resolvePublicPayment(token);
  if (!resolved?.payment.project_id) return null;
  return { payment: resolved.payment, businessId: resolved.businessId };
}

/** Pay links are bearer links: drop who paid and which property, keep what was bought. */
export function redactReceiptForPayLink(receipt: PaymentReceipt): PaymentReceipt {
  return { ...receipt, clientName: "", projectName: "", propertyAddress: "", appliedToward: null };
}

export function receiptPagePath(audience: ReceiptAudience, projectId: string, paymentId: string): string {
  return audience === "business"
    ? `/admin/projects/${projectId}/receipts/${paymentId}`
    : `/dashboard/projects/${projectId}/receipts/${paymentId}`;
}
