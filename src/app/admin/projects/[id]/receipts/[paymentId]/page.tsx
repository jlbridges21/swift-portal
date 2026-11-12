import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-access";
import { authorizeReceiptViewer } from "@/lib/receipt-access";
import { buildPaymentReceipt } from "@/lib/payment-receipt";
import { PaymentReceiptView, ReceiptUnavailableView } from "@/components/payments/payment-receipt-view";

export const metadata: Metadata = { title: "Payment receipt", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string; paymentId: string }>;
}

/** Business-side receipt for one payment (owners, admins, staff with money.view). */
export default async function AdminPaymentReceiptPage({ params }: PageProps) {
  await requireAdminPage({ area: "projects" });
  const { id, paymentId } = await params;
  const auth = await authorizeReceiptViewer(paymentId, { projectId: id });
  if (!auth.ok || auth.value.audience !== "business") notFound();
  const backHref = `/admin/projects/${id}#payments`;
  const result = await buildPaymentReceipt(auth.value.payment, auth.value.businessId);
  if (!result.ok) return <ReceiptUnavailableView unavailable={result.unavailable} backHref={backHref} />;
  return (
    <PaymentReceiptView
      receipt={result.receipt}
      pdfHref={`/api/payments/${paymentId}/receipt/pdf`}
      backHref={backHref}
      backLabel="Back to project"
    />
  );
}
