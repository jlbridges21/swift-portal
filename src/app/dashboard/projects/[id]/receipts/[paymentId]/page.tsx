import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { authorizeReceiptViewer } from "@/lib/receipt-access";
import { buildPaymentReceipt } from "@/lib/payment-receipt";
import { PaymentReceiptView, ReceiptUnavailableView } from "@/components/payments/payment-receipt-view";

export const metadata: Metadata = { title: "Payment receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; paymentId: string }>;
}

/** Client-side receipt for one payment on a project the client is assigned to. */
export default async function ClientPaymentReceiptPage({ params }: PageProps) {
  const { id, paymentId } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "admin" || profile.role === "staff" || profile.role === "super_admin") {
    redirect(`/admin/projects/${id}/receipts/${paymentId}`);
  }
  const auth = await authorizeReceiptViewer(paymentId, { projectId: id });
  if (!auth.ok || auth.value.audience !== "client") notFound();
  const backHref = `/dashboard/projects/${id}`;
  const result = await buildPaymentReceipt(auth.value.payment, auth.value.businessId);
  if (!result.ok) return <ReceiptUnavailableView unavailable={result.unavailable} backHref={backHref} backLabel="Back to project" />;
  return (
    <PaymentReceiptView
      receipt={result.receipt}
      pdfHref={`/api/payments/${paymentId}/receipt/pdf`}
      backHref={backHref}
      backLabel="Back to project"
    />
  );
}
