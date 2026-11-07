import { requireSuperAdminPage } from "@/lib/admin-access";
import { listExpenseEntries, loadEconomicsHistory, loadEconomicsSettings } from "@/lib/platform-economics";
import { formatUsd } from "@/lib/economics/assumptions";
import { Notice, Panel } from "@/components/platform/analytics/ui";
import { AssumptionsForm, ExpensesManager } from "@/components/platform/economics/costs-manager";
import { SourceTag } from "@/components/platform/economics/ui";

export const dynamic = "force-dynamic";

const COVERAGE: { item: string; status: "measured" | "estimated" | "not_attributable"; how: string }[] = [
  { item: "Supabase storage", status: "measured", how: "Daily scan of storage.objects, attributed by object key (business id, legacy project id, profile id, media record)." },
  { item: "Downloads streamed by ShootPortal", status: "measured", how: "Single-file, MLS and ZIP downloads meter the bytes they stream, per business, per day." },
  { item: "Signed full-size deliveries", status: "estimated", how: "One original file size per signed URL issued. The browser may read part of it (video seek), re-read it, or hit the CDN cache." },
  { item: "Gallery thumbnails & cached playback", status: "not_attributable", how: "Fetched directly from the Supabase CDN by the browser. Visible only on the Supabase invoice — record it below." },
  { item: "Supabase image transformations", status: "estimated", how: "Renders ShootPortal requests (MLS downloads, share previews). Supabase bills unique origin images per month, so this overstates." },
  { item: "Supabase database & compute", status: "not_attributable", how: "Shared. Enter the plan / compute cost as a fixed assumption; record the invoice line." },
  { item: "Vercel hosting & transfer", status: "estimated", how: "Transfer for bytes ShootPortal streams is attributed; hosting is a fixed, shared cost." },
  { item: "Stripe subscription fees", status: "estimated", how: "Card % + fixed fee + Billing % applied to each paying business's invoice amount. Directly attributable." },
];

export default async function CostsPage() {
  await requireSuperAdminPage();
  const settings = await loadEconomicsSettings();
  const [entries, history] = await Promise.all([listExpenseEntries().catch(() => null), loadEconomicsHistory(settings, 6)]);

  const recordedByMonth = new Map<string, number>();
  for (const e of entries ?? []) recordedByMonth.set(e.month, (recordedByMonth.get(e.month) ?? 0) + e.amountCents / 100);

  return (
    <div className="space-y-6">
      {!settings.migrated ? (
        <Notice tone="warn">
          Apply <code className="text-xs">supabase/migration-v112-platform-economics.sql</code> to save assumptions and record invoices. Defaults are
          shown below.
        </Notice>
      ) : null}

      <Panel
        title="Unit prices & assumptions"
        description="Every cost estimate in Platform Economics and the simulator's defaults come from these numbers."
        actions={<SourceTag kind="assumption" />}
      >
        <AssumptionsForm initial={settings.assumptions} migrated={settings.migrated} updatedAt={settings.updatedAt} updatedBy={settings.updatedByEmail} />
      </Panel>

      <Panel
        title="Recorded provider invoices"
        description="Actual amounts billed by Supabase, Vercel, Stripe and others. Used to reconcile — never to force customer estimates to match."
        actions={<SourceTag kind="actual" />}
      >
        <ExpensesManager entries={entries ?? []} migrated={entries !== null} />
      </Panel>

      {history.available ? (
        <Panel title="Estimate vs. invoice" description="Platform-level estimate (after included quotas, incl. fixed fees) next to what you recorded.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted">
                  <th className="py-2 pr-3 font-medium">Month</th>
                  <th className="py-2 pr-3 font-medium">Estimated</th>
                  <th className="py-2 pr-3 font-medium">Recorded</th>
                  <th className="py-2 font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {[...history.points].reverse().map((m) => {
                  const rec = recordedByMonth.get(m.month);
                  return (
                    <tr key={m.month} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 tabular-nums">{m.month.slice(0, 7)}</td>
                      <td className="py-2 pr-3 tabular-nums">{formatUsd(m.estimatedInfraCost)}</td>
                      <td className="py-2 pr-3 tabular-nums">{rec != null ? formatUsd(rec) : <span className="text-muted">—</span>}</td>
                      <td className="py-2 tabular-nums text-muted">
                        {rec != null ? `${rec - m.estimatedInfraCost >= 0 ? "+" : "−"}${formatUsd(Math.abs(rec - m.estimatedInfraCost))}` : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            A positive difference usually means delivery ShootPortal cannot see (thumbnails, cached playback) or shared compute. Recorded lines
            include every cost type, so compare like with like.
          </p>
        </Panel>
      ) : null}

      <Panel title="What is measured, estimated, or shared" description="How each expense reaches these dashboards.">
        <ul className="divide-y divide-border">
          {COVERAGE.map((c) => (
            <li key={c.item} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex shrink-0 items-center gap-2 sm:w-72">
                <span className="text-sm font-medium text-heading">{c.item}</span>
                {c.status === "not_attributable" ? (
                  <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Shared</span>
                ) : (
                  <SourceTag kind={c.status} />
                )}
              </div>
              <p className="text-sm text-muted">{c.how}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
