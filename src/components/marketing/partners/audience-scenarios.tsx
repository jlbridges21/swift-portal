"use client";

import { useRef } from "react";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Reveal, useInView, usePrefersReducedMotion } from "./motion";

type Scenario = {
  label: string;
  audience: string;
  customers: number;
  customersLabel: string;
};

const SCENARIOS: Scenario[] = [
  {
    label: "Audience",
    audience: "1,000 relevant followers",
    customers: 5,
    customersLabel: "5 referred customers",
  },
  {
    label: "Course community",
    audience: "50 active members",
    customers: 10,
    customersLabel: "10 referred customers",
  },
];

export function AudienceScenarios({
  commissionRatePct,
  perReferralMonthlyCents,
  planPriceLabel,
}: {
  commissionRatePct: number;
  perReferralMonthlyCents: number;
  planPriceLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, 0.2);

  return (
    <div ref={ref} className="space-y-5">
      {SCENARIOS.map((scenario, si) => {
        const monthly = scenario.customers * perReferralMonthlyCents;
        return (
          <Reveal key={scenario.label} delayMs={si * 100}>
            <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
                Example {si + 1}
              </p>
              <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2">
                <div
                  className={`flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 transition-all duration-700 ${
                    inView || reduced ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                >
                  <p className="text-xs font-medium text-[#64748B]">{scenario.label}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A]">{scenario.audience}</p>
                </div>
                <ArrowRight className="mx-auto hidden h-4 w-4 shrink-0 text-[#94A3B8] sm:block" />
                <div
                  className={`flex-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 transition-all duration-700 ${
                    inView || reduced ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                  style={{ transitionDelay: reduced ? "0ms" : "150ms" }}
                >
                  <p className="text-xs font-medium text-[#64748B]">Paying referrals</p>
                  <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                    {scenario.customersLabel}
                  </p>
                </div>
                <ArrowRight className="mx-auto hidden h-4 w-4 shrink-0 text-[#94A3B8] sm:block" />
                <div
                  className={`flex-1 rounded-xl border border-[#4F46E5]/25 bg-[#EEF2FF] px-4 py-3 transition-all duration-700 ${
                    inView || reduced ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                  style={{ transitionDelay: reduced ? "0ms" : "300ms" }}
                >
                  <p className="text-xs font-medium text-[#4F46E5]">Monthly recurring commission</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-[#0F172A]">
                    {formatCurrency(monthly)}
                    <span className="text-sm font-medium text-[#64748B]">/mo</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#64748B]">
                    {scenario.customers} × {formatCurrency(perReferralMonthlyCents)} at{" "}
                    {commissionRatePct}% of {planPriceLabel}/mo
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        );
      })}
      <p className="text-center text-sm text-[#64748B]">
        Examples are for illustration only. Actual results depend on who you refer and whether they
        remain paying customers.
      </p>
    </div>
  );
}
