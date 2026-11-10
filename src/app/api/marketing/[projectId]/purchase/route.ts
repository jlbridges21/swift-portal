import { NextResponse } from "next/server";
import { marketingErrorResponse, requireMarketingRoute } from "@/lib/marketing/route-auth";
import { createAddonPayment } from "@/lib/marketing/purchases";
import { MarketingError } from "@/lib/marketing/server";

export const dynamic = "force-dynamic";

/**
 * Client purchase of Marketing Kit add-ons. Creates (or reuses) a normal project payment for
 * the server-computed price. The browser then starts the existing Stripe checkout for that
 * payment (POST /api/payments/{id}/checkout) — or leaves it on the project invoice to pay later.
 * Nothing is unlocked here; access is granted only when the payment is paid.
 */
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const auth = await requireMarketingRoute(projectId);
  if (!auth.ok) return auth.response;
  const { ctx, actor } = auth;
  let body: { products?: unknown; method?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    if (actor.kind !== "client") throw new MarketingError("Use “Add to client's invoice” on the project page.", 403);
    const result = await createAddonPayment(ctx, actor, body.products, body.method);
    return NextResponse.json(result);
  } catch (e) {
    return marketingErrorResponse(e);
  }
}
