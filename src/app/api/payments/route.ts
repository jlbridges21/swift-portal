import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { StripeConnectNotReadyError } from "@/lib/stripe-connect";
import { createPaymentLink, PaymentLinkError } from "@/lib/create-payment-link";

export async function POST(request: Request) {
  try {
    const profile = await requireAdmin({ permission: "money.send_payment_links" });
    const body = await request.json();

    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;

    // Scope before field validation — do not leak existence via 400 vs 404.
    if (typeof body.project_id === "string" && body.project_id) {
      const { canAccessProject } = await import("@/lib/project-access");
      if (!(await canAccessProject(profile, body.project_id))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    if (!body.project_id || !body.client_id || !body.amount || !body.description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const productDescription =
      typeof body.product_description === "string" && body.product_description.trim()
        ? body.product_description.trim().slice(0, 500)
        : undefined;

    const result = await createPaymentLink({
      businessId,
      projectId: body.project_id,
      clientId: body.client_id,
      quoteId: body.quote_id || null,
      amount: body.amount,
      description: body.description,
      productDescription,
      actorUserId: profile.id,
      origin: "manual",
    });

    return NextResponse.json(result.payment);
  } catch (err) {
    if (err instanceof StripeConnectNotReadyError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof PaymentLinkError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Payment creation error:", err);
    return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
  }
}
