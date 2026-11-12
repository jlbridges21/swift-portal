"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/** Fired by the chat after it marks a thread read, so unread badges refresh right away. */
export const MESSAGES_READ_EVENT = "shootportal:messages-read";

export function announceMessagesRead() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
}

const POLL_MS = 60_000; // same cadence as the notification bell

/**
 * Logged-in client's unread message count (GET /api/messages?unread_count=1).
 * Refreshes on navigation (like the business shell's Messages badge), every minute
 * (like the bell), when the tab/app comes back to the foreground, and after a chat marks
 * messages read. Pass `enabled: false` for business previews of the client view.
 */
export function useClientUnreadMessages(enabled = true): number {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/messages?unread_count=1", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { count?: unknown };
      setCount(Number(data.count) || 0);
    } catch {
      /* ignore — badge keeps its last value */
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh, pathname]);

  useEffect(() => {
    if (!enabled) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const onRead = () => void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(MESSAGES_READ_EVENT, onRead);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(MESSAGES_READ_EVENT, onRead);
    };
  }, [enabled, refresh]);

  return enabled ? count : 0;
}
