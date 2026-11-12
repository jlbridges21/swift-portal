import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PhotoShareBrand } from "@/app/photo/[token]/brand";
import { allowPublicLinkPageView, isPhotoShareLookupBlocked, recordPhotoShareMiss } from "@/lib/public-link-rate-limit";
import { requestIp } from "@/lib/public-pay";
import { authorizePayLinkReceipt, redactReceiptForPayLink } from "@/lib/receipt-access";
import { buildPaymentReceipt } from "@/lib/payment-receipt";
import { PaymentReceiptView, ReceiptUnavailableView } from "@/components/payments/payment-receipt-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment receipt",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#F8FAFC", colorScheme: "light", viewportFit: "cover" };

/** Receipt for a signed pay link. Same token rules as /pay/{token}; who paid and the property are left out. */
export default async function PayLinkReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = requestIp(await headers());
  const blocked = isPhotoShareLookupBlocked(ip);
  const rate = blocked.blocked ? { allowed: false } : allowPublicLinkPageView(ip, token);
  if (!rate.allowed) notFound();
  const resolved = await authorizePayLinkReceipt(token);
  if (!resolved) {
    recordPhotoShareMiss(ip);
    notFound();
  }
  const result = await buildPaymentReceipt(resolved.payment, resolved.businessId);
  const backHref = `/pay/${token}`;
  return (
    <PhotoShareBrand businessId={resolved.businessId}>
      <div className="min-h-dvh bg-slate-50">
        {result.ok ? (
          <PaymentReceiptView
            receipt={redactReceiptForPayLink(result.receipt)}
            pdfHref={`/api/public/pay/${token}/receipt`}
            backHref={backHref}
            backLabel="Back"
          />
        ) : (
          <ReceiptUnavailableView unavailable={result.unavailable} backHref={backHref} backLabel="Back" />
        )}
      </div>
    </PhotoShareBrand>
  );
}
