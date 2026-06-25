import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .single();

  if (!payment || payment.status !== "paid") {
    return NextResponse.json({ error: "Receipt not available" }, { status: 404 });
  }

  if (payment.stripe_receipt_url) {
    return NextResponse.redirect(payment.stripe_receipt_url);
  }

  if (payment.stripe_checkout_session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        payment.stripe_checkout_session_id
      ) as { receipt_url?: string | null };
      if (session.receipt_url) {
        await supabase
          .from("payments")
          .update({ stripe_receipt_url: session.receipt_url })
          .eq("id", id);
        return NextResponse.redirect(session.receipt_url);
      }
    } catch {
      // fall through to generated receipt
    }
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt — Swift Aerial Media</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:40px auto;padding:24px;color:#0f172a}
h1{font-size:20px;margin:0 0 8px}p{margin:4px 0;color:#64748b;font-size:14px}
.amount{font-size:28px;font-weight:700;color:#0f172a;margin:16px 0}
.badge{display:inline-block;background:#ecfdf5;color:#059669;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600}
</style></head><body>
<h1>Swift Aerial Media</h1><p>Payment Receipt</p>
<div class="amount">$${(payment.amount / 100).toFixed(2)}</div>
<p>${payment.description}</p>
<p>Paid: ${payment.paid_at ? new Date(payment.paid_at).toLocaleString() : "—"}</p>
<p>Reference: ${payment.id.slice(0, 8).toUpperCase()}</p>
<span class="badge">PAID</span>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}
