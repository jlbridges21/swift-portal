import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { resolveProjectAccess } from "@/lib/project-access";
import { staffCan } from "@/lib/staff-access";
import { resolveStripeReceipt } from "@/lib/stripe-receipt";
import { getAppSettings } from "@/lib/app-settings";
import { buildPaymentRecordPdf, type PaymentRecordInput } from "@/lib/payment-record-pdf";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const businessId = tenant.businessId;

  const { id } = await params;
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .eq("business_id", businessId)
    .single();

  if (!payment || payment.status !== "paid" || !payment.project_id) {
    return NextResponse.json({ error: "Receipt not available" }, { status: 404 });
  }

  const access = await resolveProjectAccess(profile, payment.project_id, {
    tenantBusinessId: businessId,
  });
  if (!access.allowed || access.kind === "share") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (profile.role === "staff" && !staffCan(profile, "money.view")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.stripe_receipt_url) {
    return NextResponse.redirect(payment.stripe_receipt_url);
  }

  if (payment.stripe_payment_intent_id) {
    try {
      const receipt = await resolveStripeReceipt({
        paymentIntentId: payment.stripe_payment_intent_id,
        stripeAccountId: payment.stripe_account_id,
      });
      if (receipt.receiptUrl) {
        const db = await createTenantServiceClient(businessId);
        await db
          .from("payments")
          .update({
            stripe_receipt_url: receipt.receiptUrl,
            card_last4: payment.card_last4 ?? receipt.cardLast4,
          })
          .eq("id", id);
        return NextResponse.redirect(receipt.receiptUrl);
      }
    } catch {
      // Stripe has no readable receipt. Fall through to the payment record.
    }
  }

  const pdf = await buildPaymentRecordPdf(await loadPaymentRecordInput(businessId, payment));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="payment-record-${payment.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function loadPaymentRecordInput(
  businessId: string,
  payment: {
    id: string;
    amount: number;
    paid_at: string | null;
    card_last4?: string | null;
    client_id: string | null;
    project_id: string;
    stripe_payment_intent_id?: string | null;
    stripe_checkout_session_id?: string | null;
    stripe_receipt_url?: string | null;
  }
): Promise<PaymentRecordInput> {
  const db = await createTenantServiceClient(businessId);
  const settings = await getAppSettings(businessId);
  const business = settings.business;
  const [{ data: project }, { data: client }] = await Promise.all([
    db.from("projects").select("project_name, property_address, client_id").eq("id", payment.project_id).maybeSingle(),
    payment.client_id
      ? db.from("clients").select("name").eq("id", payment.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  let clientName = client?.name || "";
  if (!clientName && project?.client_id) {
    const { data: projectClient } = await db.from("clients").select("name").eq("id", project.client_id).maybeSingle();
    clientName = projectClient?.name || "";
  }
  const address = [business.addressLine1, business.addressLine2, [business.city, business.state, business.postalCode].filter(Boolean).join(" "), business.country]
    .map((line) => (line || "").trim())
    .filter(Boolean);
  const logo = await loadLogo(business.logoUrl || business.emailLogoUrl);
  const paidWithStripe = Boolean(
    payment.stripe_receipt_url || payment.stripe_payment_intent_id || payment.stripe_checkout_session_id
  );
  return {
    businessName: business.businessName || business.portalName,
    addressLines: address,
    logoBytes: logo?.bytes,
    logoType: logo?.type,
    clientName: clientName || "Client",
    projectName: project?.project_name || "Project",
    propertyAddress: project?.property_address || "",
    amountLabel: formatCurrency(payment.amount),
    paidAtLabel: formatDate(payment.paid_at),
    recordedAs: paidWithStripe ? "Paid with Stripe" : "Marked paid by the business",
    reference: payment.id,
    cardLast4: payment.card_last4,
  };
}

async function loadLogo(url: string | null | undefined): Promise<{ bytes: Uint8Array; type: "png" | "jpg" } | null> {
  const trimmed = url?.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  try {
    const res = await fetch(trimmed);
    if (!res.ok) return null;
    const typeHeader = res.headers.get("content-type") || "";
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (typeHeader.includes("png") || trimmed.toLowerCase().includes(".png")) return { bytes, type: "png" };
    if (typeHeader.includes("jpeg") || typeHeader.includes("jpg") || /\.jpe?g($|\?)/i.test(trimmed)) {
      return { bytes, type: "jpg" };
    }
    const sharp = (await import("sharp")).default;
    const png = await sharp(bytes).png().toBuffer();
    return { bytes: new Uint8Array(png), type: "png" };
  } catch {
    return null;
  }
}
