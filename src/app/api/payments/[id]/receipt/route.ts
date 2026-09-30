import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { resolveProjectAccess } from "@/lib/project-access";
import { staffCan } from "@/lib/staff-access";
import { resolveStripeReceipt } from "@/lib/stripe-receipt";

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

  if (!payment.stripe_payment_intent_id) {
    return NextResponse.json({ error: "Receipt not available" }, { status: 404 });
  }

  try {
    const receipt = await resolveStripeReceipt({
      paymentIntentId: payment.stripe_payment_intent_id,
      stripeAccountId: payment.stripe_account_id,
    });
    if (!receipt.receiptUrl) {
      return NextResponse.json({ error: "Receipt not available" }, { status: 404 });
    }
    const db = await createTenantServiceClient(businessId);
    await db
      .from("payments")
      .update({
        stripe_receipt_url: receipt.receiptUrl,
        card_last4: payment.card_last4 ?? receipt.cardLast4,
      })
      .eq("id", id);
    return NextResponse.redirect(receipt.receiptUrl);
  } catch {
    return NextResponse.json({ error: "Receipt not available" }, { status: 404 });
  }
}
