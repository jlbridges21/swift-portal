"use client";

import { MessageSquare, PenSquare } from "lucide-react";
import { DEMO_MESSAGES } from "./demo-data";

/** Split inbox + thread mirroring AdminMessagesInbox layout. */
export function DemoMessagesPanel({
  phase,
}: {
  phase: "idle" | "admin" | "reply" | "read";
}) {
  const { clientName, clientEmail, thread } = DEMO_MESSAGES;
  const visible =
    phase === "idle"
      ? thread.slice(0, 1)
      : phase === "admin"
        ? thread.slice(0, 1)
        : phase === "reply"
          ? thread.slice(0, 2)
          : thread;

  return (
    <div className="flex h-full min-h-[320px] overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      {/* Conversation list */}
      <aside className="hidden w-[38%] shrink-0 flex-col border-r border-[#E2E8F0] sm:flex">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-3 py-2.5">
          <h3 className="text-sm font-semibold text-[#0F172A]">Messages</h3>
          <span className="flex h-8 w-8 items-center justify-center rounded-md text-[#4F46E5]">
            <PenSquare className="h-4 w-4" aria-hidden />
          </span>
        </div>
        <button
          type="button"
          tabIndex={-1}
          data-demo-target="message-row"
          className="flex w-full items-start gap-2 border-b border-[#E2E8F0] bg-[#EEF2FF]/50 px-3 py-3 text-left ring-2 ring-inset ring-[#4F46E5]/40"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4F46E5]/15 text-xs font-semibold text-[#4F46E5]">
            MO
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-[#0F172A]">{clientName}</span>
              <span className="shrink-0 text-[10px] text-[#94A3B8]">10:25</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-[#64748B]">
              Saturday at 9:00 AM works…
            </span>
          </span>
        </button>
        <div className="px-3 py-3 opacity-50">
          <p className="text-sm font-medium text-[#0F172A]">Jordan Blake</p>
          <p className="truncate text-xs text-[#64748B]">Twilight set files are ready</p>
        </div>
      </aside>

      {/* Thread */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[#E2E8F0] px-4 py-2.5">
          <p className="text-sm font-semibold text-[#0F172A]">{clientName}</p>
          <p className="text-xs text-[#64748B]">{clientEmail}</p>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-hidden bg-[#F8FAFC] px-4 py-4">
          {visible.map((msg) => {
            const isAdmin = msg.role === "admin";
            const highlight =
              (phase === "admin" && msg.id === "m1") ||
              (phase === "reply" && msg.id === "m2") ||
              (phase === "read" && msg.id === "m3");
            return (
              <div
                key={msg.id}
                data-demo-target={highlight ? "message-bubble" : undefined}
                className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
                    isAdmin
                      ? "bg-[#4F46E5] text-white"
                      : "border border-[#E2E8F0] bg-white text-[#0F172A]"
                  } ${highlight ? "ring-2 ring-offset-2 ring-[#4F46E5]/50" : ""}`}
                >
                  <p>{msg.body}</p>
                  <div
                    className={`mt-1.5 flex items-center justify-end gap-2 text-[10px] ${
                      isAdmin ? "text-white/70" : "text-[#94A3B8]"
                    }`}
                  >
                    <span>{msg.at}</span>
                    {isAdmin && "receipt" in msg && msg.receipt ? (
                      <span
                        className={
                          phase === "read" && msg.id === "m3"
                            ? "font-medium text-emerald-200"
                            : undefined
                        }
                      >
                        {phase === "read" && msg.id === "m3" ? "Read · just now" : msg.receipt}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {visible.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-[#94A3B8]">
              <MessageSquare className="mb-2 h-8 w-8" aria-hidden />
              <p className="text-sm">No messages yet</p>
            </div>
          ) : null}
        </div>
        <div className="border-t border-[#E2E8F0] bg-white px-3 py-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-xs text-[#94A3B8]">
            Message {clientName}…
          </div>
        </div>
      </div>
    </div>
  );
}
