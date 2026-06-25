import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { handlePaymentSuccess } from "@/lib/stripe-payments";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const supabase = await createServiceClient();

    const { data: payment } = await supabase.from("payments").select("*").eq("id", id).single();
    if (!payment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await handlePaymentSuccess({
      payment: payment as import("@/lib/types").Payment,
      source: "manual_admin",
    });

    const { data: updated } = await supabase.from("payments").select("*").eq("id", id).single();
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
