"use client";

import Link from "next/link";
import type { Payment, Project, ProjectQuote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getClientActiveQuote, getQuotePriceDisplay } from "@/lib/quote-display";
import { isOutstandingPayment } from "@/components/projects/payments-section";
import { formatCurrency } from "@/lib/utils";
import { CheckCircle2, CreditCard, FileText } from "lucide-react";

interface ClientPricingCtaProps {
  project: Pick<Project, "project_name" | "property_address">;
  quotes: ProjectQuote[];
  payments: Payment[];
}

export function ClientPricingCta({ project, quotes, payments }: ClientPricingCtaProps) {
  const active = getClientActiveQuote(quotes);
  const outstanding = payments.filter((p) => isOutstandingPayment(p.status));
  const allPaid = payments.length > 0 && payments.every((p) => p.status === "paid" || p.status === "cancelled");
  const hasPaid = payments.some((p) => p.status === "paid");

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
  } else if (hasPaid && allPaid) {
    ctaLabel = "Payment Complete";
    ctaHref = "#payments";
    ctaVariant = "outline";
    statusLabel = "Paid in full";
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
                Total due: {formatCurrency(outstanding.reduce((s, p) => s + p.amount, 0))}
              </p>
            )}
            {hasPaid && !outstanding.length && (
              <p className="flex items-center gap-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Payment complete
              </p>
            )}
          </div>
          <Link href={ctaHref} className="shrink-0">
            <Button variant={ctaVariant} className="min-h-11 w-full sm:w-auto px-6">
              {ctaLabel}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
