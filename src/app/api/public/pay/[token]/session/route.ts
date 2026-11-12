import { NextResponse } from "next/server";
import { CheckoutStartError, createClientCheckoutSession, type CheckoutMethod } from "@/lib/client-checkout";
import { ensureCheckoutNotAlreadyPaid } from "@/lib/stripe-payment-reconcile";
import { allowPublicLinkApi, isPhotoShareLookupBlocked, recordPhotoShareMiss } from "@/lib/public-link-rate-limit";
import { payLinkPath } from "@/lib/pay-link";
import { requestIp, resolvePublicPayment } from "@/lib/public-pay";
import { StripeConnectNotReadyError } from "@/lib/stripe-connect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Start (or resume) embedded checkout from a signed pay link — no login. The amount is the
 * payment row's; the browser only picks card or bank. Pay-in-full/deposit switching stays in
 * the signed-in portal, where the client's quote is visible.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = requestIp(request.headers);
  const blocked = isPhotoShareLookupBlocked(ip);
  const rate = blocked.blocked ? { allowed: false, retryAfterSec: blocked.retryAfterSec } : allowPublicLinkApi(ip, token);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a moment and try again." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  try {
    const resolved = await resolvePublicPayment(token);
    if (!resolved) {
      recordPhotoShareMiss(ip);
      return NextResponse.json({ error: "This payment link is not valid." }, { status: 404, headers: NO_STORE });
    }
    const { payment, business, businessId } = resolved;

    if (payment.status === "paid") {
      return NextResponse.json({ error: "This payment has already been completed." }, { status: 409, headers: NO_STORE });
    }
    if (payment.status === "processing") {
      return NextResponse.json(
        { error: "This payment is already processing. Bank payments usually clear in a few business days." },
        { status: 409, headers: NO_STORE }
      );
    }
    if (payment.status !== "pending" && payment.status !== "sent") {
      return NextResponse.json({ error: "This payment request is no longer active." }, { status: 410, headers: NO_STORE });
    }

    let methodRaw: unknown;
    try {
      methodRaw = ((await request.json()) as { method?: unknown } | null)?.method;
    } catch {
      methodRaw = undefined;
    }
    if (methodRaw !== undefined && methodRaw !== "card" && methodRaw !== "bank") {
      return NextResponse.json({ error: "Unknown payment method." }, { status: 400, headers: NO_STORE });
    }
    const method: CheckoutMethod = methodRaw === "bank" ? "bank" : "card";

    const block = await ensureCheckoutNotAlreadyPaid(payment, "public_pay_link");
    if (block.blocked) {
      return NextResponse.json({ error: block.message ?? "This payment has already been completed." }, { status: 409, headers: NO_STORE });
    }

    const { embedded } = await createClientCheckoutSession({
      payment,
      businessId,
      business,
      method,
      returnTo: { path: payLinkPath(token) },
      uiMode: "elements",
      requestHost: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
    });
    if (!embedded) throw new CheckoutStartError("Failed to start checkout", 500);
    return NextResponse.json(embedded, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof CheckoutStartError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    if (err instanceof StripeConnectNotReadyError) {
      return NextResponse.json({ error: "Online payments aren't available right now. Please contact the business." }, { status: 400, headers: NO_STORE });
    }
    console.error("[public/pay/session] POST error:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
