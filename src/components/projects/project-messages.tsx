"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { ProjectMessage } from "@/lib/types";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { usePortalBrand } from "@/components/brand/brand-provider";

interface ProjectMessagesProps {
  projectId: string;
  isAdmin: boolean;
  /** When true, hide interactive controls (admin client-preview). */
  previewMode?: boolean;
  className?: string;
}

export function ProjectMessages({
  projectId,
  isAdmin,
  previewMode = false,
  className,
}: ProjectMessagesProps) {
  const brand = usePortalBrand();
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const markedRef = useRef(false);
  const didInitialRenderRef = useRef(false);

  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status !== 404) {
          console.error("[messages] load failed", res.status);
        }
        return;
      }
      const data = (await res.json()) as ProjectMessage[];
      setMessages(data);
      setUnreadCount(data.filter((m) => m.is_unread).length);
    } catch (err) {
      console.error("[messages] load error", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (loading || markedRef.current || previewMode) return;
    if (!messages.some((m) => m.is_unread)) return;
    markedRef.current = true;
    void fetch(`/api/projects/${projectId}/messages`, {
      method: "PATCH",
      credentials: "include",
    }).then(() => {
      setMessages((prev) => prev.map((m) => ({ ...m, is_unread: false })));
      setUnreadCount(0);
    });
  }, [loading, messages, previewMode, projectId]);

  useEffect(() => {
    // Skip the initial load: messages.length goes 0 -> N when the thread first
    // renders, and scrolling then hijacks the top of the project page.
    if (!didInitialRenderRef.current) {
      didInitialRenderRef.current = true;
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending || previewMode) return;
    setSending(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((data as { error?: string }).error || "Failed to send message");
        return;
      }
      setDraft("");
      setMessages((prev) => [...prev, data as ProjectMessage]);
      toast.success(isAdmin ? "Message sent to client" : "Message sent");
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  return (
    <section id="messages" className={cn("scroll-mt-24", className)}>
      <Card className="border-0 shadow-lg shadow-slate-200/50 rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 bg-gradient-to-r from-slate-50 to-white">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 text-accent" />
            Messages
            {unreadCount > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                {unreadCount}
              </span>
            )}
          </CardTitle>
          <p className="text-xs text-muted">
            {isAdmin ? "Client conversation" : `Message ${brand.name}`}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation…
              </div>
            ) : messages.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">
                No messages yet. {previewMode ? "" : "Send a message to start the conversation."}
              </p>
            ) : (
              messages.map((message) => {
                const mine =
                  (isAdmin && message.sender_role === "admin") ||
                  (!isAdmin && message.sender_role === "client");
                return (
                  <div
                    key={message.id}
                    className={cn("flex", mine ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                        mine
                          ? "rounded-br-md bg-accent text-accent-foreground"
                          : "rounded-bl-md bg-slate-100 text-slate-900",
                        message.is_unread && !mine && "ring-2 ring-accent/40"
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[11px] opacity-80">
                        <span className="font-medium">
                          {mine
                            ? "You"
                            : message.sender_role === "admin"
                              ? brand.name
                              : message.sender_name || "Client"}
                        </span>
                        <span>{formatRelativeTime(message.created_at)}</span>
                      </div>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.body}</p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {!previewMode && (
            <div className="border-t border-border/60 bg-slate-50/80 p-4 sm:p-5">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder={
                  isAdmin
                    ? "Write a reply to the client…"
                    : "Ask a question or leave a note for the team…"
                }
                className="bg-white"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[11px] text-muted">Press ⌘/Ctrl + Enter to send</p>
                <Button
                  variant="accent"
                  size="sm"
                  className="min-h-10"
                  disabled={sending || !draft.trim()}
                  onClick={() => void handleSend()}
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
