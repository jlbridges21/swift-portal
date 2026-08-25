"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import { DEMO_TABS, type DemoTabId } from "./demo-data";
import { DemoProjectsPanel } from "./demo-projects-panel";
import { DemoCalendarPanel } from "./demo-calendar-panel";
import { DemoMessagesPanel } from "./demo-messages-panel";
import { DemoMediaPanel } from "./demo-media-panel";
import { DemoClientsPanel } from "./demo-clients-panel";

const TAB_DWELL_MS = 9000;
const PHASE_MS = 2200;

type CalendarPhase = "idle" | "proposed" | "counter" | "confirmed";
type MessagesPhase = "idle" | "admin" | "reply" | "read";
type MediaPhase = "idle" | "select" | "lightbox";

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

function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine)");
    setFine(mq.matches);
    const onChange = () => setFine(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return fine;
}

function DemoCursor({
  x,
  y,
  clicking,
  visible,
}: {
  x: number;
  y: number;
  clicking: boolean;
  visible: boolean;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute z-30 hidden md:block"
      style={{
        left: 0,
        top: 0,
        opacity: visible ? 1 : 0,
        transform: `translate3d(${x}px, ${y}px, 0) scale(${clicking ? 0.88 : 1})`,
        transition: "opacity 200ms ease",
        willChange: "transform",
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        className="-translate-x-1 -translate-y-1 drop-shadow-md"
      >
        <path
          d="M5.5 3.5 18 12.2l-5.2 1.3 2.4 6.4-2.3.9-2.5-6.5-4.9 3.8V3.5Z"
          fill="#0F172A"
          stroke="#fff"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {clicking ? (
        <span className="absolute left-1 top-1 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#4F46E5]/35 opacity-80" />
      ) : null}
    </div>
  );
}

export function ProductDemo() {
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 48, y: 64 });
  const reducedMotion = usePrefersReducedMotion();
  const finePointer = useFinePointer();

  const [inView, setInView] = useState(false);
  const [manual, setManual] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [cursor, setCursor] = useState({ x: 48, y: 64, clicking: false, visible: false });

  const tab = DEMO_TABS[tabIndex]!;
  const tabId = tab.id as DemoTabId;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || manual || !inView) return;
    const id = window.setInterval(() => {
      setTabIndex((i) => (i + 1) % DEMO_TABS.length);
      setTick(0);
    }, TAB_DWELL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, manual, inView]);

  useEffect(() => {
    if (reducedMotion || !inView) return;
    const id = window.setInterval(() => setTick((t) => t + 1), PHASE_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, inView, tabId]);

  const calendarPhase: CalendarPhase = reducedMotion
    ? "confirmed"
    : ((["idle", "proposed", "counter", "confirmed"] as const)[tick % 4] ?? "idle");
  const messagesPhase: MessagesPhase = reducedMotion
    ? "read"
    : ((["idle", "admin", "reply", "read"] as const)[tick % 4] ?? "idle");
  const mediaPhase: MediaPhase = reducedMotion
    ? "select"
    : ((["idle", "select", "lightbox", "select"] as const)[tick % 4] ?? "idle");
  const projectHighlight = reducedMotion ? "p4" : tick % 2 === 0 ? "p1" : "p4";
  const clientHighlight = reducedMotion ? 1 : tick % 5;

  useEffect(() => {
    if (reducedMotion || !finePointer || !inView || !panelRef.current) {
      setCursor((c) => ({ ...c, visible: false }));
      return;
    }

    const panel = panelRef.current;
    let raf = 0;
    let cancelled = false;

    const aim = () => {
      if (cancelled) return;
      const target =
        panel.querySelector<HTMLElement>("[data-demo-target]") ??
        panel.querySelector<HTMLElement>("[data-demo-fallback]");
      if (!target) {
        raf = requestAnimationFrame(aim);
        return;
      }
      const pref = panel.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const destX = t.left - pref.left + Math.min(t.width * 0.55, t.width - 8);
      const destY = t.top - pref.top + Math.min(t.height * 0.4, t.height - 8);
      const next = {
        x: posRef.current.x + (destX - posRef.current.x) * 0.12,
        y: posRef.current.y + (destY - posRef.current.y) * 0.12,
      };
      posRef.current = next;
      setCursor((c) => ({ ...c, visible: true, x: next.x, y: next.y }));
      raf = requestAnimationFrame(aim);
    };

    raf = requestAnimationFrame(aim);

    const clickPulse = window.setInterval(() => {
      setCursor((c) => ({ ...c, clicking: true }));
      window.setTimeout(() => setCursor((c) => ({ ...c, clicking: false })), 160);
    }, PHASE_MS);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.clearInterval(clickPulse);
    };
  }, [
    reducedMotion,
    finePointer,
    inView,
    tabId,
    tick,
    calendarPhase,
    messagesPhase,
    mediaPhase,
    projectHighlight,
    clientHighlight,
  ]);

  const selectTab = useCallback((index: number) => {
    setTabIndex(index);
    setTick(0);
    setManual(true);
  }, []);

  const onTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = tabIndex;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      next = (tabIndex + 1) % DEMO_TABS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      next = (tabIndex - 1 + DEMO_TABS.length) % DEMO_TABS.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      next = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      next = DEMO_TABS.length - 1;
    } else {
      return;
    }
    selectTab(next);
    document.getElementById(`${baseId}-tab-${DEMO_TABS[next]!.id}`)?.focus();
  };

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current == null) return;
    const end = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = end - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 48) return;
    setManual(true);
    setTick(0);
    if (delta < 0) setTabIndex((i) => (i + 1) % DEMO_TABS.length);
    else setTabIndex((i) => (i - 1 + DEMO_TABS.length) % DEMO_TABS.length);
  };

  return (
    <section
      ref={rootRef}
      id="product-demo"
      className="scroll-mt-24"
      aria-labelledby={`${baseId}-heading`}
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">
          PRODUCT TOUR
        </p>
        <h2
          id={`${baseId}-heading`}
          className="mt-2 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl"
        >
          See how ShootPortal works.
        </h2>
        <p className="mt-3 text-base leading-relaxed text-[#475569]">
          Take a look around the platform and see how a project moves from a new request to a
          completed and paid job.
        </p>
      </div>

      <div className="mt-10">
        <div
          role="tablist"
          aria-label="Product demo sections"
          className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-center"
          onKeyDown={onTabKeyDown}
        >
          {DEMO_TABS.map((t, i) => {
            const selected = i === tabIndex;
            return (
              <button
                key={t.id}
                id={`${baseId}-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`${baseId}-panel-${t.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => selectTab(i)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 ${
                  selected
                    ? "bg-[#0F172A] text-white"
                    : "bg-[#F1F5F9] text-[#475569] hover:bg-[#E2E8F0]"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-center sm:mt-6">
          <h3 className="text-xl font-semibold text-[#0F172A]">{tab.headline}</h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-[#64748B]">{tab.blurb}</p>
          <p className="mt-2 text-xs font-medium text-[#4F46E5] md:hidden">
            Swipe the panel to browse. Animation runs without a cursor.
          </p>
        </div>

        <div
          ref={panelRef}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          data-demo-fallback
          className="relative mt-6 h-[420px] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] sm:h-[460px]"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            key={tabId}
            className="absolute inset-0 p-2 sm:p-3 demo-panel-enter"
          >
            {tabId === "projects" ? (
              <DemoProjectsPanel highlightId={projectHighlight} />
            ) : null}
            {tabId === "calendar" ? <DemoCalendarPanel phase={calendarPhase} /> : null}
            {tabId === "messages" ? <DemoMessagesPanel phase={messagesPhase} /> : null}
            {tabId === "media" ? <DemoMediaPanel phase={mediaPhase} /> : null}
            {tabId === "clients" ? (
              <DemoClientsPanel highlightIndex={clientHighlight} />
            ) : null}
          </div>

          <style>{`
            @keyframes demo-panel-enter {
              from { opacity: 0; transform: translate3d(0, 8px, 0); }
              to { opacity: 1; transform: translate3d(0, 0, 0); }
            }
            .demo-panel-enter {
              animation: demo-panel-enter 0.35s ease-out;
            }
            @media (prefers-reduced-motion: reduce) {
              .demo-panel-enter { animation: none !important; }
            }
          `}</style>

          {!reducedMotion && finePointer ? (
            <DemoCursor
              x={cursor.x}
              y={cursor.y}
              clicking={cursor.clicking}
              visible={cursor.visible && inView}
            />
          ) : null}
        </div>

        <div className="mt-4 flex justify-center gap-1.5" aria-hidden>
          {DEMO_TABS.map((t, i) => (
            <span
              key={t.id}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                i === tabIndex ? "w-6 bg-[#4F46E5]" : "w-1.5 bg-[#CBD5E1]"
              }`}
            />
          ))}
        </div>
        {manual ? (
          <p className="mt-2 text-center text-xs text-[#94A3B8]">
            Auto-advance paused. You are in control.
          </p>
        ) : null}
      </div>
    </section>
  );
}
