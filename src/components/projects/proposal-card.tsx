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
        "rounded-2xl bg-gradient-to-b from-white via-white to-slate-50/60 p-5 sm:p-6",
        "shadow-[0_2px_24px_-10px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04]",
        className
      )}
    >
      {isPreliminary && !isAdmin && (
        <div className="mb-5 space-y-2 rounded-xl bg-sky-50/70 px-4 py-3">
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
        <p className="mb-4 text-sm font-medium text-accent">
          Please review and approve this proposal to continue.
        </p>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          {showPrice && priceLabel.toLowerCase().includes("starting") && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
              {priceLabel}
            </p>
          )}
          <h3 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {packageName}
          </h3>
          {showPrice && (
            <p className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              {priceLabel.toLowerCase().includes("starting") ? formatCurrency(priceCents) : priceLabel}
            </p>
          )}
          {!showPrice && (
            <p className="text-lg font-semibold tracking-tight text-slate-700">{priceLabel}</p>
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
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{intro}</p>
      )}

      {includes.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Includes</p>
          <ul className="mt-3 space-y-2">
            {includes.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
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
          <div className="mt-5 space-y-2 rounded-xl bg-slate-50/80 px-4 py-3">
            {filteredNotes.map((note) => (
              <p key={note.slice(0, 40)} className="text-sm leading-relaxed text-slate-600">
                {note}
              </p>
            ))}
          </div>
        );
      })()}

      {quote.expires_at && (
        <p className="mt-4 text-xs text-slate-500">
          Valid until {new Date(quote.expires_at).toLocaleDateString()}
        </p>
      )}

      {isApproved && !isAdmin && (
        <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-emerald-50/80 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Proposal approved
            {quote.approved_at ? ` on ${new Date(quote.approved_at).toLocaleDateString()}` : ""}
          </span>
        </div>
      )}

      {actions && <div className="mt-5 flex flex-wrap gap-2.5 border-t border-slate-100 pt-5">{actions}</div>}
    </div>
  );
}
