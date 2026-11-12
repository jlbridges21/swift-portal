"use client";

import { useEffect, useState } from "react";

export interface VisualViewportBox {
  /** Visible top edge, in layout-viewport px (non-zero while iOS pans for the keyboard). */
  top: number;
  /** Visible height — shrinks when the on-screen keyboard opens. */
  height: number;
  keyboardOpen: boolean;
}

/** Same threshold StandaloneAppBoot uses for <html data-keyboard="open">. */
const KEYBOARD_THRESHOLD = 140;

/**
 * Tracks `window.visualViewport` so a `position: fixed` layer can be pinned to exactly the visible
 * area. iOS Safari (browser and Home Screen app) keeps the layout viewport full height when the
 * keyboard opens and pans instead, which would leave a bottom-anchored composer under the
 * keyboard; Android resizes. Sizing the layer to `{ top, height }` handles both.
 *
 * Returns null until mounted (and when `enabled` is false), so callers fall back to CSS sizing.
 */
export function useVisualViewport(enabled = true): VisualViewportBox | null {
  const [box, setBox] = useState<VisualViewportBox | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const vv = window.visualViewport;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = vv ? vv.height : window.innerHeight;
        const top = vv ? Math.max(0, vv.offsetTop) : 0;
        const keyboardOpen = window.innerHeight - height > KEYBOARD_THRESHOLD;
        setBox((prev) =>
          prev && prev.top === top && prev.height === height && prev.keyboardOpen === keyboardOpen
            ? prev
            : { top, height, keyboardOpen }
        );
      });
    };
    measure();
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [enabled]);

  return enabled ? box : null;
}
