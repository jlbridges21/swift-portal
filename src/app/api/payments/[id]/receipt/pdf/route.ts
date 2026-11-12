import { NextResponse } from "next/server";
import { authorizeReceiptViewer } from "@/lib/receipt-access";
import { buildPaymentReceipt } from "@/lib/payment-receipt";
import { buildPaymentReceiptPdf, loadReceiptLogo, receiptPdfFilename } from "@/lib/payment-receipt-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

/** PDF copy of a ShootPortal receipt. Read-only: never changes the payment. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorizeReceiptViewer(id);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.reason === "unauthenticated" ? "Unauthorized" : "Receipt not found" },
      { status: auth.reason === "unauthenticated" ? 401 : 404, headers: NO_STORE }
    );
  }
  try {
    const result = await buildPaymentReceipt(auth.value.payment, auth.value.businessId);
    if (!result.ok) {
      return NextResponse.json({ error: result.unavailable.message }, { status: 409, headers: NO_STORE });
    }
    const logo = await loadReceiptLogo(result.receipt.business.logoUrl);
    const pdf = await buildPaymentReceiptPdf(result.receipt, logo);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receiptPdfFilename(result.receipt)}"`,
      },
    });
  } catch (err) {
    console.error("[receipt/pdf] failed", err instanceof Error ? err.message.slice(0, 200) : err);
    return NextResponse.json({ error: "The receipt PDF could not be generated. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
