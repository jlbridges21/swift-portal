"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlatformBusinessRow } from "@/lib/platform-dashboard";
import {
  BULK_HARD_DELETE_MAX,
  BULK_LIFECYCLE_MAX,
  BULK_ROUTE_MAX_DURATION_SECONDS,
  evaluateBulkEligibility,
  formatBulkExclusionSummary,
  type BulkBusinessAction,
  type BulkBusinessSnapshot,
  type BulkItemResult,
} from "@/lib/platform-business-bulk.shared";
import { formatCurrency, formatDate } from "@/lib/utils";

type ConfirmState = {
  action: BulkBusinessAction;
  eligible: PlatformBusinessRow[];
  excluded: Array<{ row: PlatformBusinessRow; detail: string; reason: string }>;
};

function toSnapshot(row: PlatformBusinessRow): BulkBusinessSnapshot {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    deleted_at: row.deleted_at,
    created_at: row.created_at,
    is_protected: row.is_protected,
    hasCommissionHistory: row.hasCommissionHistory,
    clientCount: row.clientCount,
    projectCount: row.projectCount,
    mediaCount: row.mediaCount,
  };
}

function actionLabel(action: BulkBusinessAction): string {
  switch (action) {
    case "suspend":
      return "Suspend";
    case "restore":
      return "Restore";
    case "soft_delete":
      return "Soft-delete";
    case "hard_delete":
      return "Hard-delete";
  }
}

