"use client";

import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare, Upload } from "lucide-react";
import { useInViewLive, usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

const PROJECTS = [
  {
    id: "oak",
    title: "214 Oak Street",
    client: "Avery Chen",
    stage: "Review",
  },
  {
    id: "elm",
    title: "220 Elm Street",
    client: "Sam Okonkwo",
    stage: "Scheduled",
  },
  {
    id: "west",
    title: "Westfield Exterior",
    client: "Westfield Partners",
    stage: "Awaiting payment",
  },
] as const;

type Focus = "board" | "message" | "upload" | "paid";

export function InteractiveAdminMockup() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewLive(rootRef, 0.2);
  const [focus, setFocus] = useState<Focus>("board");
  const [selected, setSelected] = useState(0);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    if (reduced || !inView) return;
    const sequence: Focus[] = ["board", "message", "upload", "paid"];
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % sequence.length;
      const next = sequence[i] ?? "board";
      setFocus(next);
      if (next === "paid") setPaid(true);
      if (next === "board") setPaid(false);
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  return (
    <div ref={rootRef} className="relative" aria-hidden>
      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.38)]">
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <div className="ml-2 flex h-7 flex-1 items-center rounded-md bg-white px-3 text-[11px] text-[#64748B] ring-1 ring-[#E2E8F0]">
            shootportal.app/admin
          </div>
        </div>

        <div className="grid gap-0 md:grid-cols-[180px_1fr]">
          <aside className="hidden border-r border-[#E2E8F0] bg-[#0F172A] p-4 text-slate-300 md:block">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Your Studio
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              {["Projects", "Calendar", "Messages", "Media", "Clients"].map((item) => (
                <li
                  key={item}
                  className={cn(
                    "rounded-md px-2 py-1.5",
                    item === "Projects"
                      ? "bg-white/10 font-medium text-white"
                      : "text-slate-400"
                  )}
                >
                  {item}
                </li>
              ))}
            </ul>
          </aside>

          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-[#4F46E5]">Command center</p>
                <p className="text-lg font-semibold text-[#0F172A]">Active projects</p>
              </div>
              <div className="flex gap-1.5">
                {(["board", "message", "upload", "paid"] as Focus[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setFocus(key);
                      if (key === "paid") setPaid(true);
                    }}
                    className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-semibold capitalize",
                      focus === key
                        ? "bg-[#4F46E5] text-white"
                        : "bg-slate-100 text-[#64748B]"
                    )}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {PROJECTS.map((project, i) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={cn(
                    "rounded-xl border p-3 text-left transition",
                    selected === i
                      ? "border-[#4F46E5] bg-[#EEF2FF] shadow-sm"
                      : "border-[#E2E8F0] bg-white hover:border-[#C7D2FE]"
                  )}
                >
                  <p className="text-sm font-semibold text-[#0F172A]">{project.title}</p>
                  <p className="mt-0.5 text-xs text-[#475569]">{project.client}</p>
                  <span className="mt-2 inline-flex rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-[#4F46E5] ring-1 ring-[#E2E8F0]">
                    {project.id === "west" && paid ? "Paid" : project.stage}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div
                className={cn(
                  "rounded-xl border p-3 transition",
                  focus === "message"
                    ? "border-[#4F46E5] bg-[#EEF2FF]"
                    : "border-[#E2E8F0] bg-[#F8FAFC]"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-[#4F46E5]" />
                  <p className="text-xs font-semibold text-[#0F172A]">Client message</p>
                </div>
                <p className="mt-2 text-sm text-[#0F172A]">
                  “Looks great. Please keep the dusk exterior and swap photo 3.”
                </p>
              </div>

              <div
                className={cn(
                  "rounded-xl border p-3 transition",
                  focus === "upload"
                    ? "border-[#4F46E5] bg-[#EEF2FF]"
                    : "border-[#E2E8F0] bg-[#F8FAFC]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-[#4F46E5]" />
                  <p className="text-xs font-semibold text-[#0F172A]">Media upload</p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-[#4F46E5] transition-[width] duration-700"
                    style={{ width: focus === "upload" ? "78%" : "35%" }}
                  />
                </div>
                <p className="mt-2 text-[11px] text-[#64748B]">12 of 16 files</p>
              </div>
            </div>

            <div
              className={cn(
                "mt-3 flex items-center gap-3 rounded-xl border px-3 py-3 transition",
                focus === "paid" || paid
                  ? "border-[#16A34A]/30 bg-[#F0FDF4]"
                  : "border-[#E2E8F0] bg-white"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                  paid
                    ? "bg-[#16A34A]/15 text-[#15803D]"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {paid ? <Check className="h-4 w-4" /> : "$"}
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {paid ? "Invoice paid · $1,250" : "Invoice unpaid · $1,250"}
                </p>
                <p className="text-xs text-[#64748B]">Westfield Commercial Exterior</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4F46E5]">
                Upcoming shoot
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                Sat · 10:00 AM · 220 Elm Street
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
