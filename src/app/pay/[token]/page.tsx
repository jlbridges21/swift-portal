import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { PhotoShareBrand } from "@/app/photo/[token]/brand";
import { PublicPayPage } from "@/components/payments/public-pay-page";
import { allowPublicLinkPageView, isPhotoShareLookupBlocked, recordPhotoShareMiss } from "@/lib/public-link-rate-limit";
import { publicPayView, requestIp, resolvePublicPayment } from "@/lib/public-pay";
import { reconcilePaymentFromStripe } from "@/lib/stripe-payment-reconcile";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Payment request",
  robots: { index: false, follow: false },
  // The token is the credential — never send it to third parties in a Referer header.
  referrer: "no-referrer",
};

export const viewport: Viewport = { themeColor: "#F8FAFC", colorScheme: "light", viewportFit: "cover" };

/**
 * Login-free pay page for links emailed to clients. The signed token identifies one payment
 * on this business's domain; the page shows only the business, the charge and its status.
 */
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = requestIp(await headers());
  const blocked = isPhotoShareLookupBlocked(ip);
  const rate = blocked.blocked ? { allowed: false } : allowPublicLinkPageView(ip, token);
  if (!rate.allowed) {
    const host = await getPublicHostContext();
    if (!isActivePublicTenant(host)) notFound();
    return (
      <PhotoShareBrand businessId={host.businessId}>
        <div className="flex min-h-dvh items-center justify-center p-6 text-center text-muted">Too many requests. Please wait a minute and try again.</div>
      </PhotoShareBrand>
    );
  }

  let resolved = await resolvePublicPayment(token);
  if (!resolved) {
    recordPhotoShareMiss(ip);
    notFound();
  }

  // Catch up on a missed webhook before showing "unpaid" (same idempotent reconcile as the portal).
  if (resolved.payment.status === "pending" || resolved.payment.status === "sent" || resolved.payment.status === "processing") {
    try {
      const result = await reconcilePaymentFromStripe(resolved.payment, "public_pay_page");
      if (result.repaired) resolved = (await resolvePublicPayment(token)) ?? resolved;
    } catch (err) {
      console.warn("[pay-page] reconcile skipped", err instanceof Error ? err.message : err);
    }
  }

  return (
    <PhotoShareBrand businessId={resolved.businessId}>
      <PublicPayPage token={token} view={publicPayView(resolved.payment)} />
    </PhotoShareBrand>
  );
}
