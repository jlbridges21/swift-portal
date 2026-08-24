import type { PlanStripePriceMismatch } from "@/lib/sync-plan-stripe-prices";

function formatCents(cents: number | null): string {
  if (cents == null) return "(none)";
  return `$${(cents / 100).toFixed(2)}`;
}

export function PlanStripePriceConsistencyAlert({
  mode,
  mismatches,
}: {
  mode: "test" | "live";
  mismatches: PlanStripePriceMismatch[];
}) {
  if (!mismatches.length) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-950"
    >
      <p className="text-base font-bold">CRITICAL: Catalog price ≠ Stripe charge amount</p>
      <p className="mt-1">
        The marketing site advertises the catalog price, but Checkout would charge a different
        Stripe Price ({mode} mode). Fix by re-saving the plan (triggers remap) or running{" "}
        <code className="rounded bg-red-100 px-1">npm run setup:stripe-billing</code> for this
        mode. Existing subscribers keep their old Price.
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1 font-mono text-xs">
        {mismatches.map((m) => (
          <li key={`${m.planKey}-${m.billingInterval}-${m.mode}`}>
            {m.planKey} {m.billingInterval}: catalog {formatCents(m.catalogCents)} vs Stripe{" "}
            {formatCents(m.stripeUnitAmountCents)} ({m.reason}
            {m.stripePriceId ? ` · ${m.stripePriceId}` : ""})
          </li>
        ))}
      </ul>
    </div>
  );
}
