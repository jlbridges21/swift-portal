"use client";

import { useId, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

export const GOOGLE_RATE_LIMIT_MESSAGE =
  "Google Calendar is rate limiting or unavailable. Shoots on this page are unchanged. Refresh later for the rest of your Google events.";

/** Small warning beside the calendar controls. The parent renders it only when Google's list is incomplete. */
export function GoogleRateLimitIndicator() {
  const tipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function place(nextOpen: boolean) {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 256;
    const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
    setPos({ top: rect.bottom + 6, left });
    setOpen(nextOpen);
  }

  return (
    <span className="inline-flex" data-gcal-degraded="true">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
        aria-label="Google Calendar warning"
        aria-describedby={open ? tipId : undefined}
        title={GOOGLE_RATE_LIMIT_MESSAGE}
        onMouseEnter={() => place(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => place(true)}
        onBlur={() => setOpen(false)}
        onClick={() => place(!open)}
      >
        <AlertTriangle className="h-4 w-4" aria-hidden />
      </button>
      {open && pos ? (
        <span
          id={tipId}
          role="tooltip"
          className="fixed z-[80] w-64 rounded-md bg-slate-900 px-2 py-1.5 text-left text-[11px] font-normal leading-snug text-white shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          {GOOGLE_RATE_LIMIT_MESSAGE}
        </span>
      ) : null}
    </span>
  );
}
