"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ClientMessage } from "@/lib/types";
import { ArrowUp, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { announceMessagesRead } from "@/lib/use-client-unread-messages";

interface ClientMessagesChatProps {
  /** Optional project context when composing from a project page */
  projectId?: string;
  /** Loads this client's thread. Admins otherwise receive the inbox list. */
  clientId?: string;
  className?: string;
  compact?: boolean;
  /**
   * "card" (default): self-contained card with a capped thread height.
   * "fill": edge-to-edge, fills its parent's height — thread scrolls in the middle and the
   * composer stays on the bottom edge (messages drawer, phone Messages page). The parent must
   * give it a definite height.
   */
  layout?: "card" | "fill";
  /** Hide the "Messages / Chat with …" header when the host already shows one. */
  showHeader?: boolean;
}

/** Within this distance of the bottom the thread counts as "at the latest message". */
const NEAR_BOTTOM_PX = 96;
/** Composer grows with its text up to this height, then scrolls. */
const COMPOSER_MAX_PX = 128;

export function ClientMessagesChat({
  projectId,
  clientId,
  className,
  compact,
  layout = "card",
  showHeader = true,
}: ClientMessagesChatProps) {
  const fill = layout === "fill";
  const brand = usePortalBrand();
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const markedRef = useRef(false);
  /** User is reading the latest messages (not scrolled up into history). */
  const nearBottomRef = useRef(true);
  /** First paint of a loaded thread jumps straight to the newest message. */
  const initialScrollDoneRef = useRef(false);
  /** Set after sending so the new bubble is brought into view even if scrolled up. */
  const scrollAfterSendRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (clientId) params.set("client_id", clientId);
      const qs = params.toString();
      const res = await fetch(`/api/messages${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(Array.isArray(data) ? data.filter((message) => message && typeof message.body === "string" && message.created_at) : []);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (loading || markedRef.current) return;
    if (!messages.some((m) => m.is_unread)) return;
    markedRef.current = true;
    void fetch("/api/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}),
    }).then(() => {
      setMessages((prev) => prev.map((m) => ({ ...m, is_unread: false })));
      announceMessagesRead();
    });
  }, [loading, messages]);

  // Scroll the thread itself, never the page: scrollIntoView walks every ancestor, including the
  // window, so the project page landed on Messages (just under Payments) on load.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || loading) return;
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      list.scrollTop = list.scrollHeight;
      nearBottomRef.current = true;
      return;
    }
    if (scrollAfterSendRef.current) {
      scrollAfterSendRef.current = false;
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      return;
    }
    // Incoming messages only follow the thread when the reader is already at the bottom.
    if (nearBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [messages.length, loading]);

  // The thread shrinks when the keyboard opens or the composer grows; keep the latest message
  // in view if the reader was there.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const pin = () => {
      if (nearBottomRef.current) list.scrollTop = list.scrollHeight;
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(pin);
    observer?.observe(list);
    // The keyboard reports through the visual viewport; pin again once layout has settled.
    const vv = window.visualViewport;
    const onViewport = () => requestAnimationFrame(pin);
    vv?.addEventListener("resize", onViewport);
    window.addEventListener("resize", onViewport);
    return () => {
      observer?.disconnect();
      vv?.removeEventListener("resize", onViewport);
      window.removeEventListener("resize", onViewport);
    };
    // Switching layout remounts the thread element; observe the new one.
  }, [fill]);

  function onListScroll() {
    const list = listRef.current;
    if (!list) return;
    nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
  }

  function resizeComposer() {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    const next = Math.min(input.scrollHeight, COMPOSER_MAX_PX);
    input.style.height = `${next}px`;
    input.style.overflowY = input.scrollHeight > COMPOSER_MAX_PX ? "auto" : "hidden";
  }

  useLayoutEffect(() => {
    resizeComposer();
  }, [draft]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: text, project_id: projectId ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to send");
        return;
      }
      setDraft("");
      scrollAfterSendRef.current = true;
      setMessages((prev) => [...prev, data as ClientMessage]);
      toast.success("Message sent");
    } finally {
      setSending(false);
    }
  }

  const header = showHeader ? (
    <div
      className={cn(
        "flex shrink-0 items-center gap-2 border-b border-border/60 bg-gradient-to-r from-slate-50 to-white surface-dark:from-background surface-dark:to-background px-4 py-3"
      )}
    >
      <MessageSquare className="h-5 w-5 text-accent" />
      <div>
        <h2 className="text-base font-semibold text-heading">Messages</h2>
        <p className="text-xs text-muted">Chat with {brand.name}</p>
      </div>
    </div>
  ) : null;

  const thread = (
    <div
      ref={listRef}
      onScroll={onListScroll}
      className={cn(
        "space-y-2 overflow-y-auto overscroll-contain bg-[#F2F2F7] surface-dark:bg-subtle px-3 py-4",
        fill ? "min-h-0 flex-1" : compact ? "max-h-[360px]" : "max-h-[520px] min-h-[280px]"
      )}
      role="log"
      aria-live="polite"
      aria-label="Message history"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : messages.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">
          No messages yet. Say hello — we typically reply within one business day.
        </p>
      ) : (
        messages.map((message) => {
          const mine = message.sender_role === "client";
          return (
            <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-[18px] px-3.5 py-2 text-[15px] leading-snug shadow-sm",
                  mine
                    ? "rounded-br-md bg-[#0A84FF] text-white"
                    : "rounded-bl-md bg-white text-slate-900 surface-dark:bg-card surface-dark:text-heading",
                  message.is_unread && !mine && "ring-2 ring-accent/30"
                )}
              >
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    mine ? "text-white/70 text-right" : "text-muted"
                  )}
                >
                  {formatRelativeTime(message.created_at)}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const canSend = !sending && Boolean(draft.trim());
  const composer = (
    <form
      className={cn(
        "flex shrink-0 items-end gap-2 border-t border-border/60 bg-white surface-dark:bg-card px-3 pt-2",
        fill ? "sp-chat-composer" : "pb-2"
      )}
      onSubmit={(e) => {
        e.preventDefault();
        void handleSend();
      }}
    >
      <label className="sr-only" htmlFor={`client-chat-input-${projectId ?? clientId ?? "all"}`}>
        Message
      </label>
      <textarea
        ref={inputRef}
        id={`client-chat-input-${projectId ?? clientId ?? "all"}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={1}
        placeholder="iMessage…"
        enterKeyHint="send"
        // 16px on phones so iOS doesn't zoom the page when the field is focused.
        className="block min-h-10 min-w-0 flex-1 resize-none overflow-hidden rounded-[20px] border border-border bg-slate-50 surface-dark:bg-subtle px-4 py-[9px] text-base leading-5 text-heading placeholder:text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:text-[15px]"
        style={{ maxHeight: COMPOSER_MAX_PX }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void handleSend();
          }
        }}
      />
      <button
        type="submit"
        aria-label="Send message"
        disabled={!canSend}
        // Keep focus (and the phone keyboard) in the field when tapping Send.
        onPointerDown={(e) => e.preventDefault()}
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition-[opacity,transform,background-color]",
          "hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-95",
          "disabled:pointer-events-none disabled:opacity-40"
        )}
      >
        {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />}
      </button>
    </form>
  );

  if (fill) {
    return (
      <section
        id="messages"
        className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-white surface-dark:bg-card", className)}
      >
        {header}
        {thread}
        {composer}
      </section>
    );
  }

  return (
    <section id="messages" className={cn("scroll-mt-24", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl bg-white surface-dark:bg-card shadow-lg shadow-slate-200/50 ring-1 ring-black/5",
          compact && "shadow-md"
        )}
      >
        {header}
        {thread}
        {composer}
      </div>
    </section>
  );
}
