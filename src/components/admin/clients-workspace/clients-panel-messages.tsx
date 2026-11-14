"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowUp, ExternalLink, Loader2, RotateCw, X } from "lucide-react";
import { TimelineRow } from "@/components/admin/admin-messages-inbox";
import type { CrmTimelineItem } from "@/lib/messaging-types";
import type { ClientWorkspaceRow } from "@/lib/clients-workspace";
import { cn } from "@/lib/utils";
import { ClientAvatar } from "./clients-ui";

const NEAR_BOTTOM_PX = 96;
const COMPOSER_MAX_PX = 128;
/** While the thread is open, check for new client replies this often (and on window focus). */
const POLL_MS = 15000;

/**
 * Messages view inside the Clients page detail panel: the same thread and endpoints as the
 * Messages inbox (GET /api/messages?client_id&timeline=1, POST with client_id, PATCH to mark
 * read), with the client's name pinned at the top so it's always clear who you're messaging.
 */
export function ClientPanelMessages({
  client,
  canSend,
  onBack,
  onClose,
}: {
  client: ClientWorkspaceRow;
  canSend: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<CrmTimelineItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nearBottomRef = useRef(true);
  const firstScrollRef = useRef(true);
  const scrollAfterSendRef = useRef(false);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      try {
        const res = await fetch(`/api/messages?client_id=${encodeURIComponent(client.id)}&timeline=1`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as CrmTimelineItem[];
        const list = Array.isArray(data) ? data : [];
        setItems(list);
        setStatus("ready");
        // Opening the thread reads the client's messages (same as the inbox).
        if (list.some((i) => i.kind === "message" && i.is_unread)) {
          void fetch("/api/messages", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ client_id: client.id }),
          }).catch(() => null);
        }
      } catch {
        if (!opts?.quiet) setStatus("error");
      }
    },
    [client.id]
  );

  useEffect(() => {
    setStatus("loading");
    setItems([]);
    firstScrollRef.current = true;
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load({ quiet: true });
    }, POLL_MS);
    const onFocus = () => void load({ quiet: true });
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  // Focus the composer when the thread opens (desktop only — avoids popping the phone keyboard).
  useEffect(() => {
    if (canSend && window.matchMedia("(min-width: 768px)").matches) inputRef.current?.focus();
  }, [canSend, client.id]);

  // Scroll only the thread, never the page.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || status !== "ready") return;
    if (firstScrollRef.current) {
      firstScrollRef.current = false;
      list.scrollTop = list.scrollHeight;
      return;
    }
    if (scrollAfterSendRef.current) {
      scrollAfterSendRef.current = false;
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
      return;
    }
    if (nearBottomRef.current) list.scrollTop = list.scrollHeight;
  }, [items.length, status]);

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, COMPOSER_MAX_PX)}px`;
    input.style.overflowY = input.scrollHeight > COMPOSER_MAX_PX ? "auto" : "hidden";
  }, [draft]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ client_id: client.id, body: text }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(
          res.status === 403 ? "You don’t have permission to send messages." : data.error || "Message not sent — try again."
        );
        return;
      }
      setDraft("");
      scrollAfterSendRef.current = true;
      await load({ quiet: true });
    } catch {
      toast.error("Message not sent — check your connection.");
    } finally {
      setSending(false);
    }
  }

  const hasMessages = items.some((i) => i.kind === "message");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header — who you're messaging */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] xl:pt-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to client details"
          title="Back to client details"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-subtle hover:text-heading"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>
        <button
          type="button"
          onClick={onBack}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 py-1 text-left hover:bg-subtle/60"
          title="Client details"
        >
          <ClientAvatar name={client.name} email={client.email} size="sm" />
          <span className="min-w-0">
            <span id="client-panel-title" className="block truncate text-[15px] font-bold leading-tight text-heading">
              {client.name}
            </span>
            <span className="block truncate text-xs text-muted">
              {client.company ? `${client.company} · ` : ""}
              {client.email || "No email"}
            </span>
          </span>
        </button>
        <Link
          href={`/admin/messages?client=${encodeURIComponent(client.id)}`}
          aria-label="Open in Messages"
          title="Open in Messages"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-subtle hover:text-heading"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close client panel"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-subtle hover:text-heading"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Thread */}
      <div
        ref={listRef}
        onScroll={() => {
          const list = listRef.current;
          if (list) nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < NEAR_BOTTOM_PX;
        }}
        role="log"
        aria-live="polite"
        aria-label={`Messages with ${client.name}`}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain bg-[#F2F4F7] px-3 py-4 surface-dark:bg-subtle"
      >
        {status === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading messages…
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-sm">
            <p className="text-heading">Couldn’t load messages.</p>
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                void load();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold text-accent hover:bg-accent-subtle"
            >
              <RotateCw className="h-4 w-4" aria-hidden /> Try again
            </button>
          </div>
        ) : (
          <>
            {!hasMessages ? (
              <p className="px-4 py-10 text-center text-sm text-muted">
                No messages with {client.name.split(" ")[0]} yet.
                {canSend ? " Send the first one below." : ""}
              </p>
            ) : null}
            {items.map((item) => (
              <TimelineRow key={item.id} item={item} />
            ))}
          </>
        )}
      </div>

      {/* Composer */}
      {canSend ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="flex shrink-0 items-end gap-2 border-t border-border bg-card px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3"
        >
          <label htmlFor={`panel-msg-${client.id}`} className="sr-only">
            Message {client.name}
          </label>
          <textarea
            ref={inputRef}
            id={`panel-msg-${client.id}`}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${client.name.split(" ")[0]}…`}
            enterKeyHint="send"
            maxLength={5000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            style={{ maxHeight: COMPOSER_MAX_PX }}
            className="block min-h-10 min-w-0 flex-1 resize-none overflow-hidden rounded-[20px] border border-border bg-subtle/60 px-4 py-[9px] text-base leading-5 text-heading placeholder:text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 sm:text-[15px]"
          />
          <button
            type="submit"
            aria-label="Send message"
            disabled={sending || !draft.trim()}
            onPointerDown={(e) => e.preventDefault()}
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition-[opacity,transform]",
              "hover:opacity-90 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            )}
          >
            {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <ArrowUp className="h-5 w-5" strokeWidth={2.5} aria-hidden />}
          </button>
        </form>
      ) : (
        <p className="shrink-0 border-t border-border bg-card px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-center text-xs text-muted">
          You can read this conversation but don’t have permission to send messages.
        </p>
      )}
    </div>
  );
}
