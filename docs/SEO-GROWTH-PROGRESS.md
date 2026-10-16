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
