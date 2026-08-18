import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { handlePaymentSuccess } from "@/lib/stripe-payments";
import type { Payment } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const projectId = typeof body.project_id === "string" ? body.project_id : null;

    const db = await createTenantServiceClient(businessId);

    const { data: payment, error: fetchError } = await db
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    if (projectId && payment.project_id !== projectId) {
      return NextResponse.json({ error: "Payment does not belong to this project" }, { status: 400 });
    }

    if (payment.status === "paid") {
      return NextResponse.json({ ...(payment as Payment), alreadyPaid: true });
    }

    if (payment.status !== "pending" && payment.status !== "sent") {
      return NextResponse.json(
        { error: "Only outstanding payments can be marked as paid" },
        { status: 400 }
      );
    }

    const result = await handlePaymentSuccess({
      payment: payment as Payment,
      source: "manual_admin",
    });

    const { data: updated } = await db.from("payments").select("*").eq("id", id).single();
    return NextResponse.json({ ...(updated as Payment), alreadyPaid: result.alreadyPaid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark payment as paid";
    if (message === "Unauthorized" || message === "Forbidden") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    console.error("Mark payment paid error:", err);
    return NextResponse.json({ error: "Failed to mark payment as paid" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);

    const { id } = await params;
    const db = await createTenantServiceClient(tenant.businessId);

    const { error } = await db.from("payments").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
