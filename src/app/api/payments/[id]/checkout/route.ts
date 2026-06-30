import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getStripe } from "@/lib/stripe";
import { buildStripePaymentMetadata } from "@/lib/stripe-metadata";
import { isPaymentComplete } from "@/lib/payment-status";
import type { Payment } from "@/lib/types";

const ALREADY_PAID_MESSAGE = "This payment has already been completed.";

async function loadPayment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return data as Payment;
}

async function authorizePaymentAccess(payment: Payment) {
  const profile = await requireAuth();
  const allowed = await canAccessProject(profile, payment.project_id);
  if (!allowed) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const, profile };
}

async function createCheckoutSession(payment: Payment) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    return { ok: false as const, response: NextResponse.json({ error: "App URL not configured" }, { status: 500 }) };
  }

  const metadata = buildStripePaymentMetadata({
    paymentId: payment.id,
    projectId: payment.project_id,
    clientId: payment.client_id,
  });

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: payment.description.slice(0, 250),
          },
          unit_amount: payment.amount,
        },
        quantity: 1,
      },
    ],
    metadata,
    payment_intent_data: { metadata },
    client_reference_id: payment.id,
    success_url: `${appUrl}/dashboard/projects/${payment.project_id}?payment=success#payments`,
    cancel_url: `${appUrl}/dashboard/projects/${payment.project_id}?payment=cancelled#payments`,
  });

  if (!session.url) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 }),
    };
  }

  const supabase = await createClient();
  await supabase
    .from("payments")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", payment.id);

  return { ok: true as const, session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payment = await loadPayment(id);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const auth = await authorizePaymentAccess(payment);
    if (!auth.ok) return auth.response;

    if (isPaymentComplete(payment.status)) {
      const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${payment.project_id}?payment=already_completed#payments`;
      return NextResponse.redirect(redirectUrl);
    }

    const result = await createCheckoutSession(payment);
    if (!result.ok) return result.response;

    return NextResponse.redirect(result.session.url!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[payments/checkout] GET error:", err);
    return NextResponse.json({ error: "Failed to start checkout" }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const payment = await loadPayment(id);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const auth = await authorizePaymentAccess(payment);
    if (!auth.ok) return auth.response;

    if (isPaymentComplete(payment.status)) {
      return NextResponse.json({ error: ALREADY_PAID_MESSAGE }, { status: 409 });
    }

    const result = await createCheckoutSession(payment);
    if (!result.ok) return result.response;

    return NextResponse.json({ url: result.session.url, sessionId: result.session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[payments/checkout] POST error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
