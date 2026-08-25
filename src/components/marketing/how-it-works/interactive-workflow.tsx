"use client";

import { useState } from "react";
import {
  CalendarClock,
  Camera,
  Check,
  ClipboardList,
  CreditCard,
  FileText,
  Images,
  PackageCheck,
} from "lucide-react";
import { HOW_IT_WORKS_STAGES } from "./constants";
import { cn } from "@/lib/utils";

const ICONS = [
  ClipboardList,
  FileText,
  Check,
  CalendarClock,
  Camera,
  Images,
  CreditCard,
  PackageCheck,
] as const;

function StagePanel({ index }: { index: number }) {
  const stage = HOW_IT_WORKS_STAGES[index];
  if (!stage) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
            Stage {index + 1}
          </p>
          <p className="text-sm font-semibold text-[#0F172A]">{stage.panelTitle}</p>
        </div>
        <span className="rounded-md bg-[#4F46E5]/10 px-2 py-1 text-[11px] font-semibold text-[#4F46E5]">
          {stage.title}
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 p-4 sm:p-5">
          <p className="text-sm font-medium text-[#0F172A]">{stage.lead}</p>
          <p className="text-sm leading-relaxed text-[#475569]">{stage.body}</p>
          <p className="text-xs text-[#64748B]">{stage.panelHint}</p>

          {index === 0 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-[11px] font-semibold text-[#0F172A]">Incoming request</p>
              <p className="mt-1 text-xs text-[#475569]">
                Avery Chen · 214 Oak Street · Photos + drone
              </p>
            </div>
          ) : null}

          {index === 1 ? (
            <div className="rounded-xl border border-[#E2E8F0] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#0F172A]">Listing Media Package</span>
                <span className="font-semibold text-[#0F172A]">$450</span>
              </div>
              <button
                type="button"
                tabIndex={-1}
                className="mt-3 w-full rounded-lg bg-[#4F46E5] py-2 text-xs font-semibold text-white"
              >
                Send estimate
              </button>
            </div>
          ) : null}

          {index === 2 ? (
            <div className="flex items-center gap-2 rounded-xl border border-[#16A34A]/25 bg-[#F0FDF4] px-3 py-3 text-sm font-medium text-[#15803D]">
              <Check className="h-4 w-4" />
              Client approved. Ready to schedule.
            </div>
          ) : null}

          {index === 3 ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4F46E5]">
                Calendar
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0F172A]">Sat · 10:00 AM</p>
              <p className="text-xs text-[#475569]">214 Oak Street · Listing Media</p>
            </div>
          ) : null}

          {index === 4 ? (
            <ul className="space-y-2 text-xs text-[#475569]">
              <li className="rounded-lg border border-[#E2E8F0] px-3 py-2">Address: 214 Oak Street</li>
              <li className="rounded-lg border border-[#E2E8F0] px-3 py-2">
                Services: Photos, drone, twilight
              </li>
              <li className="rounded-lg border border-[#E2E8F0] px-3 py-2">
                Notes: Lockbox code in project
              </li>
            </ul>
          ) : null}

          {index === 5 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="aspect-[4/3] rounded-lg bg-gradient-to-br from-slate-200 to-slate-100"
                  />
                ))}
              </div>
              <p className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#0F172A]">
                “Please keep the dusk exterior and swap photo 3.”
              </p>
            </div>
          ) : null}

          {index === 6 ? (
            <div className="rounded-xl border border-[#E2E8F0] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#0F172A]">Invoice #1042</span>
                <span className="rounded-md bg-[#16A34A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#15803D]">
                  Paid
                </span>
              </div>
              <p className="mt-2 text-lg font-semibold text-[#0F172A]">$450.00</p>
            </div>
          ) : null}

          {index === 7 ? (
            <div className="rounded-xl border border-[#16A34A]/20 bg-[#F0FDF4] p-3">
              <p className="text-xs font-semibold text-[#15803D]">Final files ready</p>
              <p className="mt-1 text-xs text-[#475569]">
                Client can download from the portal. No extra link chase.
              </p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-[#E2E8F0] bg-[#0F172A] p-4 text-slate-300 md:border-l md:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Project record
          </p>
          <p className="mt-2 text-sm font-semibold text-white">214 Oak Street</p>
          <p className="mt-1 text-xs text-slate-400">Avery Chen · Northside Realty</p>
          <ul className="mt-4 space-y-2 text-xs">
            {HOW_IT_WORKS_STAGES.map((s, i) => (
              <li
                key={s.key}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5",
                  i === index ? "bg-white/10 text-white" : "text-slate-500"
                )}
              >
                <span>{s.title}</span>
                {i < index ? <Check className="h-3.5 w-3.5 text-[#4ADE80]" /> : null}
                {i === index ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-[#818CF8]" />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function InteractiveWorkflow() {
  const [active, setActive] = useState(0);

  return (
    <div>
      {/* Desktop / tablet: horizontal stage selector */}
      <div className="hidden md:block">
        <div
          className="relative flex gap-1 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Workflow stages"
        >
          {HOW_IT_WORKS_STAGES.map((stage, i) => {
            const Icon = ICONS[i];
            const selected = i === active;
            return (
              <button
                key={stage.key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActive(i)}
                className={cn(
                  "group relative flex min-w-0 flex-1 flex-col items-center rounded-xl border px-2 py-3 text-center transition",
                  selected
                    ? "border-[#4F46E5] bg-[#EEF2FF] shadow-sm"
                    : "border-[#E2E8F0] bg-white hover:border-[#C7D2FE] hover:bg-[#F8FAFC]"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border text-[#4F46E5] transition",
                    selected
                      ? "border-[#4F46E5] bg-white shadow-sm"
                      : "border-[#E2E8F0] bg-[#F8FAFC] group-hover:border-[#C7D2FE]"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span
                  className={cn(
                    "mt-2 text-[11px] font-semibold",
                    selected ? "text-[#4F46E5]" : "text-[#0F172A]"
                  )}
                >
                  {stage.title}
                </span>
                <span className="mt-0.5 text-[10px] text-[#94A3B8]">{i + 1}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5" role="tabpanel">
          <StagePanel index={active} />
        </div>
      </div>

      {/* Mobile: vertical sequence */}
      <ol className="space-y-4 md:hidden">
        {HOW_IT_WORKS_STAGES.map((stage, i) => {
          const Icon = ICONS[i];
          const open = i === active;
          return (
            <li key={stage.key}>
              <button
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition",
                  open
                    ? "border-[#4F46E5] bg-[#EEF2FF]"
                    : "border-[#E2E8F0] bg-white"
                )}
                aria-expanded={open}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-[#4F46E5]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                      Step {i + 1}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-base font-semibold text-[#0F172A]">
                    {stage.title}
                  </span>
                  <span className="mt-1 block text-sm text-[#475569]">{stage.lead}</span>
                </span>
              </button>
              {open ? (
                <div className="mt-3">
                  <StagePanel index={i} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
