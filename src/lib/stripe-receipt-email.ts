/**
 * Branded payment receipt email. One send per recipient per payment.
 * Portal links use the business origin. Stripe's own receipt email is not
 * triggered here (we never set receipt_email on the PaymentIntent).
 */
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { sendBrandedEmail } from "@/lib/email";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { hasStaffPermission } from "@/lib/staff-permissions";
import type { Payment } from "@/lib/types";

export type ReceiptAudience = "client" | "business";

export type ReceiptMail = {
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: ReceiptAudience;
};

type SendReceipt = (mail: ReceiptMail) => Promise<void>;

function receiptBody(args: {
  amountLabel: string;
  projectLabel: string;
  paidAt: string | null;
  cardLast4: string | null;
  receiptUrl: string | null;
}): string {
  const when = args.paidAt
    ? new Date(args.paidAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
    : "just now";
  const lines = [
    `${args.amountLabel} was paid for ${args.projectLabel}.`,
    `Paid ${when}.`,
  ];
  if (args.cardLast4) lines.push(`Card ending ${args.cardLast4}.`);
  if (args.receiptUrl) lines.push(`Stripe receipt: ${args.receiptUrl}`);
  return lines.join(" ");
}

export function buildReceiptMail(args: {
  to: string;
  audience: ReceiptAudience;
  amountLabel: string;
  projectLabel: string;
  paidAt: string | null;
  cardLast4: string | null;
  receiptUrl: string | null;
  portalUrl: string;
}): ReceiptMail {
  const subject = args.audience === "client" ? "Your payment receipt" : "Payment receipt";
  return {
    to: args.to,
    audience: args.audience,
    subject,
    title: subject,
    body: receiptBody(args),
    ctaLabel: "View in portal",
    ctaUrl: args.portalUrl,
  };
}

async function receiptAlreadySent(
  businessId: string,
  paymentId: string,
  recipient: string
): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("email_events")
    .select("id")
    .eq("email_type", "payment_receipt")
    .eq("event_type", "sent")
    .eq("recipient", recipient)
    .filter("metadata->>paymentId", "eq", paymentId)
    .limit(1);
  return Boolean(data?.length);
}

async function recordReceiptSend(
  businessId: string,
  payment: Payment,
  mail: ReceiptMail
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  await db.from("email_events").insert({
    project_id: payment.project_id,
    recipient: mail.to,
    email_type: "payment_receipt",
    event_type: "sent",
    metadata: {
      paymentId: payment.id,
      audience: mail.audience,
      subject: mail.subject,
    },
  });
}

async function loadClientEmails(businessId: string, payment: Payment): Promise<string[]> {
  const db = await createTenantServiceClient(businessId);
  const ids = new Set<string>();
  if (payment.client_id) ids.add(payment.client_id);
  const { data: project } = await db
    .from("projects")
    .select("client_id")
    .eq("id", payment.project_id)
    .maybeSingle();
  if (project?.client_id) ids.add(project.client_id);
  const { data: links } = await db
    .from("project_clients")
    .select("client_id")
    .eq("project_id", payment.project_id);
  for (const row of links ?? []) ids.add(row.client_id);
  if (!ids.size) return [];
  const { data: clients } = await db
    .from("clients")
    .select("email")
    .in("id", Array.from(ids));
  return [...new Set((clients ?? []).map((c) => (c.email || "").trim()).filter(Boolean))];
}

async function loadBusinessEmails(businessId: string, projectId: string): Promise<string[]> {
  const db = await createTenantServiceClient(businessId);
  const { data: admins } = await db.raw
    .from("profiles")
    .select("email, email_notifications_enabled")
    .eq("role", "admin")
    .eq("business_id", businessId);
  const emails = new Set<string>();
  for (const admin of admins ?? []) {
    if (admin.email_notifications_enabled === false) continue;
    const email = (admin.email || "").trim();
    if (email) emails.add(email);
  }

  const { data: staffRows } = await db.raw
    .from("profiles")
    .select("id, email, staff_permissions, email_notifications_enabled, disabled_at")
    .eq("role", "staff")
    .eq("business_id", businessId)
    .is("disabled_at", null);
  const { data: assigned } = await db.raw
    .from("project_staff")
    .select("user_id")
    .eq("business_id", businessId)
    .eq("project_id", projectId);
  const assignedIds = new Set((assigned ?? []).map((row) => row.user_id as string));
  for (const staff of staffRows ?? []) {
    if (staff.email_notifications_enabled === false) continue;
    if (!hasStaffPermission(staff.staff_permissions, "money.view")) continue;
    const viewAll = hasStaffPermission(staff.staff_permissions, "projects.view_all");
    if (!viewAll && !assignedIds.has(staff.id)) continue;
    const email = (staff.email || "").trim();
    if (email) emails.add(email);
  }
  return [...emails];
}

/**
 * Emails the client (when the receipt toggle is on) and the business
 * (when the payment-received email channel is on). A second call for the
 * same payment and recipient does not send again.
 */
export async function sendPaymentReceiptEmails(
  args: {
    businessId: string;
    payment: Payment;
    amountLabel: string;
    projectLabel: string;
    receiptUrl: string | null;
    cardLast4: string | null;
    sendClient: boolean;
  },
  deps?: {
    send?: SendReceipt;
    clientEmails?: string[];
    businessEmails?: string[];
  }
): Promise<{ sent: ReceiptMail[]; skipped: string[] }> {
  const settings = await getAppSettings(args.businessId);
  const origin = await getBusinessPortalOriginById(args.businessId);
  const clientPortal = `${origin}/dashboard/projects/${args.payment.project_id}#payments`;
  const businessPortal = `${origin}/admin/projects/${args.payment.project_id}#payments`;
  const send = deps?.send ?? (async (mail: ReceiptMail) => {
    await sendBrandedEmail({
      businessId: args.businessId,
      to: mail.to,
      subject: mail.subject,
      title: mail.title,
      body: mail.body,
      ctaLabel: mail.ctaLabel,
      ctaUrl: mail.ctaUrl,
      emailType: "payment_receipt",
      analytics: {
        projectId: args.payment.project_id,
        emailType: "payment_receipt",
      },
    });
  });

  const sent: ReceiptMail[] = [];
  const skipped: string[] = [];
  const detail = {
    amountLabel: args.amountLabel,
    projectLabel: args.projectLabel,
    paidAt: args.payment.paid_at,
    cardLast4: args.cardLast4,
    receiptUrl: args.receiptUrl,
  };

  if (args.sendClient) {
    const clients = deps?.clientEmails ?? (await loadClientEmails(args.businessId, args.payment));
    for (const to of clients) {
      if (await receiptAlreadySent(args.businessId, args.payment.id, to)) {
        skipped.push(to);
        continue;
      }
      const mail = buildReceiptMail({ ...detail, to, audience: "client", portalUrl: clientPortal });
      await recordReceiptSend(args.businessId, args.payment, mail);
      await send(mail);
      sent.push(mail);
    }
  }

  const businessChannel = settings.notifications.payment_received;
  if (businessChannel?.email !== false) {
    const business = deps?.businessEmails ?? (await loadBusinessEmails(args.businessId, args.payment.project_id));
    for (const to of business) {
      if (await receiptAlreadySent(args.businessId, args.payment.id, to)) {
        skipped.push(to);
        continue;
      }
      const mail = buildReceiptMail({ ...detail, to, audience: "business", portalUrl: businessPortal });
      await recordReceiptSend(args.businessId, args.payment, mail);
      await send(mail);
      sent.push(mail);
    }
  }

  return { sent, skipped };
}
