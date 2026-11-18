"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/lib/app-settings";

/**
 * Onboarding → Services: "Send a preliminary estimate automatically"
 * (Settings → Services → Preliminary estimates). Saves on toggle.
 */
export function PreliminaryEstimateToggle() {
  const [on, setOn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      const body = (await res.json().catch(() => ({}))) as { settings?: AppSettings };
      if (!cancelled && body.settings) setOn(body.settings.proposals.autoPreliminaryEstimate !== false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle(next: boolean) {
    const previous = on;
    setOn(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { proposals: { autoPreliminaryEstimate: next } } }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Couldn't save.");
    } catch (err) {
      setOn(previous);
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (on === null) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <FileText className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <label htmlFor="ob-prelim" className="min-w-0 flex-1 cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-semibold text-heading">
            Send a preliminary estimate automatically
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" aria-hidden /> : null}
          </span>
          <span className="block text-[13px] text-muted">
            When a client requests a shoot, they instantly see an estimate built from these prices and travel. You send the
            official proposal later.
          </span>
        </label>
        <Switch id="ob-prelim" checked={on} onCheckedChange={(v) => void toggle(v)} aria-label="Send a preliminary estimate automatically" />
      </div>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
