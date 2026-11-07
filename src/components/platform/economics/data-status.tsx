"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Notice } from "@/components/platform/analytics/ui";

/** Freshness line + "Re-measure storage" button + migration / metering notices. */
export function DataStatus({
  migrated,
  source,
  computedAt,
  trackingStartedAt,
  meteredDays,
  windowDays,
}: {
  migrated: boolean;
  source: "storage_objects" | "media_assets";
  computedAt: string;
  trackingStartedAt: string | null;
  meteredDays: number;
  windowDays: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/economics/snapshot", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Refresh failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <div className="mb-6 space-y-3">
      {!migrated ? (
        <Notice tone="warn">
          Apply <code className="text-xs">supabase/migration-v112-platform-economics.sql</code> to enable exact storage
          measurement (all buckets, thumbnails and derivatives), daily history, download metering, saved scenarios and recorded
          invoices. Until then, storage is the sum of original file sizes on media records and costs use default list prices.
        </Notice>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <p>
          Storage {source === "storage_objects" ? "measured from Supabase Storage" : "summed from media records (fallback)"} ·{" "}
          {fmt(computedAt)}
          {" · "}
          Downloads: last {windowDays} days
          {trackingStartedAt
            ? meteredDays >= windowDays - 0.01
              ? " metered"
              : ` — metered since ${fmt(trackingStartedAt)}, earlier days estimated from the download log`
            : " estimated from the download log"}
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 font-medium text-heading hover:bg-subtle disabled:opacity-60"
        >
          <RefreshCw className={busy ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
          {busy ? "Measuring…" : "Re-measure storage"}
        </button>
      </div>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
