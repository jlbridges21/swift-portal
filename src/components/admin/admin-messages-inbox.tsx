"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ConversationListItem, CrmTimelineItem } from "@/lib/messaging-types";
import { ArrowLeft, Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

function formatTimelineStamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminMessagesInbox() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("client");

  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [timeline, setTimeline] = useState<CrmTimelineItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => conversations.find((c) => c.client_id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { credentials: "include" });
      if (!res.ok) return;
      setConversations(await res.json());
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (conversations.some((c) => c.client_id === selectedId)) return;
    void (async () => {
      const res = await fetch(`/api/messages?client_id=${selectedId}&stub=1`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const stub = (await res.json()) as ConversationListItem;
      setConversations((prev) => {
        if (prev.some((c) => c.client_id === stub.client_id)) return prev;
        return [stub, ...prev];
      });
    })();
  }, [selectedId, conversations]);

  const loadTimeline = useCallback(async (clientId: string) => {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/messages?client_id=${clientId}&timeline=1`, {
        credentials: "include",
      });
      if (!res.ok) return;
      setTimeline(await res.json());
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ client_id: clientId }),
      });
      setConversations((prev) =>
        prev.map((c) => (c.client_id === clientId ? { ...c, unread_count: 0 } : c))
      );
    } finally {
      setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId) void loadTimeline(selectedId);
    else setTimeline([]);
  }, [selectedId, loadTimeline]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [timeline.length]);

  function selectClient(clientId: string) {
    router.push(`/admin/messages?client=${clientId}`);
  }

  function clearSelection() {
    router.push("/admin/messages");
  }

  async function handleSend() {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ client_id: selectedId, body: draft.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to send");
        return;
      }
      setDraft("");
      toast.success("Message sent");
      await loadTimeline(selectedId);
      await loadConversations();
    } finally {
      setSending(false);
    }
  }

  const showListOnMobile = !selectedId;
  const showThreadOnMobile = !!selectedId;

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[480px] overflow-hidden rounded-2xl border border-border bg-white shadow-sm lg:h-[calc(100dvh-7rem)]">
      {/* Conversation list */}
      <aside
        className={cn(
          "w-full shrink-0 border-r border-border lg:w-80 xl:w-96",
          showListOnMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col"
        )}
      >
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-lg font-semibold text-primary">Messages</h1>
          <p className="text-xs text-muted">Client conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingList ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted">
              No conversations yet. Message a client from their profile or here once they write in.
            </p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.client_id}
                type="button"
                onClick={() => selectClient(c.client_id)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/60 px-4 py-3 text-left transition hover:bg-slate-50",
                  selectedId === c.client_id && "bg-accent/5"
                )}
              >
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-primary">
                  {c.client_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-primary">{c.client_name}</p>
                    <span className="shrink-0 text-[11px] text-muted">
                      {formatRelativeTime(c.last_message_at)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted">{c.client_email}</p>
                  <p className="mt-0.5 truncate text-sm text-slate-600">{c.last_message}</p>
                </div>
                {c.unread_count > 0 && (
                  <span className="mt-1 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                    {c.unread_count}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Timeline / thread */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          showThreadOnMobile ? "flex" : "hidden lg:flex"
        )}
      >
        {!selectedId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted">
            <MessageSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm">Select a client conversation</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
              <Button
                variant="ghost"
                size="sm"
                className="min-h-10 lg:hidden"
                onClick={clearSelection}
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-primary">
                  {selected?.client_name ?? "Client"}
                </p>
                <p className="truncate text-xs text-muted">{selected?.client_email}</p>
              </div>
              {selectedId && (
                <Link
                  href={`/admin/clients/${selectedId}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Profile
                </Link>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto bg-[#F2F4F7] px-3 py-4 sm:px-5">
              {loadingThread ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading timeline…
                </div>
              ) : timeline.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted">
                  No messages yet. Send the first message below.
                </p>
              ) : (
                timeline.map((item) => (
                  <TimelineRow key={item.id} item={item} />
                ))
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-border bg-white p-3 sm:p-4">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="Write a message to this client…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-muted">⌘/Ctrl + Enter to send</p>
                <Button
                  variant="accent"
                  size="sm"
                  className="min-h-10"
                  disabled={sending || !draft.trim()}
                  onClick={() => void handleSend()}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Send
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function TimelineRow({ item }: { item: CrmTimelineItem }) {
  if (item.kind === "message") {
    const mine = item.sender_role === "admin";
    return (
      <div className={cn("flex py-1", mine ? "justify-end" : "justify-start")}>
        <div
          className={cn(
            "max-w-[min(92%,28rem)] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm",
            mine
              ? "rounded-[20px] rounded-br-md bg-accent text-accent-foreground"
              : "rounded-[20px] rounded-bl-md bg-white text-slate-900 ring-1 ring-black/[0.06]",
            item.is_unread && !mine && "ring-2 ring-accent/35"
          )}
        >
          <div
            className={cn(
              "mb-1 flex items-center gap-2 text-[11px] font-medium",
              mine ? "text-white/75" : "text-slate-500"
            )}
          >
            <span>{mine ? "You" : "Client"}</span>
            <span className={mine ? "text-white/55" : "text-slate-400"}>
              {formatRelativeTime(item.created_at)}
            </span>
          </div>
          <p className="whitespace-pre-wrap break-words">{item.body}</p>
          {item.project_name && (
            <p className={cn("mt-1.5 text-[11px]", mine ? "text-white/60" : "text-slate-400")}>
              Re: {item.project_name}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center py-1.5">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 px-2 text-center text-[12px] leading-snug text-slate-500">
        <span className="shrink-0 text-[13px] leading-none" aria-hidden>
          {item.icon || "•"}
        </span>
        <span className="font-medium text-slate-600">{item.title}</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-400">{formatTimelineStamp(item.created_at)}</span>
        {item.project_name && (
          <>
            <span className="text-slate-300">·</span>
            <span className="truncate text-slate-400">{item.project_name}</span>
          </>
        )}
      </div>
    </div>
  );
}
