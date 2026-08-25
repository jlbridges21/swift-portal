"use client";

/**
 * Slow auto-scrolling workflow ribbon with seamless loop.
 * Pauses on hover, touch, and drag. Manual swipe/drag always available.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { HOMEPAGE_WORKFLOW_STEPS } from "@/components/marketing/workflow-steps";
import { usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

const SPEED_PX_PER_SEC = 28;
const RESUME_DELAY_MS = 2200;

export function HomepageWorkflowMarquee() {
  const reduced = usePrefersReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragScrollLeftRef = useRef(0);
  const [paused, setPaused] = useState(false);

  const pause = useCallback((temporary = true) => {
    pausedRef.current = true;
    setPaused(true);
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    if (temporary && !reduced) {
      resumeTimerRef.current = setTimeout(() => {
        if (!draggingRef.current) {
          pausedRef.current = false;
          setPaused(false);
        }
      }, RESUME_DELAY_MS);
    }
  }, [reduced]);

  const resumeNow = useCallback(() => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = null;
    }
    if (!draggingRef.current && !reduced) {
      pausedRef.current = false;
      setPaused(false);
    }
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const el = trackRef.current;
    if (!el) return;

    const tick = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = Math.min(48, ts - lastTsRef.current);
      lastTsRef.current = ts;

      if (!pausedRef.current) {
        const half = el.scrollWidth / 2;
        if (half > 0) {
          el.scrollLeft += (SPEED_PX_PER_SEC * dt) / 1000;
          if (el.scrollLeft >= half) {
            el.scrollLeft -= half;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [reduced]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el) return;
    draggingRef.current = true;
    pause(false);
    dragStartXRef.current = e.clientX;
    dragScrollLeftRef.current = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const el = trackRef.current;
    if (!el) return;
    const dx = e.clientX - dragStartXRef.current;
    el.scrollLeft = dragScrollLeftRef.current - dx;
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (el?.hasPointerCapture(e.pointerId)) {
      el.releasePointerCapture(e.pointerId);
    }
    draggingRef.current = false;
    pause(true);
  };

  const steps = [...HOMEPAGE_WORKFLOW_STEPS, ...HOMEPAGE_WORKFLOW_STEPS];

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        if (!reduced) pause(false);
      }}
      onMouseLeave={() => {
        if (!reduced && !draggingRef.current) resumeNow();
      }}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-white to-transparent sm:w-12"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-white to-transparent sm:w-12"
        aria-hidden
      />

      <div
        ref={trackRef}
        className={cn(
          "flex cursor-grab gap-3 overflow-x-auto pb-2 active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          paused ? "select-none" : ""
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={() => pause(false)}
        onTouchEnd={() => pause(true)}
        role="list"
        aria-label="Project workflow stages"
      >
        {steps.map((step, i) => {
          const originalIndex = i % HOMEPAGE_WORKFLOW_STEPS.length;
          return (
            <div
              key={`${step.key}-${i}`}
              role="listitem"
              className="relative flex w-[8.5rem] shrink-0 flex-col items-center rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-4 text-center sm:w-[9.5rem]"
            >
              {originalIndex < HOMEPAGE_WORKFLOW_STEPS.length - 1 ||
              i < steps.length - 1 ? (
                <span
                  className="pointer-events-none absolute -right-2 top-9 z-[1] hidden h-px w-4 bg-[#C7D2FE] sm:block"
                  aria-hidden
                />
              ) : null}
              <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-sm font-bold text-[#4F46E5] shadow-sm">
                {originalIndex + 1}
              </span>
              <h3 className="mt-2 text-sm font-semibold text-[#0F172A]">{step.title}</h3>
              <p className="mt-1 text-[11px] leading-snug text-[#475569]">{step.summary}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#E2E8F0]" aria-hidden>
        <div
          className={cn(
            "h-full w-1/3 rounded-full bg-[#4F46E5]/70",
            !reduced && !paused ? "home-workflow-progress" : ""
          )}
        />
      </div>

      <style>{`
        @keyframes home-workflow-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .home-workflow-progress {
          animation: home-workflow-progress 4.5s linear infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .home-workflow-progress { animation: none !important; width: 100%; }
        }
      `}</style>

      <p className="mt-3 text-center text-xs text-[#94A3B8]">
        {reduced
          ? "Swipe or drag to browse every stage."
          : "Swipe or drag to browse every stage."}
      </p>
    </div>
  );
}
