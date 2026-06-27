import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { handlePaymentSuccess } from "@/lib/stripe-payments";
import type { Payment } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const projectId = typeof body.project_id === "string" ? body.project_id : null;

    const supabase = await createServiceClient();

    const { data: payment, error: fetchError } = await supabase
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

    const { data: updated } = await supabase.from("payments").select("*").eq("id", id).single();
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
    await requireAdmin();
    const { id } = await params;
    const supabase = await createServiceClient();

    const { error } = await supabase.from("payments").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
