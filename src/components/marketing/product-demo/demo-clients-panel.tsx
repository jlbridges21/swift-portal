"use client";

import { Search } from "lucide-react";
import { DEMO_CLIENTS } from "./demo-data";

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Table layout mirroring ClientsTable columns. */
export function DemoClientsPanel({ highlightIndex }: { highlightIndex: number }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] px-3 py-2.5">
        <div className="relative min-w-[160px] flex-1 max-w-md">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#94A3B8]" aria-hidden />
          <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] py-1.5 pl-8 pr-2 text-xs text-[#94A3B8]">
            Search name, email, company…
          </div>
        </div>
        <span className="rounded-md border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B]">
          All clients
        </span>
        <span className="rounded-md border border-[#E2E8F0] px-2 py-1 text-[11px] font-medium text-[#64748B]">
          Active projects
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-xs font-medium text-[#64748B]">
            <tr>
              <th className="px-3 py-2.5 font-medium">Client</th>
              <th className="px-3 py-2.5 font-medium">Projects</th>
              <th className="px-3 py-2.5 font-medium">Lifetime</th>
              <th className="px-3 py-2.5 font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_CLIENTS.map((c, i) => {
              const active = i === highlightIndex;
              return (
                <tr
                  key={c.name}
                  data-demo-target={active ? "client-row" : undefined}
                  className={`border-b border-[#E2E8F0] transition-colors ${
                    active ? "bg-[#EEF2FF]" : "hover:bg-[#F8FAFC]"
                  }`}
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-[#0F172A]">{c.name}</p>
                    <p className="text-xs text-[#64748B]">{c.company ?? "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-[#0F172A]">{c.projects}</td>
                  <td className="px-3 py-3 font-medium text-[#0F172A]">{formatMoney(c.revenue)}</td>
                  <td className="px-3 py-3">
                    {c.outstanding > 0 ? (
                      <span className="font-medium text-orange-600">{formatMoney(c.outstanding)}</span>
                    ) : (
                      <span className="text-[#94A3B8]">$0</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
