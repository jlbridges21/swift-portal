"use client";

import { useId, useState } from "react";

/**
 * Cost-plus job pricing worksheet. Every input is the reader's own number;
 * nothing here is a market rate. Defaults are placeholders to show the math.
 */
export function JobPriceCalculator({
  defaults = { shootHours: 1.5, editHours: 2, adminHours: 0.75, miles: 30, hourlyRate: 75, perMile: 0.7, overheadPerJob: 25, marginPct: 20 },
}: {
  defaults?: {
    shootHours: number;
    editHours: number;
    adminHours: number;
    miles: number;
    hourlyRate: number;
    perMile: number;
    overheadPerJob: number;
    marginPct: number;
  };
}) {
  const id = useId();
  const [v, setV] = useState(defaults);
  const labor = (v.shootHours + v.editHours + v.adminHours) * v.hourlyRate;
  const travel = v.miles * 2 * v.perMile;
  const cost = labor + travel + v.overheadPerJob;
  const price = cost * (1 + v.marginPct / 100);
  const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

  const fields: { key: keyof typeof v; label: string; step: number; suffix?: string; prefix?: string }[] = [
    { key: "shootHours", label: "On-site hours", step: 0.25, suffix: "hr" },
    { key: "editHours", label: "Editing hours", step: 0.25, suffix: "hr" },
    { key: "adminHours", label: "Admin & delivery hours", step: 0.25, suffix: "hr" },
    { key: "hourlyRate", label: "What your hour is worth", step: 5, prefix: "$" },
    { key: "miles", label: "One-way miles", step: 5, suffix: "mi" },
    { key: "perMile", label: "Vehicle cost per mile", step: 0.05, prefix: "$" },
    { key: "overheadPerJob", label: "Overhead per job", step: 5, prefix: "$" },
    { key: "marginPct", label: "Profit margin", step: 5, suffix: "%" },
  ];

  return (
    <div className="overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.6)]">
      <div className="grid gap-0 lg:grid-cols-[1.3fr_1fr]">
        <form className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6" onSubmit={(e) => e.preventDefault()} aria-label="Job price worksheet">
          {fields.map((f) => (
            <label key={f.key} htmlFor={`${id}-${f.key}`} className="block">
              <span className="text-xs font-medium text-[#475569]">{f.label}</span>
              <span className="mt-1 flex items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 focus-within:border-[#A5B4FC] focus-within:ring-2 focus-within:ring-[#C7D2FE]">
                {f.prefix ? <span className="text-sm text-[#64748B]">{f.prefix}</span> : null}
                <input
                  id={`${id}-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={f.step}
                  value={v[f.key]}
                  onChange={(e) => setV((prev) => ({ ...prev, [f.key]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="min-h-10 w-full bg-transparent px-1.5 text-sm font-semibold tabular-nums text-[#0F172A] outline-none"
                />
                {f.suffix ? <span className="text-sm text-[#64748B]">{f.suffix}</span> : null}
              </span>
            </label>
          ))}
        </form>
        <div className="flex flex-col justify-center bg-[#0F172A] p-6 text-white" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A5B4FC]">Minimum price for this job</p>
          <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">{money(price)}</p>
          <dl className="mt-5 space-y-1.5 text-sm text-slate-300">
            <div className="flex justify-between"><dt>Labor</dt><dd className="tabular-nums">{money(labor)}</dd></div>
            <div className="flex justify-between"><dt>Travel (round trip)</dt><dd className="tabular-nums">{money(travel)}</dd></div>
            <div className="flex justify-between"><dt>Overhead</dt><dd className="tabular-nums">{money(v.overheadPerJob)}</dd></div>
            <div className="flex justify-between border-t border-white/10 pt-1.5"><dt>Break-even</dt><dd className="tabular-nums">{money(cost)}</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            A floor, not a market rate. Compare it with what clients in your area actually pay before you set a price.
          </p>
        </div>
      </div>
    </div>
  );
}
