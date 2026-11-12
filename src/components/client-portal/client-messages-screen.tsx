"use client";

import { useEffect, useState } from "react";
import { ClientMessagesChat } from "@/components/projects/client-messages-chat";
import { PHONE_QUERY, useMediaQuery } from "@/hooks/use-media-query";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { cn } from "@/lib/utils";

/**
 * Client "All Messages" page body.
 *
 * Desktop/tablet: the existing centered chat card.
 * Phones: a full-height conversation pinned between the site header and the bottom of the
 * *visible* viewport — the thread fills the middle and the composer sits on the bottom edge,
 * directly above the keyboard while typing (iOS Safari / Home Screen app pan instead of
 * resizing, so CSS viewport units alone can't do this).
 *
 * The chat stays at the same tree position in both modes, so switching never refetches.
 */
export function ClientMessagesScreen() {
  const isPhone = useMediaQuery(PHONE_QUERY);
  const viewport = useVisualViewport(isPhone);
  const [headerBottom, setHeaderBottom] = useState<number | null>(null);

  // Header height varies (installed-app status bar inset); track it in document coordinates.
  useEffect(() => {
    if (!isPhone) return;
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setHeaderBottom(header.offsetTop + header.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("orientationchange", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, [isPhone]);

  // The conversation is the whole screen on phones: the page behind it must not scroll.
  useEffect(() => {
    if (!isPhone) return;
    const html = document.documentElement;
    const prevBody = document.body.style.overflow;
    const prevHtml = html.style.overscrollBehaviorY;
    document.body.style.overflow = "hidden";
    html.style.overscrollBehaviorY = "none";
    return () => {
      document.body.style.overflow = prevBody;
      html.style.overscrollBehaviorY = prevHtml;
    };
  }, [isPhone]);

  let phoneBox: { top: number; height: number } | undefined;
  if (isPhone && viewport && headerBottom !== null) {
    // Visible band [viewport.top, viewport.top + height]; start below the header while it is
    // on screen, and at the visible top once the keyboard pans it away.
    const top = Math.max(viewport.top, headerBottom);
    phoneBox = { top, height: Math.max(0, viewport.top + viewport.height - top) };
  }

  return (
    <main
      className={cn(
        isPhone
          ? "fixed inset-x-0 bottom-0 z-40 top-[calc(var(--sat)+3.5rem)]"
          : "mobile-container py-8 pb-16"
      )}
      style={phoneBox ? { top: phoneBox.top, height: phoneBox.height, bottom: "auto" } : undefined}
    >
      <ClientMessagesChat layout={isPhone ? "fill" : "card"} />
    </main>
  );
}
