"use client";

import Link from "next/link";
import type { Payment, Project, ProjectQuote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getProjectActiveQuote, getQuotePriceDisplay } from "@/lib/quote-display";
import { CheckoutChoiceButtons, isOutstandingPayment } from "@/components/projects/payments-section";
import { clientPayChoice, paidCentsForQuote, quoteOutstandingBalanceCents } from "@/lib/payment-quote";
import { formatCurrency } from "@/lib/utils";
import type { PaymentAutomationSettings } from "@/lib/workflow-settings";
import { CheckCircle2, CreditCard, FileText } from "lucide-react";

interface ClientPricingCtaProps {
  project: Pick<Project, "project_name" | "property_address">;
  quotes: ProjectQuote[];
  payments: Payment[];
  depositMode?: PaymentAutomationSettings["depositMode"];
  depositPercent?: number;
  depositAmountCents?: number;
  allowClientPayInFull?: boolean;
}

export function ClientPricingCta({
  project,
  quotes,
  payments,
  depositMode = "none",
  depositPercent = 50,
  depositAmountCents = 0,
  allowClientPayInFull = false,
}: ClientPricingCtaProps) {
  const active = getProjectActiveQuote(quotes, "client");
  const activeQuote = active?.kind === "official" ? active.quote : null;
  const scoped = activeQuote ? payments.filter((p) => p.quote_id === activeQuote.id) : payments;
  const outstanding = scoped.filter((p) => isOutstandingPayment(p.status));
  const paidCents = activeQuote
    ? paidCentsForQuote(payments, activeQuote.id)
    : scoped.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amount, 0);
  const balance = activeQuote ? quoteOutstandingBalanceCents(activeQuote, payments) : null;
  const settled =
    balance != null ? balance === 0 && paidCents > 0 : scoped.length > 0 && scoped.every((p) => p.status === "paid" || p.status === "cancelled") && paidCents > 0;
  const hasPaid = paidCents > 0;
  const openPayment = outstanding[0];
  const payChoice =
    activeQuote && openPayment
      ? clientPayChoice({
          depositMode,
          depositPercent,
          depositAmountCents,
          allowClientPayInFull,
          payment: openPayment,
          quoteTotalCents: activeQuote.total_cents,
          paidCents,
        })
      : null;

  if (!active && outstanding.length === 0 && !hasPaid) {
    return (
      <section className="scroll-mt-24">
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-black/5">
          <div className="border-b border-border/60 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Your Project</p>
              <h2 className="mt-1 text-lg font-semibold text-primary break-words">{project.project_name}</h2>
              <p className="text-sm text-muted break-words">{project.property_address}</p>
            </div>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <p className="text-sm text-muted">
              Pricing will appear here when your studio shares an estimate.
            </p>
          </div>
        </div>
      </section>
    );
  }

  let ctaLabel = "View Estimate";
  let ctaHref = "#quote";
  let ctaVariant: "accent" | "outline" = "accent";
  let statusLabel = "Review your estimate";
  let statusVariant: "default" | "success" | "warning" = "default";

  if (active?.kind === "official" && active.quote.status === "sent") {
    ctaLabel = "Approve Estimate";
    ctaHref = "#quote";
    statusLabel = "Estimate pending your approval";
    statusVariant = "warning";
  } else if (active?.kind === "official" && active.quote.status === "approved" && outstanding.length > 0) {
    ctaLabel = "Pay Now";
    ctaHref = "#payments";
    statusLabel = `${formatCurrency(outstanding[0].amount)} due`;
    statusVariant = "warning";
  } else if (hasPaid && balance != null && balance > 0) {
    ctaLabel = "View balance";
    ctaHref = "#payments";
    ctaVariant = "outline";
    statusLabel = `${formatCurrency(balance)} still owed`;
    statusVariant = "warning";
  } else if (hasPaid && settled) {
    ctaLabel = "Payment Complete";
    ctaHref = "#payments";
    ctaVariant = "outline";
    statusLabel = "Paid";
    statusVariant = "success";
  } else if (active?.kind === "preliminary") {
    ctaLabel = "View Estimate";
    statusLabel = "Preliminary estimate";
  }

  const priceDisplay = active ? getQuotePriceDisplay(active.quote) : null;

  return (
    <section className="scroll-mt-24">
      <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-black/5">
        <div className="border-b border-border/60 bg-gradient-to-r from-slate-50 to-white px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Your Project</p>
              <h2 className="mt-1 text-lg font-semibold text-primary break-words">{project.project_name}</h2>
              <p className="text-sm text-muted break-words">{project.property_address}</p>
            </div>
            <Badge variant={statusVariant === "success" ? "success" : statusVariant === "warning" ? "warning" : "default"}>
              {statusLabel}
            </Badge>
          </div>
        </div>
        <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted">
              <FileText className="h-4 w-4 shrink-0" />
              <span>
                {active?.kind === "official" ? "Official Estimate" : active ? "Preliminary Estimate" : "Estimate"}
              </span>
            </div>
            {priceDisplay?.showPrice && (
              <p className="text-2xl font-bold tracking-tight text-primary">
                {formatCurrency(priceDisplay.priceCents)}
              </p>
            )}
            {outstanding.length > 0 && (
              <p className="flex items-center gap-2 text-sm text-muted">
                <CreditCard className="h-4 w-4" />
                {payChoice
                  ? `Deposit due now: ${formatCurrency(payChoice.rowIsFull ? payChoice.depositCents : outstanding[0].amount)}. Full project total ${formatCurrency(payChoice.totalCents)}.`
                  : `Total due: ${formatCurrency(outstanding.reduce((s, p) => s + p.amount, 0))}`}
              </p>
            )}
            {hasPaid && balance != null && balance > 0 && outstanding.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-amber-700">
                <CreditCard className="h-4 w-4" />
                {formatCurrency(balance)} still owed
              </p>
            )}
            {hasPaid && settled && outstanding.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Payment complete
              </p>
            )}
          </div>
          {payChoice && openPayment ? (
            <div className="shrink-0">
              <CheckoutChoiceButtons payment={openPayment} choice={payChoice} />
            </div>
          ) : (
          <Link href={ctaHref} className="shrink-0">
            <Button variant={ctaVariant} className="min-h-11 w-full sm:w-auto px-6">
              {ctaLabel}
            </Button>
          </Link>
          )}
        </div>
      </div>
    </section>
  );
}
