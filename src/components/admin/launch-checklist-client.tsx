"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LaunchCheckItem, LaunchChecklistResult } from "@/lib/launch-checklist";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw } from "lucide-react";
import { useState } from "react";

const STATUS_ICON = {
  ok: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
  unknown: HelpCircle,
} as const;

const STATUS_STYLE = {
  ok: "text-emerald-600 bg-emerald-50 border-emerald-200",
  warning: "text-amber-700 bg-amber-50 border-amber-200",
  error: "text-red-700 bg-red-50 border-red-200",
  unknown: "text-slate-600 bg-slate-50 border-slate-200",
} as const;

const CATEGORY_LABEL: Record<LaunchCheckItem["category"], string> = {
  core: "Core",
  integrations: "Integrations",
  storage: "Storage",
  pwa: "PWA & Mobile",
};

interface LaunchChecklistClientProps {
  initial: LaunchChecklistResult;
}

export function LaunchChecklistClient({ initial }: LaunchChecklistClientProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { items, readyCount, warningCount, errorCount, generatedAt } = initial;

  const grouped = items.reduce<Record<string, LaunchCheckItem[]>>((acc, check) => {
    if (!acc[check.category]) acc[check.category] = [];
    acc[check.category].push(check);
    return acc;
  }, {});

  async function refresh() {
    setRefreshing(true);
    router.refresh();
    window.setTimeout(() => setRefreshing(false), 800);
  }

  const launchReady = errorCount === 0;

  return (
    <div className="space-y-6">
      <div
        className={cn(
          "rounded-2xl border p-6",
          launchReady ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-primary">
              {launchReady ? "Core checks passed" : "Action required before launch"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {readyCount} ready · {warningCount} warnings · {errorCount} errors
            </p>
            <p className="mt-1 text-xs text-muted">
              Last checked {new Date(generatedAt).toLocaleString()}
            </p>
          </div>
          <Button variant="outline" onClick={refresh} disabled={refreshing} className="min-h-11 shrink-0">
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {(Object.keys(CATEGORY_LABEL) as LaunchCheckItem["category"][]).map((category) => {
        const checks = grouped[category];
        if (!checks?.length) return null;
        return (
          <section key={category}>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
              {CATEGORY_LABEL[category]}
            </h3>
            <div className="space-y-2">
              {checks.map((check) => {
                const Icon = STATUS_ICON[check.status];
                return (
                  <div
                    key={check.id}
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-4 py-3",
                      STATUS_STYLE[check.status]
                    )}
                  >
                    <Icon className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{check.label}</p>
                      <p className="mt-0.5 text-sm opacity-90">{check.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="rounded-xl border border-border bg-white p-5 text-sm text-muted space-y-2">
        <p className="font-medium text-primary">Manual smoke tests (recommended)</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Submit a public project request with structured address</li>
          <li>Send and approve a proposal end-to-end</li>
          <li>Propose and confirm a shoot date (Google Calendar if connected)</li>
          <li>Upload media, hide one asset, confirm client cannot preview it</li>
          <li>Create payment link → pay via Stripe → confirm downloads unlock</li>
          <li>Download all deliverables as ZIP on a delivered project</li>
          <li>Test on iPhone Safari and as a saved home-screen app</li>
        </ul>
      </div>
    </div>
  );
}
