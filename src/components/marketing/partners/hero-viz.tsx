"use client";

/**
 * Hero visual: referrals become active customers and feed recurring commissions.
 * Example arithmetic only. Uses live commission rate for labels.
 */

import { useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { useInViewLive, usePrefersReducedMotion } from "./motion";

const STUDIOS = [
  { name: "Skyline Media", initials: "SM" },
  { name: "Coastal Listing Co.", initials: "CL" },
  { name: "Northside Aerial", initials: "NA" },
] as const;

const PHASE_MS = 2600;

export function PartnerHeroViz({
  commissionRatePct,
  perReferralMonthlyCents,
}: {
  commissionRatePct: number;
  perReferralMonthlyCents: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewLive(rootRef, 0.25);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % 6);
    }, PHASE_MS);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  const activeCount = reduced ? 3 : Math.min(3, Math.floor(phase / 1) + (phase >= 1 ? 1 : 0));
  // phases: 0 enter first, 1 second, 2 third, 3 commissions pulse, 4 counter climb, 5 settle
  const visibleStudios = reduced ? 3 : Math.min(3, phase + 1);
  const showCommissions = reduced || phase >= 2;
  const monthlyTotal = Math.round(
    (reduced ? 3 : Math.min(3, Math.max(1, phase))) * perReferralMonthlyCents
  );
  const graphHeight = reduced ? 72 : 28 + Math.min(3, phase + 1) * 18;

  return (
    <div ref={rootRef} className="relative w-full" aria-hidden style={{ minHeight: "22rem" }}>
      <div
        className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-90 sm:-inset-6"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 55% 30%, rgba(79,70,229,0.16), transparent 58%), radial-gradient(ellipse 35% 40% at 10% 80%, rgba(15,23,42,0.04), transparent)",
        }}
      />

      <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0]/90 bg-white/95 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)] backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC]/95 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
              Partner dashboard
            </p>
            <p className="text-sm font-semibold text-[#0F172A]">Recurring referrals</p>
          </div>
          <span className="rounded-md bg-[#4F46E5]/10 px-2.5 py-1 text-[11px] font-semibold text-[#4F46E5]">
            {commissionRatePct}% commission
          </span>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
              Referred studios
            </p>
            {STUDIOS.map((studio, i) => {
              const visible = i < visibleStudios;
              const active = reduced || i < Math.min(3, phase + 1);
              return (
                <div
                  key={studio.name}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-700 ${
                    visible
                      ? "translate-x-0 border-[#E2E8F0] bg-white opacity-100"
                      : "-translate-x-4 border-transparent bg-transparent opacity-0"
                  } ${active ? "shadow-sm" : ""}`}
                  style={{ transitionDelay: reduced ? "0ms" : `${i * 120}ms` }}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[11px] font-bold text-[#4F46E5]">
                    {studio.initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#0F172A]">{studio.name}</p>
                    <p className="text-[11px] text-[#64748B]">
                      {active ? "Active customer" : "Trial"}
                    </p>
                  </div>
                  {showCommissions && active ? (
                    <span className="shrink-0 rounded-md bg-[#F0FDF4] px-2 py-1 text-[11px] font-semibold text-[#15803D]">
                      +{formatCurrency(perReferralMonthlyCents)}/mo
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-[#64748B]">
                      Pending
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-xl border border-[#4F46E5]/20 bg-gradient-to-br from-[#EEF2FF] to-white p-4 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#4F46E5]">
                Your partner earnings
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                {formatCurrency(monthlyTotal)}
                <span className="ml-1 text-base font-medium text-[#64748B]">/mo</span>
              </p>
              <p className="mt-1 text-xs text-[#64748B]">
                Example only · {commissionRatePct}% of subscription payments
              </p>
              <div
                className={`mt-3 h-2 w-2 rounded-full bg-[#4F46E5] ${
                  !reduced && inView && showCommissions ? "partner-pulse" : ""
                }`}
                title="Recurring payment"
              />
            </div>

            <div className="flex flex-1 flex-col justify-end rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                Monthly trend
              </p>
              <div className="mt-3 flex h-24 items-end gap-2">
                {[0.35, 0.5, 0.62, 0.78, 1].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-[#4F46E5]/80 transition-all duration-700"
                    style={{
                      height: `${reduced ? h * 100 : Math.min(100, (graphHeight / 90) * h * 100)}%`,
                      opacity: reduced || i <= phase ? 1 : 0.25,
                    }}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[#64748B]">
                {activeCount} active · commissions continue while they stay subscribed
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes partner-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.35); opacity: 0.65; }
        }
        .partner-pulse { animation: partner-pulse 2.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .partner-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
