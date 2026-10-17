# SEO growth project: plan and progress

Scope: public marketing site only. No changes to authenticated app, auth, Stripe, tenant
isolation, schemas, migrations, or app APIs. Nothing is committed or deployed automatically.

## Resources reviewed (2026-10-15)

| Resource | Status | How it's used |
| --- | --- | --- |
| Anthropic frontend-design skill | Installed (plugin) | Design direction for tools, quote builder, resource library |
| Vercel web-design-guidelines | Installed in `.claude/skills` (instruction-only; fetches rules doc) | Rules applied to new components; no code executed |
| Vercel react-best-practices | Not installed; SKILL.md read as text | RSC-first pages, client islands only for interactivity, derived state in render |
| Google Lighthouse CI | Not installed; run pinned `lighthouse` from scratchpad via npx (no repo dependency) | Performance / a11y / SEO audit of representative pages |
| Anthropic document skills (docx/pdf/xlsx) | Not installed (rely on Python libs not present) | Equivalent output built with existing deps: `pdf-lib` + `@pdf-lib/fontkit` (PDF), `jszip` (real .docx/.xlsx OOXML) |

No new dependencies added.

## Phases

- [x] 1. Inventory routes, SEO infra, analytics, assets
- [x] 2. Technical SEO audit (+ Lighthouse) → `docs/TECHNICAL-SEO-AUDIT.md`
- [x] 3. Fix material technical issues
- [x] 4. `/tools` hub
- [x] 5. Drone photography pricing calculator
- [x] 6. Real estate photography pricing calculator
- [x] 7. Photography quote builder
- [x] 8. `/resources` hub
- [x] 9. Seven templates + resource pages
- [x] 10. Internal linking / topic clusters
- [x] 11. Existing content tune-ups (titles, descriptions, links to tools/resources)
- [x] 12. Reuse marketing assets
- [x] 13. Conversion paths / CTAs
- [x] 14. Analytics events (existing first-party system)
- [x] 15–16. Validation, tests, build, app-safety diff review, final report

## Status (2026-10-15)

All phases complete locally; nothing committed or deployed. Checks: `tsc`, ESLint, tenant-lint
(920 files), `verify-analytics` (110), `verify-tools` (60, incl. PDF), reserved routes, portal-url,
brand-theme, and `next build` all pass. Lighthouse before/after and the crawl results are in
`docs/TECHNICAL-SEO-AUDIT.md`.

Manual steps after deploy: resubmit `sitemap.xml` in Search Console and request indexing for
`/tools`, `/resources`, and their child pages; set `WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE` in production
or remove reminder-email mentions from older articles. Template files are regenerated with
`npx tsx scripts/build-resources.ts`.

---

# Phase 2: SEO Growth Engine (2026-10-16)

Design and usage: `docs/SEO-GROWTH-ENGINE.md`. Same scope rules as above: marketing pages, SEO
infrastructure, and super-admin analytics only. No schema changes, migrations, crons, or deploys.

## Findings that drove the work (measured 2026-10-16)

- **Google index (URL Inspection, all 54 monitored pages):** 1 indexed (the homepage), 44 "Discovered –
  currently not indexed", 9 "URL is unknown to Google". The homepage was last crawled 2026-10-12, before
  the content launch on 2026-10-15. Sitemap submitted 2026-10-16: 56 URLs, 0 errors.
- **Search Console performance (since 2026-09-24):** 33 impressions, 5 clicks, all on `/`; Google
  withheld every query. Too little to rank keyword opportunities yet.
- **First-party analytics (all time):** 11 sessions (3 Google organic), 0 attributed signups.
- **Live crawl of production:** all 56 pages return 200, self-canonical, indexable, allowed by robots,
  in the sitemap; no broken internal links. One truly broken external citation (Moxie help article, 404).
  Google's help pages answer HEAD with 404 but GET with 200; the checker confirms with GET.

## Checklist

- [x] Audit GSC integration, analytics, routes, content (reuse service account, `webmasters.readonly`)
- [x] URL Inspection + Sitemaps clients, 24h cache, quota-aware (`url-inspection.ts`)
- [x] Site crawler + HTML extraction (`crawl.ts`, `html-extract.ts`)
- [x] Page health: Healthy / Needs attention / Critical / Unknown, plain-English issues (`health.ts`)
- [x] Opportunity engine with evidence types and a documented heuristic (`opportunities.ts`)
- [x] Content refresh checklist: year rollover, stale facts, broken links, missing links, overlap, claim checks (`content-audit.ts`)
- [x] Content gap + original-research backlog, dated and sourced (`content-gaps.ts`)
- [x] Organic conversions on the existing attribution math (`conversions.ts`)
- [x] Dashboard `/platform/analytics/seo/growth` + "Search performance / Growth engine" switch on the SEO tab
- [x] Review / dismiss / reopen and index snapshots in `platform_audit_log` (`store.ts`)
- [x] Refresh API with cooldown; review API; both super-admin only
- [x] Fixes: broken Moxie citation; 4 article→calculator callouts; 4 links to 3 under-linked landing pages; `/tools` linked from `/resources`
- [x] `scripts/verify-seo-growth.ts` (99 checks) and `scripts/seo-audit.ts`
- [x] tsc, ESLint, tenant-lint, verify-analytics, verify-tools, reserved routes, portal-url, brand-theme, `next build`
- [ ] Visual check of the dashboard while signed in as super admin (desktop + mobile)
- [ ] After deploy: Refresh checks; confirm the linking and broken-link items clear on the live site
- [ ] Manual: request indexing in Search Console (homepage first, then the list on the Opportunities tab)
- [ ] Manual: confirm `WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE` in production (reminder claims)
