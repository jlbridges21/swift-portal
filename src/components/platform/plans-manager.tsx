"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ENFORCED_ENTITLEMENTS,
  FUTURE_ENTITLEMENTS,
  ENTITLEMENT_LABELS,
  formatPlanPrice,
  type EntitlementKey,
  type PlanRow,
} from "@/lib/plan-catalog";

function emptyEntitlements(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of [...ENFORCED_ENTITLEMENTS, ...FUTURE_ENTITLEMENTS]) out[key] = false;
  return out;
}

export function PlansManager({ initialPlans }: { initialPlans: PlanRow[] }) {
  const router = useRouter();
  const [plans, setPlans] = useState(initialPlans);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);

  const editing = useMemo(
    () => (editingId && editingId !== "new" ? plans.find((p) => p.id === editingId) ?? null : null),
    [editingId, plans]
  );

  async function refresh() {
    const res = await fetch("/api/platform/plans", { credentials: "include" });
    const data = (await res.json()) as { plans?: PlanRow[]; error?: string };
    if (!res.ok) throw new Error(data.error || "Failed to reload plans");
    setPlans(data.plans ?? []);
    router.refresh();
  }

  async function savePlan(form: HTMLFormElement, id: string | "new") {
    setBusy(true);
    setError(null);
    const fd = new FormData(form);
    const entitlements: Record<string, boolean> = emptyEntitlements();
    for (const key of [...ENFORCED_ENTITLEMENTS, ...FUTURE_ENTITLEMENTS]) {
      entitlements[key] = fd.get(`ent_${key}`) === "on";
    }
    const body: Record<string, unknown> = {
      name: String(fd.get("name") ?? ""),
      description: String(fd.get("description") ?? ""),
      price_monthly_cents: fd.get("price_monthly")
        ? Math.round(Number(fd.get("price_monthly")) * 100)
        : null,
      price_annual_cents: fd.get("price_annual")
        ? Math.round(Number(fd.get("price_annual")) * 100)
        : null,
      trial_days: Number(fd.get("trial_days") ?? 14),
      display_order: Number(fd.get("display_order") ?? 100),
      is_active: fd.get("is_active") === "on",
      is_public: fd.get("is_public") === "on",
      entitlements,
      limits: {
        admin_seats: Number(fd.get("admin_seats") ?? 0),
        storage_gb: Number(fd.get("storage_gb") ?? 0),
        projects_per_month: fd.get("projects_per_month")
          ? Number(fd.get("projects_per_month"))
          : null,
      },
    };
    // Only send key on create — empty key on edit tripped "cannot be changed".
    if (id === "new") {
      body.key = String(fd.get("key") ?? "");
    }
    try {
      const res = await fetch(id === "new" ? "/api/platform/plans" : `/api/platform/plans/${id}`, {
        method: id === "new" ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; stripeRemapMessage?: string | null };
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.stripeRemapMessage) {
        setError(null);
        // Surface Stripe remap note without blocking save success.
        window.alert(data.stripeRemapMessage);
      }
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(plan: PlanRow) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/plans/${plan.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Update failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function move(plan: PlanRow, dir: -1 | 1) {
    const idx = plans.findIndex((p) => p.id === plan.id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= plans.length) return;
    const next = [...plans];
    const tmp = next[idx];
    next[idx] = next[swap];
    next[swap] = tmp;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/plans/reorder", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((p) => p.id) }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Reorder failed");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reorder failed");
    } finally {
      setBusy(false);
    }
  }

  function EntitlementFields({ plan }: { plan: PlanRow | null }) {
    const values = {
      ...emptyEntitlements(),
      ...((plan?.entitlements as Record<string, boolean> | undefined) ?? {}),
    };
    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-heading">Live entitlements (enforced)</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ENFORCED_ENTITLEMENTS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={`ent_${key}`} defaultChecked={values[key] === true} />
                {ENTITLEMENT_LABELS[key]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-heading">
            Future entitlements{" "}
            <Badge variant="warning">not yet enforced</Badge>
          </p>
          <p className="mb-2 text-xs text-muted">
            Do not sell these as live features until product enforcement ships.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {FUTURE_ENTITLEMENTS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" name={`ent_${key}`} defaultChecked={values[key] === true} />
                {ENTITLEMENT_LABELS[key as EntitlementKey]}
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function PlanForm({ plan, mode }: { plan: PlanRow | null; mode: "new" | "edit" }) {
    const limits = (plan?.limits ?? {}) as Record<string, number | null>;
    return (
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void savePlan(event.currentTarget, mode === "new" ? "new" : plan!.id);
        }}
      >
        {mode === "new" && (
          <div>
            <Label htmlFor="key">Key</Label>
            <Input id="key" name="key" required placeholder="studio" className="mt-1" />
          </div>
        )}
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={plan?.name ?? ""} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            name="description"
            defaultValue={plan?.description ?? ""}
            className="mt-1"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label htmlFor="price_monthly">Monthly ($)</Label>
            <Input
              id="price_monthly"
              name="price_monthly"
              type="number"
              step="0.01"
              defaultValue={
                plan?.price_monthly_cents != null ? plan.price_monthly_cents / 100 : ""
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="price_annual">Annual monthly equiv ($)</Label>
            <Input
              id="price_annual"
              name="price_annual"
              type="number"
              step="0.01"
              defaultValue={plan?.price_annual_cents != null ? plan.price_annual_cents / 100 : ""}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="trial_days">Trial days (new signups only)</Label>
            <Input
              id="trial_days"
              name="trial_days"
              type="number"
              min={0}
              max={365}
              required
              defaultValue={plan?.trial_days ?? 14}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted">
              Applies to new signups on this plan. 0 = no trial (paywall immediately). Does not
              change businesses already on a trial.
            </p>
          </div>
          <div>
            <Label htmlFor="display_order">Display order</Label>
            <Input
              id="display_order"
              name="display_order"
              type="number"
              defaultValue={plan?.display_order ?? 100}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="admin_seats">Admin seats</Label>
            <Input
              id="admin_seats"
              name="admin_seats"
              type="number"
              defaultValue={limits.admin_seats ?? 1}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="storage_gb">Storage (GB)</Label>
            <Input
              id="storage_gb"
              name="storage_gb"
              type="number"
              defaultValue={limits.storage_gb ?? 25}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="projects_per_month">Projects / month (blank = unlimited)</Label>
            <Input
              id="projects_per_month"
              name="projects_per_month"
              type="number"
              defaultValue={limits.projects_per_month ?? ""}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_active" defaultChecked={plan?.is_active !== false} />
            Active
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="is_public" defaultChecked={plan?.is_public !== false} />
            Public
          </label>
        </div>
        <EntitlementFields plan={plan} />
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : mode === "new" ? "Create plan" : "Save plan"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setEditingId(null)}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Button type="button" disabled={busy} onClick={() => setEditingId("new")}>
          New plan
        </Button>
      </div>

      {editingId === "new" && (
        <Card>
          <CardHeader>
            <CardTitle>Create plan</CardTitle>
          </CardHeader>
          <CardContent>
            <PlanForm plan={null} mode="new" />
          </CardContent>
        </Card>
      )}

      {plans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {plan.name}
                {plan.key === "studio" && <Badge variant="success">Recommended</Badge>}
                {!plan.is_active && <Badge variant="warning">Inactive</Badge>}
              </CardTitle>
              <p className="mt-1 text-sm text-muted">
                <code className="text-xs">{plan.key}</code>
                {" · "}
                {formatPlanPrice(plan.price_monthly_cents)}/mo
                {plan.price_annual_cents != null && (
                  <> · {formatPlanPrice(plan.price_annual_cents)}/mo annual</>
                )}
                {" · "}
                {plan.trial_days > 0
                  ? `${plan.trial_days}-day trial (new signups)`
                  : "no trial (new signups)"}
              </p>
              {plan.description && <p className="mt-2 text-sm text-muted">{plan.description}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void move(plan, -1)}>
                Up
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void move(plan, 1)}>
                Down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setEditingId(editingId === plan.id ? null : plan.id)}
              >
                Edit
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void toggleActive(plan)}>
                {plan.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {ENFORCED_ENTITLEMENTS.map((key) =>
                plan.entitlements?.[key] === true ? (
                  <Badge key={key} variant="success">
                    {ENTITLEMENT_LABELS[key]}
                  </Badge>
                ) : null
              )}
              {FUTURE_ENTITLEMENTS.map((key) =>
                plan.entitlements?.[key] === true ? (
                  <Badge key={key} variant="warning">
                    {ENTITLEMENT_LABELS[key]} · not yet enforced
                  </Badge>
                ) : null
              )}
            </div>
            <p className="text-muted">
              Limits: {(plan.limits as { admin_seats?: number })?.admin_seats ?? "—"} seats ·{" "}
              {(plan.limits as { storage_gb?: number })?.storage_gb ?? "—"} GB ·{" "}
              {(plan.limits as { projects_per_month?: number | null })?.projects_per_month ??
                "unlimited"}{" "}
              projects/mo
            </p>
            {editing?.id === plan.id && <PlanForm plan={plan} mode="edit" />}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
