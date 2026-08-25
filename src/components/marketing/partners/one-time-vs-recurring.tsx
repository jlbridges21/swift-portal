"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useInViewLive, usePrefersReducedMotion } from "./motion";

const ONE_TIME = ["Customer signs up", "You get paid once", "Done"] as const;
const RECURRING = [
  "Customer signs up",
  "Month 1 commission",
  "Month 2 commission",
  "Month 3 commission",
  "Month 4 commission",
  "Continues while subscribed",
] as const;

export function OneTimeVsRecurring({ commissionRatePct }: { commissionRatePct: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewLive(ref, 0.3);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => {
      setTick((t) => (t + 1) % 8);
    }, 900);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  const leftDone = reduced || tick >= 2;
  const rightVisible = reduced ? RECURRING.length : Math.min(RECURRING.length, tick + 1);

  return (
    <div ref={ref}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            One time referral program
          </p>
          <ul className="mt-5 space-y-3">
            {ONE_TIME.map((item, i) => {
              const show = reduced || tick >= i;
              const stopped = i === 2 && leftDone;
              return (
                <li
                  key={item}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-all duration-500 ${
                    show
                      ? stopped
                        ? "border-slate-200 bg-slate-50 text-[#64748B]"
                        : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]"
                      : "border-transparent opacity-0"
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      stopped ? "bg-slate-200 text-slate-500" : "bg-[#4F46E5]/10 text-[#4F46E5]"
                    }`}
                  >
                    {stopped ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </span>
                  {item}
                </li>
              );
            })}
          </ul>
          <p className="mt-5 text-sm text-[#64748B]">Payment stops after the first payout.</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#4F46E5]/25 bg-white p-5 shadow-[0_20px_50px_-28px_rgba(79,70,229,0.4)] sm:p-6">
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full opacity-70"
            style={{
              background: "radial-gradient(circle, rgba(79,70,229,0.2), transparent 70%)",
            }}
          />
          <p className="relative text-xs font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
            ShootPortal Partner Program
          </p>
          <ul className="relative mt-5 space-y-2.5">
            {RECURRING.map((item, i) => {
              const show = i < rightVisible;
              const ongoing = i === RECURRING.length - 1 && show;
              return (
                <li
                  key={item}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-500 ${
                    show
                      ? ongoing
                        ? "border-[#4F46E5] bg-[#EEF2FF] font-medium text-[#4F46E5]"
                        : "border-[#E2E8F0] bg-[#F8FAFC] text-[#0F172A]"
                      : "border-transparent opacity-0 translate-y-2"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4F46E5]/10 text-[10px] font-bold text-[#4F46E5]">
                    {ongoing ? "∞" : i + 1}
                  </span>
                  {item}
                </li>
              );
            })}
          </ul>
          <p className="relative mt-5 text-sm text-[#475569]">
            You earn {commissionRatePct}% each time they pay ShootPortal, for as long as they stay
            subscribed.
          </p>
        </div>
      </div>
      <p className="mt-6 text-center text-sm font-medium text-[#0F172A]">
        A growing customer base can turn into a growing recurring commission stream.
      </p>
    </div>
  );
}
