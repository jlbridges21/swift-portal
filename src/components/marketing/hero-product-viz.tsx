"use client";

/**
 * Marketing hero product visualization.
 * Fictional content only. Mirrors admin pipeline / inbox / media / clients tokens.
 * Decorative (aria-hidden). Animates transform + opacity; pauses off-screen.
 */

import { useEffect, useRef, useState } from "react";
import { GripVertical, MessageSquare } from "lucide-react";

const MEDIA_SWATCHES = [
  "linear-gradient(145deg,#1e293b 0%,#475569 45%,#94a3b8 100%)",
  "linear-gradient(160deg,#0f172a 0%,#312e81 50%,#6366f1 100%)",
  "linear-gradient(135deg,#44403c 0%,#a8a29e 55%,#f5f5f4 100%)",
  "linear-gradient(150deg,#1c1917 0%,#78716c 40%,#d6d3d1 100%)",
] as const;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
}

function PipelineCard({
  title,
  client,
  address,
  moving,
}: {
  title: string;
  client: string;
  address: string;
  moving?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-white p-2.5 shadow-sm ${
        moving ? "border-[#4F46E5] ring-2 ring-[#4F46E5]/20" : "border-[#E2E8F0]"
      }`}
    >
      <div className="flex gap-1">
        <GripVertical className="mt-0.5 h-3 w-3 shrink-0 text-[#94A3B8]" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium leading-snug text-[#0F172A]">{title}</p>
          <p className="truncate text-[10px] text-[#475569]">{client}</p>
          <p className="mt-0.5 truncate text-[10px] text-[#475569]">{address}</p>
        </div>
      </div>
    </div>
  );
}

function PipelineColumn({
  label,
  count,
  children,
  accent,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex w-[9.25rem] shrink-0 flex-col overflow-hidden rounded-xl border bg-slate-50/80 ${
        accent ? "border-[#4F46E5]/40 bg-[#EEF2FF]/40" : "border-[#E2E8F0]"
      }`}
    >
      <div className="flex items-center justify-between gap-1 border-b border-[#E2E8F0] px-2 py-2">
        <h3 className="min-w-0 truncate text-[10px] font-semibold text-[#0F172A]">{label}</h3>
        <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#475569] shadow-sm">
          {count}
        </span>
      </div>
      <div className="flex min-h-[7.5rem] flex-col gap-1.5 p-1.5">{children}</div>
    </div>
  );
}

