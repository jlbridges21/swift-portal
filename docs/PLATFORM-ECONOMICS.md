# Platform Economics

Super-admin dashboards at `/platform/economics` (Overview · Storage & Bandwidth · Business
Economics · Pricing Simulator · Costs & Assumptions), plus **Storage** and **Monthly cost** columns
on `/platform` and an **Economics** card on each business. Internal only: every page and API calls
`requireSuperAdminPage` / `requireSuperAdminApi`; all tables are service-role only.

Migration: `supabase/migration-v112-platform-economics.sql` (additive). Without it the pages still
work: storage falls back to `SUM(media_assets.file_size)` and costs use default list prices.
Applying it sets `platform_economics_settings.tracking_started_at` — the start of metered egress.

## Where every number comes from

| Figure | Source | Label |
|---|---|---|
| Storage per business | `storage.objects` sizes, one grouped scan (`platform_storage_usage_by_business`), attributed by key prefix: business id → legacy project id → profile id → exact `media_assets.file_path`. Anything else is "not attributable" (platform files, orphans) but still counted in the platform total. | Measured |
| Storage history | Daily snapshot (cron `/api/cron/platform-economics`, 17:30 UTC, and on page load if > 26 h old). Months before the first snapshot are **reconstructed** from upload dates of media still stored — deleted files and thumbnails excluded. | Measured / Estimated |
| Allowance | Plan `limits.storage_gb` of each live business. | Measured |
| Egress — app-streamed | `serveMediaFileDownload` (single + MLS), public photo shares, both ZIP routes record exact bytes in `business_egress_daily`. | Measured |
| Egress — signed originals | Full-size signed URLs (`/api/media/download/[id]`, public link) record one file size per issue. | Estimated |
| Egress — before metering | `media_downloads` log × original file size (single-file downloads; ZIPs were not logged). | Estimated |
| Egress — not visible | Gallery thumbnails and CDN-cached playback go browser → Supabase directly. Only on the Supabase invoice. | — |
| MRR | Stripe subscription unit amount (`business_billing_journey`) for active / past-due, non-comped businesses; annual ÷ 12. Falls back to the plan's list price. | Actual (list) |
| Collected | `platform_subscription_payments` (paid invoices; discounts included). | Actual |
| Costs | Usage × unit prices in `platform_economics_settings` (defaults: Supabase Pro, Vercel Pro, Stripe Billing list prices). | Estimated |
| Recorded invoices | `platform_expense_entries`, entered by hand on Costs & Assumptions. | Actual |

## Cost allocation

- **Per business = marginal**: usage × overage rate, no share of included quotas or fixed fees.
  App-streamed bytes pay Supabase uncached egress *and* Vercel transfer. Stripe fees are directly
  attributable (card % + fixed + Billing %).
- **Platform = after quotas**: included quotas (100 GB storage, 250 GB uncached + 250 GB cached
  egress, Vercel 1 TB, 100 image renders) are subtracted once from platform totals, then fixed
  plan fees are added. The platform estimate is therefore below the sum of per-business costs
  while usage is inside quotas — by design, never forced to match.
- **Contribution** = MRR − infrastructure − Stripe fees (− fixed, where stated). Never "net
  profit": payroll, marketing, support and taxes are outside the model.

## Pricing Simulator

Pure model in `src/lib/economics/simulator.ts` (math checks: `npm run test:platform-economics`).
Scenarios are stored in `platform_pricing_scenarios`, which no billing / plan / Stripe code reads.
Open scenarios also persist in the browser (`localStorage`). Baseline values (average utilization,
downloads ÷ stored, annual share, delivery split) come from today's measured data; when a value
cannot be measured the simulator uses labelled illustrative defaults.

## Operating it

- Re-measure storage now: **Re-measure storage** button (POST `/api/platform/economics/snapshot`).
- Reconcile monthly: record the Supabase / Vercel invoice lines on Costs & Assumptions and compare
  against the estimate table. A persistent positive gap is usually thumbnail / cached delivery or
  shared compute.
- Update prices when providers change them; set "Prices last verified on".
