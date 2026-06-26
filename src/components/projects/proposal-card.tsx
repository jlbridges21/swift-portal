"use client";

import type { ReactNode } from "react";
import type { ProjectQuote } from "@/lib/types";
import { PRELIMINARY_ESTIMATE_DISCLAIMER } from "@/lib/service-templates";
import {
  getQuoteIntroText,
  getQuotePackageName,
  getQuotePriceDisplay,
  parseQuoteIncludes,
} from "@/lib/quote-display";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProposalCardProps {
  quote: ProjectQuote;
  kind: "preliminary" | "official";
  isAdmin?: boolean;
  actions?: ReactNode;
  className?: string;
}

export function ProposalCard({ quote, kind, isAdmin, actions, className }: ProposalCardProps) {
  const packageName = getQuotePackageName(quote);
  const { showPrice, priceLabel, priceCents } = getQuotePriceDisplay(quote);
  const includes = parseQuoteIncludes(quote.description);
  const intro = getQuoteIntroText(quote.description);
  const isApproved = quote.status === "approved";
  const isPreliminary = kind === "preliminary";
  const needsReview = !isAdmin && kind === "official" && quote.status === "sent";

  return (
    <div
      className={cn(
        "rounded-3xl bg-gradient-to-b from-white via-white to-slate-50/60 p-8 sm:p-10",
        "shadow-[0_2px_40px_-12px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04]",
        className
      )}
    >
      {isPreliminary && !isAdmin && (
        <div className="mb-8 space-y-3 rounded-2xl bg-sky-50/70 px-5 py-4">
          <p className="text-sm font-semibold tracking-tight text-slate-900">
            About this Preliminary Estimate
          </p>
          <p className="text-sm leading-relaxed text-slate-600">{PRELIMINARY_ESTIMATE_DISCLAIMER}</p>
          <p className="text-xs leading-relaxed text-slate-500">
            This is not the final proposal. Final pricing will be confirmed after Swift Aerial Media
            reviews the property, schedules the shoot, and confirms the project scope.
          </p>
        </div>
      )}

      {needsReview && (
        <p className="mb-6 text-sm font-medium text-accent">
          Please review and approve this proposal to continue.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-4">
          {showPrice && priceLabel.toLowerCase().includes("starting") && (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              {priceLabel}
            </p>
          )}
          <h3 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {packageName}
          </h3>
          {showPrice && (
            <p className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {priceLabel.toLowerCase().includes("starting") ? formatCurrency(priceCents) : priceLabel}
            </p>
          )}
          {!showPrice && (
            <p className="text-xl font-semibold tracking-tight text-slate-700">{priceLabel}</p>
          )}
        </div>
        {isAdmin && (
          <Badge
            variant={
              isApproved ? "success" : quote.status === "changes_requested" ? "warning" : "default"
            }
          >
            {isPreliminary ? "Preliminary" : isApproved ? "Approved" : quote.status.replace("_", " ")}
          </Badge>
        )}
      </div>

      {intro && (
        <p className="mt-6 text-base leading-relaxed text-slate-600">{intro}</p>
      )}

      {includes.length > 0 && (
        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500">Includes</p>
          <ul className="mt-4 space-y-3">
            {includes.map((item) => (
              <li key={item} className="flex gap-3 text-base leading-relaxed text-slate-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {quote.notes && (() => {
        const filteredNotes = quote.notes
          .split("\n\n")
          .filter(
            (note) =>
              !/^starting at/i.test(note.trim()) &&
              note.trim() !== "Custom Proposal Required" &&
              note.trim() !== "Custom Quote"
          );
        if (!filteredNotes.length) return null;
        return (
          <div className="mt-8 space-y-2 rounded-2xl bg-slate-50/80 px-5 py-4">
            {filteredNotes.map((note) => (
              <p key={note.slice(0, 40)} className="text-sm leading-relaxed text-slate-600">
                {note}
              </p>
            ))}
          </div>
        );
      })()}

      {quote.expires_at && (
        <p className="mt-6 text-xs text-slate-500">
          Valid until {new Date(quote.expires_at).toLocaleDateString()}
        </p>
      )}

      {isApproved && !isAdmin && (
        <div className="mt-8 flex items-center gap-3 rounded-2xl bg-emerald-50/80 px-5 py-4 text-sm text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>
            Proposal approved
            {quote.approved_at ? ` on ${new Date(quote.approved_at).toLocaleDateString()}` : ""}
          </span>
        </div>
      )}

      {actions && <div className="mt-8 flex flex-wrap gap-3 border-t border-slate-100 pt-8">{actions}</div>}
    </div>
  );
}
