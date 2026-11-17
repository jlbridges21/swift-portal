"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, Loader2, Send } from "lucide-react";
import { cn } from "@/lib/utils";

/** "What's next?" — book a time now, or (optional mode) request without scheduling. */
export function NextStepChoices({
  scheduleHref,
  auth,
  allowSkip,
  requestedHref,
}: {
  scheduleHref: string;
  auth: { b?: string; projectId?: string };
  allowSkip: boolean;
  requestedHref: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function skip() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...auth, action: "skip" }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Something went wrong.");
      router.push(requestedHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  const card = "group flex items-center gap-4 rounded-2xl border p-5 text-left transition-all sm:p-6";
  return (
    <div>
      <div className={cn("grid gap-4", allowSkip && "md:grid-cols-2")}>
        <Link href={scheduleHref} className={cn(card, "border-accent bg-accent-subtle/60 ring-1 ring-accent hover:shadow-md")}>
          <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-card text-accent shadow-sm">
            <CalendarDays className="h-7 w-7" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold text-heading">Book a time now</span>
            <span className="mt-0.5 block text-sm text-muted">See available times and confirm your shoot instantly.</span>
          </span>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform group-hover:translate-x-0.5">
            <ArrowRight className="h-5 w-5" aria-hidden />
          </span>
        </Link>
        {allowSkip ? (
          <button type="button" onClick={skip} disabled={busy} className={cn(card, "border-border bg-card hover:bg-subtle")}>
            <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-subtle text-accent">
              <Send className="h-7 w-7" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold text-heading">Request without scheduling</span>
              <span className="mt-0.5 block text-sm text-muted">Send your request now and we&apos;ll follow up to confirm a time.</span>
            </span>
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-heading">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" aria-hidden />}
            </span>
          </button>
        ) : null}
      </div>
      {error ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
