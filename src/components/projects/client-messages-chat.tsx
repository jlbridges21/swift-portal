"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ClientMessage } from "@/lib/types";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

interface ClientMessagesChatProps {
  /** Optional project context when composing from a project page */
  projectId?: string;
  className?: string;
  compact?: boolean;
}

export function ClientMessagesChat({ projectId, className, compact }: ClientMessagesChatProps) {
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/messages", { credentials: "include" });
      if (!res.ok) return;
      setMessages(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

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
    });
  }, [loading, messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

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
      setMessages((prev) => [...prev, data as ClientMessage]);
      toast.success("Message sent");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="messages" className={cn("scroll-mt-24", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-black/5",
          compact && "shadow-md"
        )}
      >
        <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
          <MessageSquare className="h-5 w-5 text-accent" />
          <div>
            <h2 className="text-base font-semibold text-primary">Messages</h2>
            <p className="text-xs text-muted">Chat with Swift Aerial Media</p>
          </div>
        </div>

        <div
          className={cn(
            "space-y-2 overflow-y-auto bg-[#F2F2F7] px-3 py-4",
            compact ? "max-h-[360px]" : "max-h-[520px] min-h-[280px]"
          )}
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
                        : "rounded-bl-md bg-white text-slate-900",
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
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-border/60 bg-white p-3">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="iMessage…"
            className="rounded-2xl bg-slate-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="accent"
              size="sm"
              className="min-h-10 rounded-full px-4"
              disabled={sending || !draft.trim()}
              onClick={() => void handleSend()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