export function PlatformBusinessesTable({ businesses }: { businesses: PlatformBusinessRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [report, setReport] = useState<{
    results: BulkItemResult[];
    orphans: string[];
    exclusionSummary: string | null;
    succeeded: number;
    skipped: number;
    failed: number;
    action: BulkBusinessAction;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.slug.toLowerCase().includes(q) ||
        b.plan.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q)
    );
  }, [businesses, filter]);

  const selectedRows = useMemo(
    () => businesses.filter((b) => selected.has(b.id)),
    [businesses, selected]
  );

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((b) => selected.has(b.id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const b of filtered) next.delete(b.id);
      } else {
        for (const b of filtered) next.add(b.id);
      }
      return next;
    });
  }

  function beginAction(action: BulkBusinessAction) {
    setError(null);
    setReport(null);
    const eligible: PlatformBusinessRow[] = [];
    const excluded: ConfirmState["excluded"] = [];
    for (const row of selectedRows) {
      const elig = evaluateBulkEligibility(toSnapshot(row), action);
      if (elig.ok) eligible.push(row);
      else excluded.push({ row, detail: elig.detail, reason: elig.reason });
    }
    if (eligible.length === 0 && excluded.length === 0) {
      setError("Select at least one business.");
      return;
    }
    const cap = action === "hard_delete" ? BULK_HARD_DELETE_MAX : BULK_LIFECYCLE_MAX;
    if (eligible.length > cap) {
      setError(
        `Too many eligible businesses for ${actionLabel(action)}: ${eligible.length} selected, max ${cap} per request (timeout ${BULK_ROUTE_MAX_DURATION_SECONDS}s). Narrow the selection.`
      );
      return;
    }
    setConfirmPhrase("");
    setConfirm({ action, eligible, excluded });
  }

  async function runConfirmed() {
    if (!confirm) return;
    const { action, eligible } = confirm;

    if (action === "hard_delete") {
      const phrase = confirmPhrase.trim();
      if (phrase !== "DELETE" && phrase !== String(eligible.length)) {
        setError(
          `Type DELETE or the eligible count (${eligible.length}) to confirm hard-delete.`
        );
        return;
      }
    }

    setBusy(true);
    setError(null);
    setProgress(`Processing 0 / ${eligible.length}…`);
    try {
      const res = await fetch("/api/platform/businesses/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          // Include excluded IDs too so the server reports skips explicitly.
          businessIds: [...eligible.map((r) => r.id), ...confirm.excluded.map((e) => e.row.id)],
          confirm:
            action === "hard_delete"
              ? confirmPhrase.trim() === "DELETE"
                ? "DELETE"
                : String(eligible.length)
              : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: BulkItemResult[];
        orphans?: string[];
        exclusionSummary?: string | null;
        succeeded?: number;
        skipped?: number;
        failed?: number;
        action?: BulkBusinessAction;
      };
      if (!res.ok) throw new Error(data.error || "Bulk action failed");

      setReport({
        results: data.results ?? [],
        orphans: data.orphans ?? [],
        exclusionSummary: data.exclusionSummary ?? null,
        succeeded: data.succeeded ?? 0,
        skipped: data.skipped ?? 0,
        failed: data.failed ?? 0,
        action: data.action ?? action,
      });
      setConfirm(null);
      setConfirmPhrase("");
      setSelected(new Set());
      setProgress(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  const exclusionPreview = confirm
    ? formatBulkExclusionSummary(
        confirm.excluded.map((e) => ({
          name: e.row.name,
          reason: e.reason as never,
          detail: e.detail,
        }))
      )
    : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:max-w-sm flex-1">
          <Label htmlFor="biz-filter" className="text-xs text-muted">
            Filter (select-all uses this list only)
          </Label>
          <Input
            id="biz-filter"
            className="mt-1"
            placeholder="Filter by name, slug, plan, status…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            Showing {filtered.length} of {businesses.length}
            {filter.trim() ? " (filtered)" : ""}
          </p>
        </div>
        <p className="text-xs text-muted">
          Hard-delete batches capped at {BULK_HARD_DELETE_MAX} · other actions {BULK_LIFECYCLE_MAX} ·
          route timeout {BULK_ROUTE_MAX_DURATION_SECONDS}s
        </p>
      </div>

      {selected.size > 0 && !confirm && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-3 shadow-sm">
          <span className="text-sm font-medium text-heading">
            {selected.size} business{selected.size === 1 ? "" : "es"} selected
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => beginAction("suspend")}>
              Suspend
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => beginAction("restore")}>
              Restore
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => beginAction("soft_delete")}>
              Soft-delete
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700"
              disabled={busy}
              onClick={() => beginAction("hard_delete")}
            >
              Hard-delete
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {progress && <p className="text-sm text-muted">{progress}</p>}

      {report && (
        <div className="rounded-lg border border-border bg-subtle/40 px-4 py-3 text-sm space-y-2">
          <p className="font-medium text-heading">
            {actionLabel(report.action)} complete — {report.succeeded} succeeded, {report.skipped}{" "}
            skipped, {report.failed} failed
          </p>
          {report.exclusionSummary && (
            <p className="text-amber-800">{report.exclusionSummary}</p>
          )}
          <ul className="max-h-48 overflow-auto space-y-1 text-xs">
            {report.results.map((r) => (
              <li key={r.id}>
                <strong>{r.name}</strong>
                {r.slug ? ` (${r.slug})` : ""} — {r.outcome}
                {r.outcome === "skipped" ? `: ${r.detail}` : ""}
                {r.outcome === "failed" ? `: ${r.error}` : ""}
              </li>
            ))}
          </ul>
          {report.orphans.length > 0 && (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
              <p className="font-medium">Orphans (storage / Stripe not fully cleaned)</p>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {report.orphans.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => setReport(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {confirm && (
        <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-heading">
              Confirm {actionLabel(confirm.action).toLowerCase()}
            </h3>
            {exclusionPreview && (
              <p className="mt-2 text-sm text-amber-800">
                {confirm.excluded.length} of {confirm.eligible.length + confirm.excluded.length}{" "}
                cannot be {actionLabel(confirm.action).toLowerCase()}d:{" "}
                {confirm.excluded
                  .map((e) =>
                    e.reason === "protected"
                      ? `${e.row.name} (protected)`
                      : e.reason === "commission_history"
                        ? `${e.row.name} (has commission history)`
                        : `${e.row.name} (${e.detail})`
                  )
                  .join(", ")}
              </p>
            )}
          </div>

          {confirm.action === "hard_delete" ? (
            <div className="space-y-3">
              <p className="text-sm text-red-800 font-medium">
                This is permanent. It removes all CRM data, auth users, media from storage, and the
                Stripe customer for this mode. It cannot be undone. Prefer soft-delete if you might
                need the tenant again.
              </p>
              <div className="max-h-64 overflow-auto rounded border border-border">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted">
                      <th className="p-2">Name</th>
                      <th className="p-2">Slug</th>
                      <th className="p-2">Created</th>
                      <th className="p-2">Clients</th>
                      <th className="p-2">Projects</th>
                      <th className="p-2">Media</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirm.eligible.map((b) => (
                      <tr key={b.id} className="border-b border-border last:border-0">
                        <td className="p-2 font-medium">{b.name}</td>
                        <td className="p-2">{b.slug}</td>
                        <td className="p-2">{formatDate(b.created_at)}</td>
                        <td className="p-2">{b.clientCount}</td>
                        <td className="p-2">{b.projectCount}</td>
                        <td className="p-2">{b.mediaCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {confirm.excluded.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                  <p className="font-medium">Excluded (will not be deleted)</p>
                  <ul className="mt-1 list-disc pl-4">
                    {confirm.excluded.map((e) => (
                      <li key={e.row.id}>
                        {e.row.name} ({e.row.slug}) — {e.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <Label htmlFor="hard-confirm">
                  Type <strong>DELETE</strong> or <strong>{confirm.eligible.length}</strong> to
                  confirm
                </Label>
                <Input
                  id="hard-confirm"
                  className="mt-1 max-w-xs"
                  value={confirmPhrase}
                  onChange={(e) => setConfirmPhrase(e.target.value)}
                  autoComplete="off"
                  disabled={busy || confirm.eligible.length === 0}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                {actionLabel(confirm.action)} the following {confirm.eligible.length} business
                {confirm.eligible.length === 1 ? "" : "es"}:
              </p>
              <ul className="max-h-48 overflow-auto text-sm space-y-1">
                {confirm.eligible.map((b) => (
                  <li key={b.id}>
                    <strong>{b.name}</strong> <span className="text-muted">({b.slug})</span>
                  </li>
                ))}
              </ul>
              {confirm.excluded.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                  <p className="font-medium">Excluded</p>
                  <ul className="mt-1 list-disc pl-4">
                    {confirm.excluded.map((e) => (
                      <li key={e.row.id}>
                        {e.row.name} ({e.row.slug}) — {e.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || confirm.eligible.length === 0}
              className={confirm.action === "hard_delete" ? "bg-red-700 hover:bg-red-800" : undefined}
              onClick={() => void runConfirmed()}
            >
              {busy
                ? "Working…"
                : confirm.eligible.length === 0
                  ? "Nothing eligible"
                  : `Confirm ${actionLabel(confirm.action).toLowerCase()} (${confirm.eligible.length})`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirm(null);
                setConfirmPhrase("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-2 font-medium w-10">
                <input
                  type="checkbox"
                  aria-label="Select all filtered businesses"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  disabled={filtered.length === 0}
                />
              </th>
              <th className="py-2 pr-3 font-medium">Business</th>
              <th className="py-2 pr-3 font-medium">Source</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Subscription</th>
              <th className="py-2 pr-3 font-medium">Plan</th>
              <th className="py-2 pr-3 font-medium">Clients</th>
              <th className="py-2 pr-3 font-medium">Projects</th>
              <th className="py-2 pr-3 font-medium">Media</th>
              <th className="py-2 pr-3 font-medium">Revenue</th>
              <th className="py-2 pr-3 font-medium">Stripe</th>
              <th className="py-2 pr-3 font-medium">Created</th>
              <th className="py-2 font-medium">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => {
              const hardBlocked = b.is_protected || b.hasCommissionHistory;
              return (
                <tr
                  key={b.id}
                  className={`border-b border-border last:border-0 ${
                    hardBlocked ? "bg-amber-50/40" : ""
                  }`}
                >
                  <td className="py-3 pr-2">
                    <input
                      type="checkbox"
                      aria-label={`Select ${b.name}`}
                      checked={selected.has(b.id)}
                      onChange={() => toggleOne(b.id)}
                    />
                  </td>
                  <td className="py-3 pr-3">
                    <Link
                      href={`/platform/businesses/${b.id}`}
                      className="font-medium text-heading underline"
                    >
                      {b.name}
                    </Link>
                    <div className="text-xs text-muted">{b.slug}</div>
                    {b.is_protected && (
                      <div className="text-xs text-amber-800">protected — hard-delete blocked</div>
                    )}
                    {!b.is_protected && b.hasCommissionHistory && (
                      <div className="text-xs text-amber-800">
                        commission history — hard-delete blocked
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3">
                    <Badge variant={b.created_via === "signup" ? "warning" : "default"}>
                      {b.created_via === "signup" ? "signup" : "platform"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <Badge
                      variant={b.deleted_at ? "default" : b.status === "active" ? "success" : "warning"}
                    >
                      {b.deleted_at ? "deleted" : b.status}
                    </Badge>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="flex flex-col gap-1">
                      <Badge variant={b.requiresPayment ? "warning" : "success"}>
                        {b.subscription_status}
                      </Badge>
                      {b.isComped && (
                        <span className="text-xs text-muted">
                          {b.comped_reason || "comped"}
                          {b.comped_until == null
                            ? " · permanent"
                            : b.daysLeftInComp != null
                              ? ` · ${b.daysLeftInComp}d left`
                              : ""}
                        </span>
                      )}
                      {b.subscription_status === "trialing" && b.trial_ends_at && (
                        <span className="text-xs text-muted">
                          ends {formatDate(b.trial_ends_at)}
                          {b.daysLeftInTrial != null ? ` · ${b.daysLeftInTrial}d left` : ""}
                        </span>
                      )}
                      {b.requiresPayment && <span className="text-xs text-amber-700">paywalled</span>}
                    </div>
                  </td>
                  <td className="py-3 pr-3">{b.plan}</td>
                  <td className="py-3 pr-3">{b.clientCount}</td>
                  <td className="py-3 pr-3">{b.projectCount}</td>
                  <td className="py-3 pr-3">{b.mediaCount}</td>
                  <td className="py-3 pr-3">{formatCurrency(b.lifetimeRevenueCents)}</td>
                  <td className="py-3 pr-3">{b.stripeStatus}</td>
                  <td className="py-3 pr-3">{formatDate(b.created_at)}</td>
                  <td className="py-3">{formatDate(b.lastActivityAt)}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="py-6 text-center text-muted">
                  No businesses match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
