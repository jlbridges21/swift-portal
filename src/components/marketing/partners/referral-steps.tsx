"use client";

import { useRef, useState } from "react";
import {
  BarChart3,
  Link2,
  Share2,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInView, usePrefersReducedMotion } from "./motion";

function buildSteps(rate: number) {
  return [
    {
      key: "link",
      title: "Get your referral link",
      short: "Get your link",
      body: "After approval, you get your own partner link and referral code.",
      icon: Link2,
    },
    {
      key: "share",
      title: "Share it with your audience",
      short: "Share it",
      body: "Add it to your course, community, YouTube description, social content, website, email list, or anywhere you already talk to media professionals.",
      icon: Share2,
    },
    {
      key: "customer",
      title: "They become a customer",
      short: "They subscribe",
      body: "When someone uses your referral and becomes a paying ShootPortal customer, the referral is attributed to you.",
      icon: UserPlus,
    },
    {
      key: "earn",
      title: "You earn recurring commissions",
      short: "You earn",
      body: `You earn ${rate}% of eligible ShootPortal subscription payments for as long as that referred customer remains subscribed.`,
      icon: Wallet,
    },
    {
      key: "track",
      title: "Track everything",
      short: "Track it",
      body: "See referrals, customers, commissions, and payout activity from your partner dashboard.",
      icon: BarChart3,
    },
  ] as const;
}

export function ReferralSteps({ commissionRatePct }: { commissionRatePct: number }) {
  const steps = buildSteps(commissionRatePct);
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(trackRef, 0.2);
  const progress = reduced || inView ? ((active + 1) / steps.length) * 100 : 0;
  const current = steps[active]!;

  return (
    <div>
      <div className="hidden lg:block" ref={trackRef}>
        <div className="relative mb-8 px-2">
          <div className="absolute left-8 right-8 top-5 h-px bg-[#E2E8F0]" aria-hidden />
          <div
            className="absolute left-8 top-5 h-px bg-[#4F46E5] transition-all duration-700 ease-out"
            style={{ width: `calc(${progress}% - 4rem)` }}
            aria-hidden
          />
          <ol className="relative grid grid-cols-5 gap-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const selected = i === active;
              return (
                <li key={step.key}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    className={cn(
                      "flex w-full flex-col items-center rounded-xl border px-2 py-3 text-center transition",
                      selected
                        ? "border-[#4F46E5] bg-[#EEF2FF] shadow-sm"
                        : "border-[#E2E8F0] bg-white hover:border-[#C7D2FE]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border bg-white text-[#4F46E5]",
                        selected ? "border-[#4F46E5]" : "border-[#E2E8F0]"
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="mt-2 text-[11px] font-semibold text-[#0F172A]">
                      {i + 1}. {step.short}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
            Step {active + 1}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#0F172A]">{current.title}</h3>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#475569]">{current.body}</p>
        </div>
      </div>

      <ol className="relative space-y-3 lg:hidden">
        <div
          className="absolute bottom-4 left-[1.35rem] top-4 w-px bg-[#E2E8F0]"
          aria-hidden
        />
        <div
          className="absolute left-[1.35rem] top-4 w-px bg-[#4F46E5] transition-all duration-500"
          style={{ height: `calc(${((active + 1) / steps.length) * 100}% - 1rem)` }}
          aria-hidden
        />
        {steps.map((step, i) => {
          const Icon = step.icon;
          const open = i === active;
          return (
            <li key={step.key} className="relative pl-12">
              <span
                className={cn(
                  "absolute left-0 flex h-11 w-11 items-center justify-center rounded-full border bg-white text-[#4F46E5]",
                  open ? "border-[#4F46E5] shadow-sm" : "border-[#E2E8F0]"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition",
                  open ? "border-[#4F46E5] bg-[#EEF2FF]" : "border-[#E2E8F0] bg-white"
                )}
                aria-expanded={open}
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                  Step {i + 1}
                </span>
                <span className="mt-0.5 block text-base font-semibold text-[#0F172A]">
                  {step.title}
                </span>
                {open ? (
                  <span className="mt-2 block text-sm leading-relaxed text-[#475569]">
                    {step.body}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
