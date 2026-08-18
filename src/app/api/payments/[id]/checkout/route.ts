import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAuth } from "@/lib/auth";
import { canAccessProject } from "@/lib/project-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getStripeForBusiness, isPlatformStripeBusiness, portalCheckoutBaseUrl, StripeConnectNotReadyError } from "@/lib/stripe-connect";
import { buildStripePaymentMetadata } from "@/lib/stripe-metadata";
import { isPaymentComplete } from "@/lib/payment-status";
import type { Payment } from "@/lib/types";

const ALREADY_PAID_MESSAGE = "This payment has already been completed.";

async function loadPayment(id: string, businessId?: string) {
  const supabase = await createClient();
  let query = supabase.from("payments").select("*").eq("id", id);
  if (businessId) {
    query = query.eq("business_id", businessId);
  }
  const { data, error } = await query.maybeSingle();
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

async function createCheckoutSession(payment: Payment, businessId: string, customDomain?: string | null) {
  const appUrl = isPlatformStripeBusiness(businessId)
    ? process.env.NEXT_PUBLIC_APP_URL
    : portalCheckoutBaseUrl({ custom_domain: customDomain ?? null });
  if (!appUrl) {
    return { ok: false as const, response: NextResponse.json({ error: "App URL not configured" }, { status: 500 }) };
  }

  const metadata = buildStripePaymentMetadata({
    paymentId: payment.id,
    businessId: payment.business_id || businessId,
    projectId: payment.project_id,
    clientId: payment.client_id,
  });

  let stripeContext;
  try {
    stripeContext = await getStripeForBusiness(businessId);
  } catch (err) {
    if (err instanceof StripeConnectNotReadyError) {
      return { ok: false as const, response: NextResponse.json({ error: err.message }, { status: 400 }) };
    }
    throw err;
  }

  const { stripe, requestOptions, stripeAccountId } = stripeContext;

  const sessionParams = {
    mode: "payment" as const,
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
  };

  const session = requestOptions
    ? await stripe.checkout.sessions.create(sessionParams, requestOptions)
    : await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 }),
    };
  }

  const db = await createTenantServiceClient(businessId);
  await db
    .from("payments")
    .update({
      stripe_checkout_session_id: session.id,
      ...(payment.stripe_account_id ? {} : { stripe_account_id: stripeAccountId }),
    })
    .eq("id", payment.id);

  return { ok: true as const, session };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await getTenantContext();
    const payment = await loadPayment(id, tenant?.businessId);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const auth = await authorizePaymentAccess(payment);
    if (!auth.ok) return auth.response;
    if (!tenant) return missingTenantResponse(auth.profile.role);

    if (isPaymentComplete(payment.status)) {
      const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${payment.project_id}?payment=already_completed#payments`;
      return NextResponse.redirect(redirectUrl);
    }

    const result = await createCheckoutSession(payment, tenant.businessId, tenant.business.custom_domain);
    if (!result.ok) return result.response;

    return NextResponse.redirect(result.session.url!);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof StripeConnectNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
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
    const tenant = await getTenantContext();
    const payment = await loadPayment(id, tenant?.businessId);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const auth = await authorizePaymentAccess(payment);
    if (!auth.ok) return auth.response;
    if (!tenant) return missingTenantResponse(auth.profile.role);

    if (isPaymentComplete(payment.status)) {
      return NextResponse.json({ error: ALREADY_PAID_MESSAGE }, { status: 409 });
    }

    const result = await createCheckoutSession(payment, tenant.businessId, tenant.business.custom_domain);
    if (!result.ok) return result.response;

    return NextResponse.json({ url: result.session.url, sessionId: result.session.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof StripeConnectNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[payments/checkout] POST error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
