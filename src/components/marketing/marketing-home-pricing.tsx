"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlanRow } from "@/lib/plan-catalog";
import {
  formatAnnualSavingsLabel,
  formatPlanPrice,
} from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BillingInterval = "monthly" | "annual";

const STUDIO_DESCRIPTION =
  "Everything you need to run your media business from request to delivery.";

export function MarketingHomePricing({
  plan,
  trialDays,
}: {
  plan: PlanRow | null;
  trialDays: number;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const monthlyCents = plan?.price_monthly_cents;
  const annualMonthlyCents = plan?.price_annual_cents;
  const hasAnnual = annualMonthlyCents != null;
  const monthlyLabel = formatPlanPrice(monthlyCents);
  const annualMonthlyLabel = formatPlanPrice(annualMonthlyCents);
  const savingsLabel = formatAnnualSavingsLabel(monthlyCents, annualMonthlyCents);
  const planName = plan?.name ?? "Studio";
  const description = plan?.description?.trim() || STUDIO_DESCRIPTION;

  return (
    <div className="mx-auto max-w-lg">
      {hasAnnual ? (
        <div className="mb-6 flex justify-center">
          <div
            className="inline-flex rounded-lg border border-[#E2E8F0] bg-white p-1 shadow-sm"
            role="group"
            aria-label="Billing interval"
          >
            <button
              type="button"
              className={cn(
                "rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2",
                interval === "monthly"
                  ? "bg-[#4F46E5] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              )}
              aria-pressed={interval === "monthly"}
              onClick={() => setInterval("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2",
                interval === "annual"
                  ? "bg-[#4F46E5] text-white shadow-sm"
                  : "text-[#475569] hover:text-[#0F172A]"
              )}
              aria-pressed={interval === "annual"}
              onClick={() => setInterval("annual")}
            >
              Annual
              {savingsLabel ? (
                <span
                  className={cn(
                    "ml-1.5 text-xs font-medium",
                    interval === "annual" ? "text-indigo-100" : "text-[#4F46E5]"
                  )}
                >
                  ({savingsLabel})
                </span>
              ) : null}
            </button>
          </div>
        </div>
      ) : null}

      <article className="rounded-2xl border border-[#4F46E5] bg-white p-8 shadow-sm ring-2 ring-[#4F46E5]/10">
        <h3 className="text-lg font-semibold text-[#0F172A]">{planName}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">{description}</p>

        <div className="mt-6 space-y-1">
          {monthlyCents != null ? (
            <p
              className={cn(
                interval === "monthly"
                  ? "text-4xl font-bold tracking-tight text-[#0F172A]"
                  : "text-sm text-[#64748B]"
              )}
            >
              {monthlyLabel}/month
            </p>
          ) : (
            <p className="text-sm text-[#475569]">Pricing loads from the live catalog.</p>
          )}
          {hasAnnual ? (
            <p
              className={cn(
                interval === "annual"
                  ? "text-4xl font-bold tracking-tight text-[#0F172A]"
                  : "text-sm text-[#64748B]"
              )}
            >
              or {annualMonthlyLabel}/month billed annually
            </p>
          ) : null}
          {interval === "annual" && savingsLabel ? (
            <p className="text-sm font-semibold text-[#4F46E5]">{savingsLabel}</p>
          ) : null}
        </div>

        {trialDays > 0 ? (
          <p className="mt-4 text-sm font-medium text-[#0F172A]">
            {trialDays} days free. No credit card required.
          </p>
        ) : null}

        <p className="mt-2 text-sm text-[#475569]">Cancel anytime.</p>

        <Link href="/signup" className="mt-6 block">
          <Button className="min-h-12 w-full bg-[#4F46E5] text-base font-semibold text-white hover:bg-[#4338CA]">
            Start your free trial
          </Button>
        </Link>
      </article>

      <p className="mt-6 text-center text-sm text-[#475569]">
        No tiers. No feature hunting. Just the tools you need to run your media business.
      </p>
    </div>
  );
}
