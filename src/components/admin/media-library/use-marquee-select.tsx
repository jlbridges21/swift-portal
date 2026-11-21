"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Finder-style rubber-band selection (desktop mouse only; touch keeps scrolling).
 *
 * Press on empty space inside the zone and drag: a rectangle follows the pointer and every
 * item it touches is selected. Holding ⇧ / ⌘ / Ctrl adds to the existing selection. Near the top
 * or bottom of the scroll area the page auto-scrolls (faster the closer you get, fastest past
 * the edge), and the rectangle keeps growing with it, so infinite-scroll pages load and join in.
 * Esc cancels and puts the previous selection back. A plain click on empty space clears.
 *
 * Items are any element under the zone with `data-marquee-key`. Presses that start on an item, a
 * control, or anything marked `data-no-marquee` are left alone (cards keep their own click and
 * drag-to-folder behavior).
 */

const START_DISTANCE = 4;
const EDGE = 56;
const MAX_SPEED = 28;
const IGNORE = "button, a, input, textarea, select, label, summary, [role='menu'], [role='dialog'], [contenteditable='true'], [data-no-marquee]";

type Scroller = HTMLElement | null; // null = the window

function scrollParent(el: HTMLElement): Scroller {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

/** The scroll area's visible box in viewport coordinates. */
function viewportOf(s: Scroller) {
  if (!s) return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
  const r = s.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
}

function scrollOf(s: Scroller) {
  return s ? { x: s.scrollLeft, y: s.scrollTop } : { x: window.scrollX, y: window.scrollY };
}

export function useMarqueeSelect({
  zoneRef,
  enabled,
  onBegin,
  onChange,
  onCancel,
  onClickEmpty,
}: {
  zoneRef: React.RefObject<HTMLElement | null>;
  enabled: boolean;
  /** A rectangle started; `additive` when ⇧/⌘/Ctrl was held (remember the current selection). */
  onBegin: (additive: boolean) => void;
  /** Keys under the rectangle (called only when they change). */
  onChange: (keys: string[], additive: boolean) => void;
  /** Esc pressed mid-drag: put the selection back as it was. */
  onCancel: () => void;
  /** Plain click (no drag, no modifier) on empty space. */
  onClickEmpty: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ onBegin, onChange, onCancel, onClickEmpty });
  useEffect(() => {
    cb.current = { onBegin, onChange, onCancel, onClickEmpty };
  });

  const onMouseDown = useCallback(
    (e: MouseEvent) => {
      const zone = zoneRef.current;
      if (!enabled || !zone || e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (!target || !zone.contains(target)) return;
      if (target.closest("[data-marquee-key]") || target.closest(IGNORE)) return;

      const scroller = scrollParent(zone);
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      // Anchor in scroll-content coordinates, so it stays put while the page scrolls.
      const s0 = scrollOf(scroller);
      const anchor = { x: e.clientX + s0.x, y: e.clientY + s0.y };
      let pointer = { x: e.clientX, y: e.clientY };
      let active = false;
      let lastKey = "";
      let raf = 0;
      const prevUserSelect = document.body.style.userSelect;

      const paint = () => {
        const s = scrollOf(scroller);
        const cur = { x: pointer.x + s.x, y: pointer.y + s.y };
        const rect = {
          left: Math.min(anchor.x, cur.x),
          top: Math.min(anchor.y, cur.y),
          right: Math.max(anchor.x, cur.x),
          bottom: Math.max(anchor.y, cur.y),
        };
        // Draw it in viewport coordinates, clipped to the scroll area.
        const vp = viewportOf(scroller);
        const box = boxRef.current;
        if (box) {
          const l = Math.max(vp.left, rect.left - s.x);
          const t = Math.max(vp.top, rect.top - s.y);
          const r = Math.min(vp.right, rect.right - s.x);
          const b = Math.min(vp.bottom, rect.bottom - s.y);
          box.style.display = r > l && b > t ? "block" : "none";
          box.style.transform = `translate(${l}px, ${t}px)`;
          box.style.width = `${Math.max(0, r - l)}px`;
          box.style.height = `${Math.max(0, b - t)}px`;
        }
        const hits: string[] = [];
        zone.querySelectorAll<HTMLElement>("[data-marquee-key]").forEach((el) => {
          const r = el.getBoundingClientRect();
          const left = r.left + s.x;
          const top = r.top + s.y;
          if (left <= rect.right && left + r.width >= rect.left && top <= rect.bottom && top + r.height >= rect.top) {
            hits.push(el.dataset.marqueeKey as string);
          }
        });
        const key = hits.join("|");
        if (key !== lastKey) {
          lastKey = key;
          cb.current.onChange(hits, additive);
        }
      };

      const tick = () => {
        raf = 0;
        if (!active) return;
        // Auto-scroll near (or past) the top / bottom edge of the scroll area.
        const vp = viewportOf(scroller);
        let dy = 0;
        if (pointer.y > vp.bottom - EDGE) dy = Math.min(1, (pointer.y - (vp.bottom - EDGE)) / EDGE);
        else if (pointer.y < vp.top + EDGE) dy = -Math.min(1, (vp.top + EDGE - pointer.y) / EDGE);
        if (dy) {
          const step = Math.round(dy * dy * Math.sign(dy) * MAX_SPEED) || Math.sign(dy);
          if (scroller) scroller.scrollTop += step;
          else window.scrollBy(0, step);
        }
        paint();
        if (dy) raf = requestAnimationFrame(tick);
      };
      const schedule = () => {
        if (!raf) raf = requestAnimationFrame(tick);
      };

      const onMove = (ev: MouseEvent) => {
        pointer = { x: ev.clientX, y: ev.clientY };
        if (!active) {
          if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < START_DISTANCE) return;
          active = true;
          document.body.style.userSelect = "none";
          window.getSelection()?.removeAllRanges();
          cb.current.onBegin(additive);
        }
        ev.preventDefault();
        schedule();
      };
      const onScroll = () => {
        if (active) schedule();
      };
      const finish = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("keydown", onKey, true);
        (scroller ?? window).removeEventListener("scroll", onScroll);
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        if (boxRef.current) boxRef.current.style.display = "none";
        document.body.style.userSelect = prevUserSelect;
      };
      const onUp = () => {
        const wasActive = active;
        active = false;
        finish();
        if (!wasActive && !additive) cb.current.onClickEmpty();
      };
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape" || !active) return;
        ev.preventDefault();
        ev.stopPropagation();
        active = false;
        finish();
        cb.current.onCancel();
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("keydown", onKey, true);
      (scroller ?? window).addEventListener("scroll", onScroll, { passive: true });
    },
    [enabled, zoneRef]
  );

  useEffect(() => {
    if (!enabled) return;
    // Mouse events only: touch and pen keep their native scrolling and taps.
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [enabled, onMouseDown]);

  return (
    <div
      ref={boxRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[45] rounded-[3px] border border-accent bg-accent/15"
      style={{ display: "none" }}
    />
  );
}
