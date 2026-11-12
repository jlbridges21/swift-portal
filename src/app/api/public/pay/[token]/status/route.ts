import { NextResponse } from "next/server";
import { CheckoutStartError, verifyCheckoutOutcome } from "@/lib/client-checkout";
import { allowPublicLinkApi, recordPhotoShareMiss } from "@/lib/public-link-rate-limit";
import { requestIp, resolvePublicPayment } from "@/lib/public-pay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Server-verified checkout result for a signed pay link (see /api/payments/{id}/checkout/status). */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = requestIp(request.headers);
  const rate = allowPublicLinkApi(ip, token);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } });
  }
  try {
    const resolved = await resolvePublicPayment(token);
    if (!resolved) {
      recordPhotoShareMiss(ip);
      return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
    }
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");
    const thorough = url.searchParams.get("thorough") === "1";
    const outcome = await verifyCheckoutOutcome({ payment: resolved.payment, businessId: resolved.businessId, sessionId, thorough });
    return NextResponse.json(outcome, { headers: NO_STORE });
  } catch (err) {
    if (err instanceof CheckoutStartError) {
      return NextResponse.json({ error: err.message }, { status: err.status, headers: NO_STORE });
    }
    console.error("[public/pay/status] GET error:", err);
    return NextResponse.json({ error: "Could not check payment status" }, { status: 500, headers: NO_STORE });
  }
}