/** Desktop layered composition + mobile single panel. */
export function HeroProductViz() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(rootRef);
  const live = inView && !reduced;

  return (
    <div
      ref={rootRef}
      className={`hero-product-viz relative w-full ${live ? "hero-product-viz--live" : ""} ${
        reduced ? "hero-product-viz--static" : ""
      }`}
      aria-hidden
      style={{ minHeight: "22rem" }}
    >
      <style>{`
        /* Static composed frame by default (SSR, off-screen, reduced-motion). */
        .hero-product-viz .hv-card-leave { opacity: 0; }
        .hero-product-viz--live .hv-card-leave { opacity: 1; }
        .hero-product-viz .hv-card-enter { opacity: 1; }
        .hero-product-viz .hv-toast { opacity: 0; }
        .hero-product-viz .hv-thumb { opacity: 1; }
        .hero-product-viz .hv-cal { opacity: 1; }
        .hero-product-viz .hv-status { opacity: 1; }

        @keyframes hv-card-advance {
          0%, 14% { opacity: 1; transform: translate3d(0, 0, 0); }
          26%, 100% { opacity: 0; transform: translate3d(120%, -6px, 0); }
        }
        @keyframes hv-card-arrive {
          0%, 14% { opacity: 0; transform: translate3d(-110%, 8px, 0) scale(0.98); }
          26%, 100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
        }
        @keyframes hv-toast-in {
          0%, 32% { opacity: 0; transform: translate3d(24px, 0, 0); }
          40%, 62% { opacity: 1; transform: translate3d(0, 0, 0); }
          74%, 100% { opacity: 0; transform: translate3d(8px, -4px, 0); }
        }
        @keyframes hv-badge-pop {
          0%, 40% { transform: scale(1); }
          45% { transform: scale(1.25); }
          52%, 100% { transform: scale(1); }
        }
        @keyframes hv-thumb-in {
          0%, 8% { opacity: 0; transform: translate3d(0, 8px, 0); }
          18%, 100% { opacity: 1; transform: translate3d(0, 0, 0); }
        }
        @keyframes hv-cal-drop {
          0%, 48% { opacity: 0; transform: translate3d(0, -10px, 0); }
          56%, 88% { opacity: 1; transform: translate3d(0, 0, 0); }
          95%, 100% { opacity: 0.85; transform: translate3d(0, 0, 0); }
        }
        @keyframes hv-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -4px, 0); }
        }
        @keyframes hv-status-cycle {
          0%, 18% { opacity: 1; }
          22%, 38% { opacity: 0; }
          42%, 100% { opacity: 0; }
        }
        @keyframes hv-status-cycle-b {
          0%, 18% { opacity: 0; }
          22%, 48% { opacity: 1; }
          52%, 100% { opacity: 0; }
        }
        @keyframes hv-status-cycle-c {
          0%, 48% { opacity: 0; }
          52%, 78% { opacity: 1; }
          82%, 100% { opacity: 0; }
        }
        @keyframes hv-status-cycle-d {
          0%, 78% { opacity: 0; }
          82%, 100% { opacity: 1; }
        }
        @keyframes hv-request-in {
          0%, 5% { opacity: 0; transform: translate3d(-12px, 0, 0); }
          12%, 55% { opacity: 1; transform: translate3d(0, 0, 0); }
          65%, 100% { opacity: 0; transform: translate3d(0, -6px, 0); }
        }

        .hero-product-viz--live .hv-card-leave { animation: hv-card-advance 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-card-enter { animation: hv-card-arrive 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-toast { animation: hv-toast-in 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-badge { animation: hv-badge-pop 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-thumb { animation: hv-thumb-in 14s ease-out infinite; }
        .hero-product-viz--live .hv-thumb:nth-child(2) { animation-delay: 0.35s; }
        .hero-product-viz--live .hv-thumb:nth-child(3) { animation-delay: 0.7s; }
        .hero-product-viz--live .hv-thumb:nth-child(4) { animation-delay: 1.05s; }
        .hero-product-viz--live .hv-cal { animation: hv-cal-drop 14s ease-out infinite; }
        .hero-product-viz--live .hv-float-a { animation: hv-float 7s ease-in-out infinite; }
        .hero-product-viz--live .hv-float-b { animation: hv-float 8.5s ease-in-out infinite reverse; }
        .hero-product-viz--live .hv-status-a { animation: hv-status-cycle 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-status-b { animation: hv-status-cycle-b 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-status-c { animation: hv-status-cycle-c 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-status-d { animation: hv-status-cycle-d 14s ease-in-out infinite; }
        .hero-product-viz--live .hv-request { animation: hv-request-in 14s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .hero-product-viz .hv-card-leave { opacity: 0 !important; }
          .hero-product-viz .hv-card-enter,
          .hero-product-viz .hv-toast,
          .hero-product-viz .hv-thumb,
          .hero-product-viz .hv-cal,
          .hero-product-viz .hv-float-a,
          .hero-product-viz .hv-float-b,
          .hero-product-viz .hv-request,
          .hero-product-viz .hv-status-a,
          .hero-product-viz .hv-status-b,
          .hero-product-viz .hv-status-c,
          .hero-product-viz .hv-status-d {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
          .hero-product-viz .hv-status-b,
          .hero-product-viz .hv-status-c,
          .hero-product-viz .hv-status-d,
          .hero-product-viz .hv-request {
            opacity: 0 !important;
          }
          .hero-product-viz .hv-status-a { opacity: 1 !important; }
        }
      `}</style>

      {/* Soft indigo wash */}
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 70% 40%, rgba(79,70,229,0.18), transparent 60%), radial-gradient(ellipse 40% 50% at 15% 80%, rgba(15,23,42,0.05), transparent)",
        }}
      />

      {/* ——— Mobile: single pipeline panel ——— */}
      <div className="relative lg:hidden">
        <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#4F46E5]">
                Projects
              </p>
              <p className="text-sm font-semibold text-[#0F172A]">Pipeline</p>
            </div>
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#4F46E5] shadow-sm ring-1 ring-[#E2E8F0]">
              <MessageSquare className="h-4 w-4" />
              <span className="hv-beat hv-badge absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#4F46E5] px-1 text-[9px] font-bold text-white">
                2
              </span>
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto p-3">
            <PipelineColumn label="Editing" count={1}>
              <div className="hv-beat hv-card-leave">
                <PipelineCard
                  title="Elm Street Walkthrough"
                  client="Sam Okonkwo"
                  address="220 Elm Street"
                  moving
                />
              </div>
            </PipelineColumn>
            <PipelineColumn label="In Review" count={2} accent>
              <PipelineCard
                title="Lakeside Amenities"
                client="Lakeside Hospitality"
                address="1 Lakeside Blvd"
              />
              <div className="hv-beat hv-card-enter">
                <PipelineCard
                  title="Elm Street Walkthrough"
                  client="Sam Okonkwo"
                  address="220 Elm Street"
                  moving
                />
              </div>
            </PipelineColumn>
            <PipelineColumn label="Payment" count={1}>
              <PipelineCard
                title="Westfield Exterior"
                client="Westfield Partners"
                address="3400 Westfield Ave"
              />
            </PipelineColumn>
          </div>
          <div className="hv-beat hv-toast mx-3 mb-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#16A34A]/15 text-xs font-bold text-[#16A34A]">
              $
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0F172A]">Payment received · $1,250</p>
              <p className="truncate text-[10px] text-[#475569]">Westfield Commercial Exterior</p>
            </div>
          </div>
          <div className="relative mx-3 mb-3 h-8 overflow-hidden">
            <div className="hv-beat hv-request absolute inset-0 flex items-center gap-2 rounded-lg border border-[#4F46E5]/25 bg-[#EEF2FF] px-3">
              <span className="text-[10px] font-semibold text-[#4F46E5]">New request</span>
              <span className="truncate text-[10px] text-[#475569]">214 Oak Street · Avery Chen</span>
            </div>
            <span className="hv-beat hv-status-b absolute inset-0 flex items-center rounded-lg border border-[#4F46E5]/25 bg-[#EEF2FF] px-3 text-[10px] font-semibold text-[#4F46E5]">
              Estimate approved
            </span>
            <span className="hv-beat hv-status-c absolute inset-0 flex items-center rounded-lg border border-[#4F46E5]/25 bg-[#EEF2FF] px-3 text-[10px] font-semibold text-[#4F46E5]">
              Shoot scheduled
            </span>
            <span className="hv-beat hv-status-d absolute inset-0 flex items-center rounded-lg border border-[#16A34A]/25 bg-[#F0FDF4] px-3 text-[10px] font-semibold text-[#15803D]">
              Delivered
            </span>
          </div>
        </div>
      </div>

      {/* ——— Desktop: layered composition ——— */}
      <div className="relative hidden lg:block" style={{ height: "28rem" }}>
        {/* Primary pipeline panel */}
        <div className="absolute inset-x-0 top-0 z-10 overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.4)]">
          <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <div className="h-2.5 w-2.5 rounded-full bg-slate-300" />
            <div className="ml-2 flex h-7 flex-1 items-center rounded-md bg-white px-3 text-[11px] text-[#475569] ring-1 ring-[#E2E8F0]">
              shootportal.app/admin/projects
            </div>
          </div>
          <div className="grid grid-cols-[9.5rem_1fr]">
            <aside className="border-r border-[#E2E8F0] bg-[#0F172A] p-3 text-slate-300">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                Your Studio
              </p>
              <ul className="mt-3 space-y-1 text-[11px]">
                {["Projects", "Calendar", "Messages", "Media", "Clients"].map((item) => (
                  <li
                    key={item}
                    className={
                      item === "Projects"
                        ? "rounded-md bg-white/10 px-2 py-1.5 font-medium text-white"
                        : "px-2 py-1.5 text-slate-400"
                    }
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </aside>
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-[#0F172A]">Pipeline</p>
                <p className="text-[10px] text-[#475569]">Drag to advance stage</p>
              </div>
              <div className="flex gap-2 overflow-hidden">
                <PipelineColumn label="Scheduled" count={1}>
                  <PipelineCard
                    title="North Pier Progress"
                    client="Atlas Build Co."
                    address="900 North Pier Rd"
                  />
                </PipelineColumn>
                <PipelineColumn label="Editing" count={1}>
                  <div className="hv-beat hv-card-leave">
                    <PipelineCard
                      title="Elm Street Walkthrough"
                      client="Sam Okonkwo"
                      address="220 Elm Street"
                      moving
                    />
                  </div>
                </PipelineColumn>
                <PipelineColumn label="In Review" count={2} accent>
                  <PipelineCard
                    title="Lakeside Amenities"
                    client="Lakeside Hospitality"
                    address="1 Lakeside Blvd"
                  />
                  <div className="hv-beat hv-card-enter">
                    <PipelineCard
                      title="Elm Street Walkthrough"
                      client="Sam Okonkwo"
                      address="220 Elm Street"
                      moving
                    />
                  </div>
                </PipelineColumn>
                <PipelineColumn label="Awaiting Payment" count={1}>
                  <PipelineCard
                    title="Westfield Exterior"
                    client="Westfield Partners"
                    address="3400 Westfield Ave"
                  />
                </PipelineColumn>
              </div>
            </div>
          </div>
        </div>

        {/* Messages card — front-left */}
        <div className="hv-beat hv-float-a absolute -left-2 bottom-6 z-30 w-[15.5rem] overflow-hidden rounded-xl border border-[#E2E8F0]/80 bg-white shadow-[0_16px_40px_-16px_rgba(15,23,42,0.45)]">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] px-3 py-2">
            <p className="text-xs font-semibold text-[#0F172A]">Messages</p>
            <span className="hv-beat hv-badge flex h-5 min-w-5 items-center justify-center rounded-full bg-[#4F46E5] px-1.5 text-[10px] font-bold text-white">
              3
            </span>
          </div>
          <div className="space-y-0">
            <div className="flex gap-2 border-b border-[#E2E8F0] bg-[#EEF2FF]/60 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4F46E5]/15 text-[10px] font-semibold text-[#4F46E5]">
                MO
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-[#0F172A]">Maya Ortiz</p>
                <p className="truncate text-[10px] text-[#475569]">Saturday at 9:00 AM works…</p>
              </div>
            </div>
            <div className="flex gap-2 px-3 py-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-[#475569]">
                JB
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-[#0F172A]">Jordan Blake</p>
                <p className="truncate text-[10px] text-[#475569]">Twilight set files are ready</p>
              </div>
            </div>
          </div>
        </div>

        {/* Media thumbs — front-right */}
        <div className="hv-beat hv-float-b absolute -right-1 bottom-8 z-30 w-[14rem] rounded-xl border border-[#E2E8F0]/80 bg-white p-2.5 shadow-[0_16px_40px_-16px_rgba(15,23,42,0.45)]">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#475569]">
            Media · Riverbend
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {MEDIA_SWATCHES.map((bg, i) => (
              <div
                key={i}
                className="hv-beat hv-thumb aspect-[4/3] rounded-lg"
                style={{ background: bg }}
              />
            ))}
          </div>
        </div>

        {/* Payment toast — top-right */}
        <div className="hv-beat hv-toast absolute right-4 top-14 z-40 flex w-[16rem] items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 shadow-lg">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#16A34A]/15 text-xs font-bold text-[#16A34A]">
            $
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0F172A]">Payment received · $1,250</p>
            <p className="truncate text-[10px] text-[#475569]">Westfield Commercial Exterior</p>
          </div>
        </div>

        {/* Calendar chip — mid-left behind */}
        <div className="hv-beat hv-cal absolute left-36 top-[11.5rem] z-20 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 shadow-md">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-[#4F46E5]">Calendar</p>
          <p className="mt-0.5 text-xs font-semibold text-[#0F172A]">Sat · 9:00 AM</p>
          <p className="text-[10px] text-[#475569]">Riverbend Listing Package</p>
        </div>

        {/* Status story chip — mid-right */}
        <div className="absolute right-8 top-[10.5rem] z-20 h-8 w-[9.5rem]">
          <span className="hv-beat hv-status-a absolute inset-0 flex items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[11px] font-semibold text-[#475569] shadow-md">
            Estimate sent
          </span>
          <span className="hv-beat hv-status-b absolute inset-0 flex items-center justify-center rounded-lg border border-[#4F46E5]/30 bg-[#EEF2FF] text-[11px] font-semibold text-[#4F46E5] shadow-md">
            Estimate approved
          </span>
          <span className="hv-beat hv-status-c absolute inset-0 flex items-center justify-center rounded-lg border border-[#4F46E5]/30 bg-[#EEF2FF] text-[11px] font-semibold text-[#4F46E5] shadow-md">
            Shoot scheduled
          </span>
          <span className="hv-beat hv-status-d absolute inset-0 flex items-center justify-center rounded-lg border border-[#16A34A]/30 bg-[#F0FDF4] text-[11px] font-semibold text-[#15803D] shadow-md">
            Delivered
          </span>
        </div>

        {/* New request chip */}
        <div className="hv-beat hv-request absolute left-8 top-16 z-30 flex items-center gap-2 rounded-lg border border-[#4F46E5]/25 bg-white px-3 py-2 shadow-md">
          <span className="text-[10px] font-semibold text-[#4F46E5]">New request</span>
          <span className="text-[10px] text-[#475569]">214 Oak Street</span>
        </div>

        {/* Clients strip peek — bottom center behind */}
        <div className="absolute bottom-0 left-1/2 z-[5] w-[70%] -translate-x-1/2 translate-y-3 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 shadow-md">
          <div className="flex items-center gap-4 text-[10px]">
            <span className="font-semibold text-[#0F172A]">Clients</span>
            <span className="text-[#475569]">Maya Ortiz · 3 projects</span>
            <span className="hidden text-[#475569] sm:inline">Priya Nair · $4,800</span>
            <span className="ml-auto font-medium text-[#16A34A]">$0 due</span>
          </div>
        </div>
      </div>
    </div>
  );
}
