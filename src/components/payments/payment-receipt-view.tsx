"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Download, FileWarning, Loader2, Printer, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatReceiptMoney, receiptDateLabel, receiptStatusLabel } from "@/lib/payment-receipt-format";
import type { PaymentReceipt, ReceiptUnavailable } from "@/lib/payment-receipt";

type Props = {
  receipt: PaymentReceipt;
  pdfHref: string;
  backHref?: string | null;
  backLabel?: string;
};

/** Print only the receipt paper, not the portal around it. */
const PRINT_CSS = `
@media print {
  @page { margin: 14mm; }
  body * { visibility: hidden !important; }
  .sp-receipt-paper, .sp-receipt-paper * { visibility: visible !important; }
  .sp-receipt-paper { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; box-shadow: none !important; border: 0 !important; }
  .sp-receipt-noprint { display: none !important; }
}`;

export function PaymentReceiptView({ receipt, pdfHref, backHref, backLabel = "Back to payments" }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const money = (cents: number) => formatReceiptMoney(cents, receipt.currency);
  const statusLabel = receiptStatusLabel(receipt);
  const netCents = receipt.totalCents - receipt.refundedCents;
  const showLogo = Boolean(receipt.business.logoUrl) && !logoFailed;

  async function downloadPdf() {
    setDownloading(true);
    setPdfError(null);
    try {
      const res = await fetch(pdfHref, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok || !(res.headers.get("content-type") || "").includes("pdf")) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "The receipt PDF could not be generated.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipt-${receipt.receiptNumber.toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : "The receipt PDF could not be generated.");
    } finally {
      setDownloading(false);
    }
  }

  const details: { label: string; value: string; mono?: boolean }[] = [
    { label: "Receipt number", value: receipt.receiptNumber, mono: true },
    { label: "Date paid", value: receiptDateLabel(receipt.paidAt) },
    { label: "Payment method", value: receipt.methodLabel || "Not available" },
    { label: "Status", value: statusLabel },
    ...(receipt.clientName ? [{ label: "Billed to", value: receipt.clientName }] : []),
    ...(receipt.projectName ? [{ label: "Project", value: receipt.projectName }] : []),
    ...(receipt.propertyAddress ? [{ label: "Property", value: receipt.propertyAddress }] : []),
    { label: "Payment reference", value: receipt.paymentId, mono: true },
    ...(receipt.kind === "stripe" && receipt.verification.paymentIntentId
      ? [{ label: "Stripe reference", value: receipt.verification.paymentIntentId, mono: true }]
      : []),
  ];

  const pill =
    receipt.status !== "paid"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : receipt.kind === "manual"
        ? "bg-slate-100 text-slate-700 ring-slate-200"
        : "bg-emerald-50 text-emerald-700 ring-emerald-200";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-10">
      <style>{PRINT_CSS}</style>
      <div className="sp-receipt-noprint mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {backHref ? (
          <Link href={backHref} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted hover:text-heading">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
          </Link>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11 flex-1 sm:flex-none" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden /> Print
          </Button>
          <Button variant="accent" className="min-h-11 flex-1 sm:flex-none" onClick={downloadPdf} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
            {downloading ? "Preparing PDF…" : "Download PDF"}
          </Button>
        </div>
      </div>

      {pdfError ? (
        <div role="alert" className="sp-receipt-noprint mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{pdfError}</p>
            <p className="text-red-700/80">Your payment is not affected.</p>
          </div>
          <button type="button" onClick={downloadPdf} className="inline-flex shrink-0 items-center gap-1 font-semibold underline-offset-2 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry
          </button>
        </div>
      ) : null}

      <article
        className="sp-receipt-paper overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]"
        aria-label={`${receipt.title} ${receipt.receiptNumber}`}
      >
        <header className="flex flex-col gap-5 border-b border-slate-200 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <div className="min-w-0">
            {showLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receipt.business.logoUrl}
                alt={receipt.business.name || "Business logo"}
                className="mb-3 h-12 w-auto max-w-[180px] object-contain object-left"
                onError={() => setLogoFailed(true)}
              />
            ) : null}
            {receipt.business.name ? <p className="font-semibold text-slate-900">{receipt.business.name}</p> : null}
            <div className="mt-1 space-y-0.5 text-sm text-slate-500">
              {receipt.business.addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {receipt.business.email ? <p>{receipt.business.email}</p> : null}
              {receipt.business.phone ? <p>{receipt.business.phone}</p> : null}
            </div>
          </div>
          <div className="sm:text-right">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{receipt.title}</h1>
            <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset", pill)}>
              {receipt.status === "paid" ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> : null}
              {statusLabel}
            </span>
            <p className="mt-2 font-mono text-xs text-slate-500">{receipt.receiptNumber}</p>
          </div>
        </header>

        <section className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {receipt.kind === "manual" ? "Amount recorded" : "Amount paid"}
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-4xl">{money(receipt.totalCents)}</p>
            <p className="text-sm font-semibold text-slate-400">{receipt.currency.toUpperCase()}</p>
          </div>
          {receipt.paidAt ? <p className="mt-1 text-sm text-slate-500">Paid {receiptDateLabel(receipt.paidAt)}</p> : null}
        </section>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-4 border-b border-slate-200 px-6 py-5 sm:grid-cols-2 sm:px-8">
          {details.map((d) => (
            <div key={d.label} className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{d.label}</dt>
              <dd className={cn("mt-0.5 break-words text-sm text-slate-900", d.mono && "font-mono text-[13px]")}>{d.value}</dd>
            </div>
          ))}
        </dl>

        <section className="px-6 py-5 sm:px-8">
          <div className="flex justify-between border-b border-slate-200 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Description</span>
            <span>Amount</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {receipt.lineItems.map((line, i) => (
              <li key={`${line.label}-${i}`} className={cn("flex items-start justify-between gap-4 py-3 text-sm", line.muted ? "text-slate-500" : "text-slate-900")}>
                <span className="min-w-0 break-words">{line.label}</span>
                <span className="shrink-0 tabular-nums">{money(line.amountCents)}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
            <div className="flex justify-between font-semibold text-slate-900">
              <span>{receipt.kind === "manual" ? "Total recorded" : "Total paid"}</span>
              <span className="tabular-nums">{money(receipt.totalCents)}</span>
            </div>
            {receipt.refundedCents > 0 ? (
              <>
                <div className="flex justify-between text-amber-800">
                  <span>Refunded{receipt.lastRefundAt ? ` on ${receiptDateLabel(receipt.lastRefundAt)}` : ""}</span>
                  <span className="tabular-nums">−{money(receipt.refundedCents)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Net paid</span>
                  <span className="tabular-nums">{money(netCents)}</span>
                </div>
              </>
            ) : null}
          </div>
          {receipt.appliedToward ? <p className="mt-4 text-sm text-slate-500">{receipt.appliedToward}</p> : null}
        </section>

        {receipt.notes.length ? (
          <section className="space-y-2 px-6 pb-6 sm:px-8">
            {receipt.notes.map((note) => (
              <p key={note} className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
                {note}
              </p>
            ))}
          </section>
        ) : null}

        <footer className="border-t border-slate-200 bg-slate-50/60 px-6 py-3 text-center text-xs text-slate-500 sm:px-8">
          {receipt.kind === "stripe" && receipt.verification.source !== "record_only"
            ? "Payment processed securely by Stripe. Keep this receipt for your records."
            : "Keep this receipt for your records."}
        </footer>
      </article>
    </div>
  );
}

export function ReceiptUnavailableView({
  unavailable,
  backHref,
  backLabel = "Back to payments",
}: {
  unavailable: ReceiptUnavailable;
  backHref?: string | null;
  backLabel?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <FileWarning className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-heading">{unavailable.title}</h1>
      <p className="mt-2 text-sm text-muted">{unavailable.message}</p>
      {backHref ? (
        <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }), "mt-6 min-h-11")}>
          <ArrowLeft className="h-4 w-4" aria-hidden /> {backLabel}
        </Link>
      ) : null}
    </div>
  );
}
