"use client";

/**
 * Hero visualization: one project card advancing through workflow stages.
 * Pauses when off-screen; respects prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, ImageIcon, Upload } from "lucide-react";
import { HERO_PROJECT_STAGES } from "./constants";
import { useInViewLive, usePrefersReducedMotion } from "./motion";

const STAGE_MS = 2200;

function StatusPill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-[11px] font-semibold ${
        accent
          ? "bg-[#4F46E5]/10 text-[#4F46E5]"
          : "bg-slate-100 text-[#475569]"
      }`}
    >
      {label}
    </span>
  );
}

function Toast({
  children,
  visible,
}: {
  children: React.ReactNode;
  visible: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute right-3 top-3 z-20 flex max-w-[15rem] items-start gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-lg transition-all duration-500 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

export function HowItWorksHeroViz() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewLive(rootRef, 0.25);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => {
      setStage((s) => (s + 1) % HERO_PROJECT_STAGES.length);
    }, STAGE_MS);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  const status = HERO_PROJECT_STAGES[reduced ? 5 : stage] ?? HERO_PROJECT_STAGES[0];
  const progress = reduced ? 0.75 : stage / (HERO_PROJECT_STAGES.length - 1);
  const showApproval = !reduced && (stage === 2 || stage === 3);
  const showPayment = !reduced && (stage === 6 || stage === 7);
  const showUpload = !reduced && (stage === 4 || stage === 5);
  const showDelivered = reduced || stage === 7;
  const checkCount = reduced ? 5 : Math.min(stage, 5);

  return (
    <div ref={rootRef} className="relative w-full" aria-hidden style={{ minHeight: "22rem" }}>
      <div
        className="pointer-events-none absolute -inset-4 rounded-[2rem] opacity-90 sm:-inset-6"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 60% 35%, rgba(79,70,229,0.16), transparent 58%), radial-gradient(ellipse 40% 45% at 12% 85%, rgba(15,23,42,0.04), transparent)",
        }}
      />

      <div className="relative overflow-hidden rounded-2xl border border-[#E2E8F0]/90 bg-white/90 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)] backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC]/95 px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <div className="ml-2 flex h-7 flex-1 items-center rounded-md bg-white px-3 text-[11px] text-[#64748B] ring-1 ring-[#E2E8F0]">
            shootportal.app/admin/projects/214-oak
          </div>
        </div>

        <div className="relative p-4 sm:p-6">
          <Toast visible={showApproval}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16A34A]/15 text-[#16A34A]">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">Estimate approved</p>
              <p className="text-[10px] text-[#64748B]">Avery Chen confirmed</p>
            </div>
          </Toast>

          <Toast visible={showPayment}>
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#16A34A]/15 text-[#16A34A]">
              <CreditCard className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-[#0F172A]">Payment confirmed</p>
              <p className="text-[10px] text-[#64748B]">$450 · Invoice paid</p>
            </div>
          </Toast>

          <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
            <div
              className={`relative w-full max-w-sm rounded-xl border bg-white p-4 shadow-sm transition-all duration-500 ${
                stage >= 6 ? "border-[#16A34A]/35 ring-1 ring-[#16A34A]/15" : "border-[#E2E8F0]"
              } ${!reduced && inView ? "hiw-hero-float" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#4F46E5]">Listing Media</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-[#0F172A]">
                    214 Oak Street
                  </p>
                  <p className="mt-1 text-sm text-[#475569]">Avery Chen · Northside Realty</p>
                </div>
                <StatusPill label={status} accent />
              </div>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium text-[#64748B]">
                  <span>Project progress</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#4F46E5] transition-[width] duration-700 ease-out"
                    style={{ width: `${Math.max(8, progress * 100)}%` }}
                  />
                </div>
              </div>

              <ul className="mt-4 grid grid-cols-2 gap-2">
                {["Brief", "Estimate", "Schedule", "Media", "Payment"].map((item, i) => (
                  <li
                    key={item}
                    className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-2 text-[11px] text-[#0F172A]"
                  >
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-300 ${
                        i < checkCount
                          ? "bg-[#16A34A] text-white"
                          : "bg-slate-200 text-transparent"
                      }`}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>

              {showUpload ? (
                <div className="mt-4 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                  <div className="flex items-center gap-2 text-[11px] font-medium text-[#0F172A]">
                    <Upload className="h-3.5 w-3.5 text-[#4F46E5]" />
                    Uploading media
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-[#4F46E5] transition-[width] duration-1000"
                      style={{ width: stage === 4 ? "62%" : "100%" }}
                    />
                  </div>
                </div>
              ) : null}

              {showDelivered ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-[#16A34A]/25 bg-[#F0FDF4] px-3 py-2.5 text-[11px] font-medium text-[#15803D]">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Final delivery confirmed in client portal
                </div>
              ) : null}
            </div>

            <div className="hidden min-w-0 flex-1 lg:block">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
                Workflow
              </p>
              <ol className="mt-3 grid grid-cols-2 gap-2">
                {HERO_PROJECT_STAGES.map((label, i) => {
                  const active = reduced ? i <= 5 : i === stage;
                  const done = reduced ? i < 5 : i < stage;
                  return (
                    <li
                      key={label}
                      className={`rounded-lg border px-3 py-2 text-left text-[11px] transition-all duration-500 ${
                        active
                          ? "border-[#4F46E5] bg-[#EEF2FF] font-semibold text-[#4F46E5] shadow-sm"
                          : done
                            ? "border-[#E2E8F0] bg-white text-[#0F172A]"
                            : "border-transparent bg-[#F8FAFC] text-[#94A3B8]"
                      }`}
                    >
                      <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-current/10 text-[9px] font-bold">
                        {done ? "✓" : i + 1}
                      </span>
                      {label}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1 lg:hidden">
            {HERO_PROJECT_STAGES.map((label, i) => {
              const active = reduced ? i === 5 : i === stage;
              return (
                <span
                  key={label}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors ${
                    active
                      ? "bg-[#4F46E5] text-white"
                      : "bg-slate-100 text-[#64748B]"
                  }`}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hiw-hero-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -3px, 0); }
        }
        .hiw-hero-float {
          animation: hiw-hero-float 6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hiw-hero-float { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
