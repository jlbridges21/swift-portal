import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isBankPaymentAvailable } from "@/lib/stripe-connect";
import { getAppSettings } from "@/lib/app-settings";

export const runtime = "nodejs";

/** Which payment methods this business's clients can use. For the project payment area. */
export async function GET() {
  try {
    const profile = await requireAdmin({ permission: "money.send_payment_links" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const [bankAvailable, settings] = await Promise.all([isBankPaymentAvailable(tenant.businessId), getAppSettings(tenant.businessId)]);
    return NextResponse.json({
      bankAvailable,
      passCardFee: settings.workflow.payments.passCardFeeToClient,
      // Only the owner can change Stripe settings (Settings → Payments is admin-only).
      canManage: isOwnerAdmin(profile),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
