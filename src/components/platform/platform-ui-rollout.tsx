"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RotateCcw, Sparkles, Undo2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import {
  ROLLOUT_STATUS_LABEL,
  effectivePhase,
  type RolloutConfig,
  type RolloutStatus,
} from "@/lib/ui-rollout";
import type { RolloutAnalytics, RolloutConfigState } from "@/lib/ui-rollout-server";

type ActionBody = { action: "activate" | "new_only" | "rollback" | "resume_optional" | "reset_classic" };

const PHASE_STYLE: Record<RolloutStatus, string> = {
  classic_only: "bg-slate-100 text-slate-700 ring-slate-200",
  optional: "bg-blue-50 text-blue-700 ring-blue-200",
  new_default: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  classic_rollback: "bg-amber-50 text-amber-800 ring-amber-200",
};

const PHASE_HELP: Record<RolloutStatus, string> = {
  classic_only:
    "Customers use Classic and see no announcement. Super-admins can preview New from the account menu while impersonating.",
  optional:
    "New is the default for every business user, including new sign-ups. Anyone can switch to Classic (and back) from the account menu; their choice is saved per user. No end date.",
  new_default:
    "Everyone uses New. The user-facing switch to Classic is hidden. Classic stays in the code for rollback.",
  classic_rollback: "Emergency rollback: everyone uses Classic, with no banners or switcher.",
};

const CONFIRM: Record<ActionBody["action"], { title: string; body: string; label: string; destructive?: boolean }> = {
  activate: {
    title: "Make New the default?",
    body: "Every business user moves to the New interface and can switch to Classic anytime from the account menu. There is no end date.",
    label: "Make New the default",
  },
  new_only: {
    title: "Switch everyone to New only?",
    body: "Classic preferences are overridden immediately and the user-facing switch to Classic disappears.",
    label: "Switch to New only",
  },
  rollback: {
    title: "Roll everyone back to Classic?",
    body: "All business users get the Classic interface on their next page load. Their saved preferences are kept for later.",
    label: "Roll back to Classic",
    destructive: true,
  },
  resume_optional: {
    title: "Make New the default with Classic available?",
    body: "Users get their saved choice again (New unless they picked Classic) and can switch from the account menu.",
    label: "Restore",
  },
  reset_classic: {
    title: "Reset to Classic Only?",
    body: "Customers see Classic with no banners until you make New the default again. Saved user choices are kept.",
    label: "Reset",
    destructive: true,
  },
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function PlatformUiRollout({
  initialConfig,
  analytics,
  nowIso,
}: {
  initialConfig: RolloutConfigState;
  analytics: RolloutAnalytics | null;
  nowIso: string;
}) {
  const router = useRouter();
  const [config, setConfig] = useState<RolloutConfig>(initialConfig);
  const [pending, setPending] = useState<ActionBody | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nowMs = Date.parse(nowIso);
  const phase = effectivePhase(config, new Date(nowMs));

  async function run(body: ActionBody) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/ui-rollout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not update the rollout.");
      setConfig({ status: data.config.status, activatedAt: data.config.activatedAt, transitionAt: data.config.transitionAt });
      setPending(null);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (initialConfig.setupRequired) {
    return (
      <Card>
        <CardContent className="flex gap-3 p-5 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
          <div>
            <p className="font-semibold text-heading">Setup required</p>
            <p className="mt-1 text-muted">
              Run <code className="rounded bg-subtle px-1">supabase/migration-v121-ui-rollout.sql</code> in the Supabase SQL
              editor. Until then every customer stays on Classic.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confirm = pending ? CONFIRM[pending.action] : null;
  const confirmBody = confirm?.body;

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <Card>
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Current status</p>
            <span className={cn("mt-1.5 inline-flex rounded-full px-3 py-1 text-sm font-semibold ring-1", PHASE_STYLE[phase])}>
              {ROLLOUT_STATUS_LABEL[phase]}
            </span>
            <p className="mt-2 max-w-xl text-sm text-muted">{PHASE_HELP[phase]}</p>
          </div>

          {config.activatedAt && phase !== "classic_only" ? (
            <div className="rounded-lg bg-subtle px-4 py-3 sm:max-w-sm">
              <p className="text-xs text-muted">New interface rolled out</p>
              <p className="mt-0.5 text-sm font-semibold text-heading" suppressHydrationWarning>
                {fmt(config.activatedAt)}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border pt-5">
            {phase === "classic_only" ? (
              <Button variant="accent" className="min-h-10" onClick={() => setPending({ action: "activate" })}>
                <Sparkles className="h-4 w-4" /> Make New the default
              </Button>
            ) : null}
            {phase === "optional" || phase === "classic_rollback" ? (
              <Button variant="accent" className="min-h-10" onClick={() => setPending({ action: "new_only" })}>
                Switch to New only
              </Button>
            ) : null}
            {phase === "classic_rollback" || phase === "new_default" ? (
              <Button variant="outline" className="min-h-10" onClick={() => setPending({ action: "resume_optional" })}>
                New default, Classic available
              </Button>
            ) : null}
            {phase === "optional" || phase === "new_default" ? (
              <Button variant="outline" className="min-h-10 text-red-700" onClick={() => setPending({ action: "rollback" })}>
                <Undo2 className="h-4 w-4" /> Roll back to Classic
              </Button>
            ) : null}
            {phase !== "classic_only" ? (
              <Button variant="ghost" className="min-h-10 text-muted" onClick={() => setPending({ action: "reset_classic" })}>
                <RotateCcw className="h-4 w-4" /> Reset to Classic Only
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="rollout-adoption">
        <h2 id="rollout-adoption" className="mb-3 text-lg font-semibold text-heading">
          Adoption
        </h2>
        {analytics ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Stat label="On New" value={analytics.preferNew} hint={`${analytics.explicitlyChoseNew} chose it explicitly`} />
              <Stat label="Chose Classic" value={analytics.preferClassic} />
              <Stat label="Tried New" value={analytics.triedNew} hint="Unique users" />
              <Stat label="Switched back" value={analytics.switchedBack} hint="Unique users" />
              <Stat
                label="Eligible users who tried New"
                value={analytics.triedNewPct === null ? "—" : `${analytics.triedNewPct}%`}
                hint={`${analytics.eligibleUsers} eligible`}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Eligible users are business owners/admins and active staff. Counts come from saved choices, not page views.
              New is the default, so anyone who hasn&apos;t picked Classic counts as on New.
            </p>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Adoption numbers are not available.
          </p>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => (busy ? undefined : setPending(null))}
        onConfirm={() => pending && void run(pending)}
        title={confirm?.title ?? ""}
        confirmLabel={busy ? "Saving…" : (confirm?.label ?? "Confirm")}
        destructive={confirm?.destructive}
        busy={busy}
      >
        <p className="text-sm text-muted">{confirmBody}</p>
        {busy ? <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted" aria-hidden /> : null}
      </ConfirmDialog>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-heading">{typeof value === "number" ? value.toLocaleString("en-US") : value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
