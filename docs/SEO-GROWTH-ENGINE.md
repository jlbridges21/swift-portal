# SEO Growth Engine

Super-admin dashboard at **`/platform/analytics/seo/growth`** (Analytics → SEO → "Growth engine").
It tells you what to fix, improve, or create next on the marketing site, and shows the evidence
for each recommendation. It never publishes or rewrites content.

Sections (one page, `?view=`): Overview · Opportunities · Indexing · Content · Content gaps ·
Conversions · Roadmap. The existing Search Console report stays at `/platform/analytics/seo`
("Search performance").

## Data sources (all real, all labelled)

| Source | Label in UI | What it gives | Code |
| --- | --- | --- | --- |
| Google URL Inspection API | Measured by Google | Index status, last crawl, Google-selected vs declared canonical, rich-result errors | `src/lib/seo-growth/url-inspection.ts` |
| Search Console Search Analytics + Sitemaps | Measured by Google | Clicks, impressions, CTR, position by page and page×query; sitemap status | `src/lib/analytics/search-console.ts` (existing), `data.ts` |
| Site crawl (plain GET, no JS) | Site audit | HTTP status, robots/noindex, canonical, titles, H1s, in-content links, external link health | `crawl.ts`, `html-extract.ts` |
| First-party analytics (existing) | Measured on site | Organic sessions, signup clicks, tool use, first/last/assisted registrations, revenue | `conversions.ts` → `src/lib/analytics/aggregate.ts` |
| Research backlog | Research-based | Content gaps, original-research ideas, "not pursued" list, each dated with sources | `content-gaps.ts` |

Same service account and `webmasters.readonly` scope as the existing SEO report: no new Google
project or credentials. The crawler doesn't run the analytics script, so audits never count as visits.

What the engine will not do: invent search volumes, keyword difficulty, rankings, expected traffic
gains, or conversion lifts; treat "in sitemap" or "returns 200" as "indexed"; join Search Console
clicks to individual visitors; or request indexing (Google has no supported bulk API for normal pages).

## Opportunity scoring (internal heuristic)

`score = (impact × 2 + commercial value) × confidence ÷ effort`. Impact 1–5 per rule; commercial
value 0–3 per page role (`inventory.ts`); confidence high 1 / medium 0.75 / low 0.5; effort low 1 /
medium 1.5 / high 2.5. High ≥ 7, Medium ≥ 4. It orders work and forecasts nothing. The same text is
shown on the Opportunities tab.

Rules that activate automatically once Search Console has data (dormant today):
low CTR at a page-one position (≥100 impressions), near page one (positions 8–20, ≥50 impressions),
and one query split across several pages. Organic "visitors but no signup clicks" activates at
≥30 organic entrances per page. Sample-size badges stay conservative (<30 "too early", <200 "directional").

## Caching, quotas, refresh

| Work | Cache | Cost |
| --- | --- | --- |
| Site crawl (~56 pages + ~140 external links) | 24h, tag `seo-growth` | ~15s |
| URL Inspection (≤80 URLs, 4 at a time) | 24h | ~56 of the 2,000/day quota |
| Sitemaps, page×query | 6h | 2 API calls |

Dashboard loads read the cache. **Refresh checks** (super-admin `POST /api/platform/seo-growth/refresh`,
5-minute cooldown) expires the tag, and the next load recomputes, which takes up to a minute. **No cron
was added.** `vercel.json` already runs 8 crons and the 24h cache keeps data fresh enough. If a schedule
is wanted later, add a cron that calls the refresh logic, after checking the plan's cron limits.

## Persistence (no new tables or migrations)

Uses the existing `platform_audit_log` (super-admin RLS read, service-role writes):

- `seo.opportunity.reviewed | dismissed | reopened`: latest row per opportunity id wins (optional note).
- `seo.index_snapshot`: index counts written whenever URL Inspection actually runs (at most once per
  24h cache period). Drives the "Index coverage over time" chart.

These rows also appear on `/platform/audit`, with small metadata.

## Command line

```
npm run seo:audit                                     # production, read-only
npx tsx scripts/seo-audit.ts --base http://localhost:3000   # a local build, before deploy
npx tsx --env-file=.env.local scripts/seo-audit.ts --google # + Google URL Inspection
npm run test:seo-growth                               # unit tests (no network, no DB)
```

`seo:audit` exits 1 on site-side critical issues (noindex, wrong canonical, robots block, non-200,
broken internal link), so it can gate a pre-deploy check.

## Maintaining it

- New marketing pages are monitored automatically when added to the blog, solutions, tools, or
  resources registries. A test asserts that the sitemap and the monitored list are identical.
- New content-gap research goes in `CONTENT_GAPS` with evidence and a `checkedAt` date.
- When you implement a recommendation, add an entry to `src/lib/seo-growth/changelog.ts` (Roadmap → "Done in code").
- Product claims that depend on production config are watched in `WATCH_PHRASES` (`html-extract.ts`).
