"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  ASSUMPTION_FIELDS,
  DEFAULT_COST_ASSUMPTIONS,
  formatUsd,
  type AssumptionField,
  type CostAssumptions,
} from "@/lib/economics/assumptions";
import type { ExpenseEntry } from "@/lib/platform-economics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const GROUPS: { key: AssumptionField["group"]; title: string; note: string }[] = [
  { key: "storage", title: "Storage", note: "Supabase Storage. Included quotas apply once to the platform." },
  { key: "egress", title: "Egress & delivery", note: "Supabase cached / uncached egress and Vercel transfer." },
  { key: "other", title: "Image transformations", note: "Supabase image rendering (MLS-size downloads, share previews)." },
  { key: "stripe", title: "Stripe (subscription billing)", note: "Directly attributable to each paying business." },
  { key: "fixed", title: "Fixed platform costs", note: "Shared. Never assigned to individual businesses." },
];

const CATEGORY_LABELS: Record<string, string> = {
  supabase_storage: "Supabase — storage",
  supabase_egress: "Supabase — egress",
  supabase_compute: "Supabase — compute",
  supabase_base: "Supabase — plan",
  supabase_image_transforms: "Supabase — image transformations",
  supabase_other: "Supabase — other",
  vercel: "Vercel",
  stripe_fees: "Stripe fees",
  email: "Email",
  other: "Other",
};

const COST_TYPE_LABELS: Record<string, string> = {
  usage_shared: "Usage (shared)",
  fixed: "Fixed",
  attributable: "Directly attributable",
};

export function AssumptionsForm({ initial, migrated, updatedAt, updatedBy }: { initial: CostAssumptions; migrated: boolean; updatedAt: string | null; updatedBy: string | null }) {
  const router = useRouter();
  const [values, setValues] = useState<CostAssumptions>(initial);
  const [busy, setBusy] = useState(false);

  const display = (f: AssumptionField) => (f.percent ? +(values[f.key] * 100).toFixed(4) : values[f.key]);
  const set = (f: AssumptionField, raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    setValues((v) => ({ ...v, [f.key]: f.percent ? Math.min(n / 100, 1) : n }));
  };

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/economics/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assumptions: values }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Cost assumptions saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <fieldset key={g.key} className="rounded-xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold text-heading">{g.title}</legend>
            <p className="mb-3 text-xs text-muted">{g.note}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ASSUMPTION_FIELDS.filter((f) => f.group === g.key).map((f) => (
                <div key={f.key}>
                  <Label htmlFor={`a-${f.key}`} className="text-xs" title={f.help}>
                    {f.label} <span className="text-muted">({f.unit})</span>
                  </Label>
                  <Input
                    id={`a-${f.key}`}
                    type="number"
                    min={0}
                    step={f.percent ? 0.1 : f.step}
                    className="mt-1"
                    value={display(f)}
                    onChange={(e) => set(f, e.target.value)}
                  />
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{f.help}</p>
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-heading">Price check</legend>
          <Label htmlFor="a-verified" className="text-xs">
            Prices last verified on
          </Label>
          <Input
            id="a-verified"
            type="date"
            className="mt-1 max-w-[12rem]"
            value={values.pricesVerifiedOn}
            onChange={(e) => setValues((v) => ({ ...v, pricesVerifiedOn: e.target.value || v.pricesVerifiedOn }))}
          />
          <p className="mt-2 text-xs text-muted">
            Defaults are Supabase Pro / Vercel Pro / Stripe Billing list prices. Check them against supabase.com/pricing and your invoices.
          </p>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => void save()} disabled={busy || !migrated}>
          {busy ? "Saving…" : "Save assumptions"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setValues(DEFAULT_COST_ASSUMPTIONS)} disabled={busy}>
          Reset to list prices
        </Button>
        <p className="text-xs text-muted">
          {!migrated
            ? "Saving needs migration V112."
            : updatedAt
              ? `Last saved ${new Date(updatedAt).toLocaleString()}${updatedBy ? ` by ${updatedBy}` : ""}.`
              : "Using defaults."}{" "}
          Affects estimates only — never prices, plans or billing.
        </p>
      </div>
    </div>
  );
}

export function ExpensesManager({ entries, migrated }: { entries: ExpenseEntry[]; migrated: boolean }) {
  const router = useRouter();
  const now = new Date();
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const [form, setForm] = useState({ month: lastMonth, provider: "Supabase", category: "supabase_egress", costType: "usage_shared", amount: "", notes: "" });
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    try {
      const res = await fetch("/api/platform/economics/expenses", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success("Invoice line recorded");
      setForm((f) => ({ ...f, amount: "", notes: "" }));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this recorded invoice line?")) return;
    const res = await fetch(`/api/platform/economics/expenses/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) router.refresh();
    else toast.error("Delete failed");
  }

  const selectCls = "mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-heading";

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <Label htmlFor="e-month" className="text-xs">Month</Label>
          <Input id="e-month" type="month" className="mt-1" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="e-provider" className="text-xs">Provider</Label>
          <Input id="e-provider" className="mt-1" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="e-cat" className="text-xs">Category</Label>
          <select id="e-cat" className={selectCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="e-type" className="text-xs">Cost type</Label>
          <select id="e-type" className={selectCls} value={form.costType} onChange={(e) => setForm({ ...form, costType: e.target.value })}>
            {Object.entries(COST_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="e-amount" className="text-xs">Amount ($)</Label>
          <Input id="e-amount" type="number" min={0} step={0.01} className="mt-1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <div className="flex items-end">
          <Button type="button" className="w-full" disabled={busy || !migrated || !form.amount} onClick={() => void add()}>
            {busy ? "Saving…" : "Record"}
          </Button>
        </div>
      </div>
      <Input placeholder="Notes (optional, e.g. invoice number)" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} aria-label="Notes" />

      {entries.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Month</th>
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Category</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Amount</th>
                <th className="py-2 pr-3 font-medium">Notes</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 tabular-nums">{e.month.slice(0, 7)}</td>
                  <td className="py-2 pr-3">{e.provider}</td>
                  <td className="py-2 pr-3">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                  <td className="py-2 pr-3 text-muted">{COST_TYPE_LABELS[e.costType]}</td>
                  <td className="py-2 pr-3 tabular-nums">{formatUsd(e.amountCents / 100)}</td>
                  <td className="py-2 pr-3 text-xs text-muted">{e.notes}</td>
                  <td className="py-2 text-right">
                    <button type="button" onClick={() => void remove(e.id)} className="text-muted hover:text-rose-700" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">No invoices recorded yet. Add last month&apos;s Supabase and Vercel invoice lines to reconcile estimates.</p>
      )}
    </div>
  );
}
