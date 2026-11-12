import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { canAccessProjectAsAssignedClientOrAdmin } from "@/lib/project-access";
import { getTenantContext } from "@/lib/tenant";
import { CheckoutStartError, verifyCheckoutOutcome } from "@/lib/client-checkout";
import type { Payment } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-verified result of an embedded checkout. The modal calls this after Stripe confirms
 * in the browser (and on return from a redirect-based method). Status comes from Stripe and the
 * payment record — the same reconcile path the project page runs — never from the browser.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const tenant = await getTenantContext();
    if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const supabase = await createClient();
    const { data } = await supabase.from("payments").select("*").eq("id", id).eq("business_id", tenant.businessId).maybeSingle();
    const payment = data as Payment | null;
    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    const profile = await requireAuth();
    if (!(await canAccessProjectAsAssignedClientOrAdmin(profile, payment.project_id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");
    const thorough = url.searchParams.get("thorough") === "1";
    const outcome = await verifyCheckoutOutcome({ payment, businessId: tenant.businessId, sessionId, thorough });
    return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "Unauthorized") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (err instanceof CheckoutStartError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[payments/checkout/status] GET error:", err);
    return NextResponse.json({ error: "Could not check payment status" }, { status: 500 });
  }
}
