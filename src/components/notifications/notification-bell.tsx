"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsStandalonePwaMobile } from "@/lib/use-is-standalone-pwa-mobile";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  project_id: string | null;
  read_at: string | null;
  created_at: string;
}

const PWA_NAV_HEIGHT = 72;

export function NotificationBell() {
  const router = useRouter();
  const isPwaMobile = useIsStandalonePwaMobile();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [useFixedPanel, setUseFixedPanel] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  async function fetchNotifications() {
    setLoading(true);
    const res = await fetch("/api/notifications", { credentials: "include" });
    if (res.ok) {
      setNotifications(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    function positionPanel() {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      setUseFixedPanel(mobile);

      if (!mobile) {
        setPanelStyle({});
        return;
      }

      const rect = buttonRef.current?.getBoundingClientRect();
      const top = (rect?.bottom ?? 56) + 8;
      const sidePad = 16;
      const bottomReserve = (isPwaMobile ? PWA_NAV_HEIGHT : 0) + sidePad;
      const maxHeight = Math.max(160, window.innerHeight - top - bottomReserve);

      setPanelStyle({
        position: "fixed",
        top,
        right: sidePad,
        left: sidePad,
        width: "auto",
        maxWidth: 384,
        marginLeft: "auto",
        maxHeight,
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
      });
    }

    positionPanel();
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
    return () => {
      window.removeEventListener("resize", positionPanel);
      window.removeEventListener("scroll", positionPanel, true);
    };
  }, [open, isPwaMobile]);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
  }

  function handleNotificationClick(n: NotificationItem) {
    markRead(n.id);
    setOpen(false);
    if (n.link) {
      if (n.link.includes("#")) {
        window.location.href = n.link;
      } else {
        router.push(n.link);
      }
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0 min-h-11 min-w-11"
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          className={cn(
            "rounded-xl border border-border bg-white shadow-lg",
            !useFixedPanel && "absolute right-0 top-full z-50 mt-2 w-80 sm:w-96"
          )}
          style={useFixedPanel ? panelStyle : undefined}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <p className="font-semibold text-sm text-primary">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-accent hover:underline min-h-11 px-2"
              >
                Mark all read
              </button>
            )}
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
            style={
              useFixedPanel
                ? undefined
                : { maxHeight: "min(20rem, calc(100dvh - 8rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)))" }
            }
          >
            {loading && notifications.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted text-center py-8">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={`notif-${n.id}`}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-slate-50 transition-colors",
                    !n.read_at && "bg-sky-50/50"
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  {n.body && <p className="text-xs text-muted mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-muted mt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
