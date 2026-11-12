import { NextResponse } from "next/server";
import { authorizeReceiptViewer, receiptPagePath } from "@/lib/receipt-access";

export const dynamic = "force-dynamic";

/**
 * Stable receipt link for one payment. Sends the viewer to the ShootPortal receipt page for
 * their portal (business or client). Never redirects to a Stripe-hosted receipt_url — those
 * expire. The PDF lives at ./pdf.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeReceiptViewer(id);
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  }
  const { payment, audience } = auth.value;
  const target = new URL(receiptPagePath(audience, payment.project_id, payment.id), request.url);
  return NextResponse.redirect(target, { headers: { "Cache-Control": "private, no-store" } });
}
