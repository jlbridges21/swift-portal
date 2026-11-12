"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Lock, Mail, Phone, Receipt, XCircle } from "lucide-react";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { Button } from "@/components/ui/button";
import { EmbeddedCheckoutModal, postStartCheckout, useCheckoutReturn } from "@/components/payments/embedded-checkout-modal";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PublicPayView } from "@/lib/public-pay";

/** Branded, login-free payment page for a signed pay link (/pay/{token}). */
export function PublicPayPage({ token, view }: { token: string; view: PublicPayView }) {
  const brand = usePortalBrand();
  const router = useRouter();
  const tokenPaymentId = token.split(".")[0]?.toLowerCase() ?? "";
  const returned = useCheckoutReturn((id) => id.toLowerCase() === tokenPaymentId && view.status !== "paid");
  const [open, setOpen] = useState(false);
  const [dismissedReturn, setDismissedReturn] = useState(false);
  const base = `/api/public/pay/${encodeURIComponent(token)}`;
  // ShootPortal receipt page for this pay link (Stripe-hosted receipt links expire).
  const receiptHref = `/pay/${encodeURIComponent(token)}/receipt`;

  const startCheckout = useCallback(({ method }: { method: "card" | "bank" }) => postStartCheckout(`${base}/session`, { method }), [base]);
  const statusUrl = useCallback(
    (sessionId: string | null) => `${base}/status${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`,
    [base]
  );
  const resume = returned && !dismissedReturn ? returned.sessionId : null;
  const showModal = open || Boolean(resume);

  return (
    <main className="min-h-dvh bg-[#F8FAFC] px-4 pb-12 pt-10 surface-dark:bg-background sm:pt-16" style={{ paddingTop: "max(2.5rem, env(safe-area-inset-top))" }}>
      <div className="mx-auto w-full max-w-[440px]">
        <div className="mb-6 flex flex-col items-center text-center">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.name} className="h-14 max-w-[220px] object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-xl font-semibold text-accent">
              {(brand.name.trim()[0] || "•").toUpperCase()}
            </div>
          )}
          <p className="mt-3 text-sm font-medium text-muted">{brand.name}</p>
        </div>

        <section className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)] surface-dark:bg-card">
          <div className="px-6 pb-6 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Payment request</p>
            <p className="mt-2 text-4xl font-semibold tabular-nums tracking-tight text-heading">{formatCurrency(view.amountCents)}</p>
            <p className="mt-2 text-[15px] leading-snug text-heading">{view.description}</p>
            {view.dueDate && view.status === "open" ? <p className="mt-1 text-sm text-muted">Due {formatDate(view.dueDate)}</p> : null}
          </div>

          <div className="border-t border-border bg-subtle/30 px-6 py-5">
            {view.status === "open" ? (
              <>
                <Button variant="accent" className="h-12 w-full rounded-xl text-[15px] font-semibold" onClick={() => setOpen(true)}>
                  <Lock className="h-4 w-4" aria-hidden /> Pay {formatCurrency(view.amountCents)}
                </Button>
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted">
                  <Lock className="h-3 w-3" aria-hidden /> Secure payment powered by Stripe
                </p>
              </>
            ) : view.status === "paid" ? (
              <StatusLine
                icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />}
                title="Paid — thank you!"
                detail={view.paidAt ? `Paid ${formatDate(view.paidAt)}` : "This payment is complete."}
                action={
                  <a href={receiptHref}>
                    <Button variant="outline" size="sm" className="min-h-10">
                      <Receipt className="h-4 w-4" aria-hidden /> View receipt
                    </Button>
                  </a>
                }
              />
            ) : view.status === "processing" ? (
              <StatusLine
                icon={<Clock className="h-5 w-5 text-sky-600" aria-hidden />}
                title="Bank payment processing"
                detail="Bank payments usually clear in a few business days. No further action is needed."
              />
            ) : (
              <StatusLine
                icon={<XCircle className="h-5 w-5 text-muted" aria-hidden />}
                title="This payment request is no longer active"
                detail={`Please contact ${brand.name} if you believe this is a mistake.`}
              />
            )}
          </div>
        </section>

        {brand.contactEmail || brand.phoneNumber ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
            <span>Questions?</span>
            {brand.contactEmail ? (
              <a href={`mailto:${brand.contactEmail}`} className="inline-flex items-center gap-1.5 hover:text-heading">
                <Mail className="h-3.5 w-3.5" aria-hidden /> {brand.contactEmail}
              </a>
            ) : null}
            {brand.phoneNumber ? (
              <a href={`tel:${brand.phoneNumber}`} className="inline-flex items-center gap-1.5 hover:text-heading">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {brand.phoneNumber}
              </a>
            ) : null}
          </div>
        ) : null}
      </div>

      <EmbeddedCheckoutModal
        open={showModal}
        onClose={() => {
          setOpen(false);
          setDismissedReturn(true);
          router.refresh();
        }}
        startCheckout={startCheckout}
        statusUrl={statusUrl}
        resumeSessionId={open ? null : resume}
        title="Payment request"
        onSettled={() => router.refresh()}
        fallbackReceiptHref={receiptHref}
        doneLabel="Done"
      />
    </main>
  );
}

function StatusLine({ icon, title, detail, action }: { icon: React.ReactNode; title: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-heading">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{detail}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
