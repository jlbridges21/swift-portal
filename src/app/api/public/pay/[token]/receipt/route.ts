import { NextResponse } from "next/server";
import { allowPublicLinkApi, recordPhotoShareMiss } from "@/lib/public-link-rate-limit";
import { requestIp } from "@/lib/public-pay";
import { authorizePayLinkReceipt, redactReceiptForPayLink } from "@/lib/receipt-access";
import { buildPaymentReceipt } from "@/lib/payment-receipt";
import { buildPaymentReceiptPdf, loadReceiptLogo, receiptPdfFilename } from "@/lib/payment-receipt-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };

/** Receipt PDF for a signed pay link. Same token rules as the pay page; client/project details removed. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = requestIp(request.headers);
  const rate = allowPublicLinkApi(ip, token);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { ...NO_STORE, "Retry-After": String(rate.retryAfterSec) } });
  }
  const resolved = await authorizePayLinkReceipt(token);
  if (!resolved) {
    recordPhotoShareMiss(ip);
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_STORE });
  }
  try {
    const result = await buildPaymentReceipt(resolved.payment, resolved.businessId);
    if (!result.ok) {
      return NextResponse.json({ error: result.unavailable.message }, { status: 409, headers: NO_STORE });
    }
    const receipt = redactReceiptForPayLink(result.receipt);
    const pdf = await buildPaymentReceiptPdf(receipt, await loadReceiptLogo(receipt.business.logoUrl));
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        ...NO_STORE,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${receiptPdfFilename(receipt)}"`,
      },
    });
  } catch (err) {
    console.error("[public/pay/receipt] failed", err instanceof Error ? err.message.slice(0, 200) : err);
    return NextResponse.json({ error: "The receipt PDF could not be generated. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
