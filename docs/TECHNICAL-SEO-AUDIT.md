# Technical SEO audit: marketing site (2026-10-15)

Scope: every public marketing route on the platform host (homepage, how it works, pricing, blog
index, 25 articles, 10 solution pages, partners, strategic partners, contact, privacy, terms), plus
the new `/tools` and `/resources` sections. Method: a crawl of the local production build (all 44
sitemap URLs plus every internal link found), Lighthouse 12.8.2 (mobile, simulated throttling) on
representative pages, and code review of metadata, robots, sitemap, and bundles.

Search Console has too little history to prioritize anything; no rankings, impressions, or indexing
status are claimed here. Being in the sitemap does not mean a page is indexed.

## Baseline (before changes)

Crawl of 44 pages: every page returned 200, had a self-referencing canonical on the www host, one H1,
an OG image, alt text on all images, explicit image dimensions, no `noindex`, and no broken internal
links. Robots allows marketing routes and blocks app surfaces; the sitemap excludes the app.

| Page (mobile) | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 77 | 96 | 100 | 100 | 5.3 s | 40 ms | 0 |
| `/real-estate-photography-software` | 86 | 99 | 100 | 100 | 4.1 s | 20 ms | 0 |
| `/blog/drone-photography-pricing-guide` | 87 | 100 | 100 | 100 | 4.0 s | 40 ms | 0 |
| `/pricing` | 91 | 98 | 100 | 100 | 3.5 s | 20 ms | 0 |

Local `next start` on a laptop: absolute LCP/TTFB values are not representative of Vercel's edge, but
the relative findings are.

## Findings and actions

| SEO issue | Severity | Pages | Action taken | Status |
| --- | --- | --- | --- | --- |
| Supabase auth client (≈216 KB raw / 55 KB gzip) shipped on every marketing page via the root `error.tsx` / `not-found.tsx` boundaries (`SafeHomeLink`) and the homepage `AuthFragmentHandler`; flagged by Lighthouse as the largest unused JS | High (INP/LCP, all pages) | All | Changed the two static imports to `await import()` inside the code paths that already ran on demand. Behavior identical; the library now loads only when an error page renders or a login link lands with tokens | Fixed |
| Homepage server response: two plan queries ran sequentially | Medium (LCP) | `/` | Run in parallel with `Promise.allSettled` (platform branch only; tenants untouched) | Fixed |
| No structured data on core pages | Medium | `/`, `/how-it-works`, `/pricing`, `/contact`, `/partners`, `/strategic-partners` | Added Organization, WebSite, SoftwareApplication (live price, no ratings), WebPage, BreadcrumbList, and VideoObject for the two hosted product demos | Fixed |
| Titles over ~60 characters truncated in results | Low–medium | 16 articles | Article titles drop the " | ShootPortal" suffix when it would exceed 60 characters (social titles keep the brand); one 61-character SEO title shortened | Fixed |
| Meta descriptions over ~160 characters | Low | `/`, `/partners`, `/strategic-partners`, 6 articles | Rewritten to ≤160 characters; the automation article's description no longer promises reminder emails (see "Remaining") | Fixed |
| Homepage title/description were the generic site defaults | Low | `/` | Platform-only metadata: "ShootPortal: Run Your Media Business in One Place"; `SITE.description` kept as the tenant fallback | Fixed |
| Heading order skipped H2 on pricing (card H3 under H1) | Low (a11y) | `/pricing` | Card heading level is a prop; H2 on pricing, H3 under the homepage section | Fixed |
| Logo alt duplicated the link's text | Low (a11y) | All | Logo image `alt=""` inside the already-named link | Fixed |
| Demo play button's accessible name didn't contain its visible text | Low (a11y) | Pages with demos | Name now built from visible text plus a screen-reader prefix | Fixed |
| Caption contrast below 4.5:1 | Low (a11y) | `/` | `#94A3B8` → `#64748B` | Fixed |
| `/partners`, `/strategic-partners` linked only from nav/footer | Low | 2 | Left as is: navigational pages, not content targets | Accepted |
| `bf-cache` blocked, "legacy JavaScript" | Low | All | Framework defaults (dynamic routes, Next polyfills); not changed to avoid app-wide config risk | Accepted |

## After changes

Same method, same machine, production build. Single runs vary by several performance points
(the blog article scored 84, 84, and 91 on three consecutive runs), so read small differences as noise.

| Page (mobile) | Performance | Accessibility | Best practices | SEO | LCP | TBT | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | 86 (was 77) | 100 (was 96) | 100 | 100 | 4.1 s (was 5.3 s) | 20 ms | 0 |
| `/real-estate-photography-software` | 88 (was 86) | 100 (was 99) | 100 | 100 | 3.9 s | 20 ms | 0 |
| `/blog/drone-photography-pricing-guide` | 84–91 (was 87) | 100 | 100 | 100 | 3.5–4.0 s | 20–190 ms | 0 |
| `/pricing` | 90 (was 91) | 100 (was 98) | 100 | 100 | 3.6 s | 20 ms | 0 |
| `/tools` | 90 | 100 | 100 | 100 | 3.6 s | 20 ms | 0 |
| `/tools/drone-photography-pricing-calculator` | 93 | 100 | 100 | 100 | 3.2 s | 20 ms | 0 |
| `/tools/real-estate-photography-pricing-calculator` | 93 | 100 | 100 | 100 | 3.2 s | 20 ms | 0 |
| `/tools/photography-quote-builder` | 92 | 100 | 100 | 100 | 3.3 s | 20 ms | 0 |
| `/resources` | 92 | 100 | 100 | 100 | 3.3 s | 30 ms | 0 |
| `/resources/photography-invoice-template` | 92 | 100 | 100 | 100 | 3.3 s | 20 ms | 0 |

The only failing binary audit on any page is `bf-cache` (framework default, accepted above). The
after-crawl of all sitemap URLs found no non-200 pages, missing canonicals, multiple H1s, `noindex`,
or broken internal links, and all 15 template downloads and 7 previews return 200. Two issues found
during the after-crawl were fixed: a heading skip in the quote preview (H3 → H2), and four resource
titles over 60 characters (they now drop the brand suffix, like long article titles). Caption text in
the calculators was darkened to pass contrast.

## New sections

`/tools` (hub + 3 tools) and `/resources` (hub + 7 templates) are server-rendered with unique
titles/descriptions, one H1, canonical, OG, breadcrumbs, and JSON-LD (WebApplication with
`price: 0`, CreativeWork with downloadable MediaObjects, FAQPage built from the visible FAQ). All are in
the sitemap; `tools` and `resources` are reserved so partner slugs can't claim them.

## Remaining limitations and follow-ups

- **Reminder emails are effectively off in production** (`WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE` unset,
  per `docs/LAUNCH-CHECKLIST.md`). Several older articles still describe reminder emails. Set the env
  var in production, or remove those mentions.
- **Videos are served through the middleware matcher** (`.mp4`/`.webm` aren't in the static
  exclusion list). Verified working with range requests and no cookies; adding the extensions to the
  matcher exclusion would skip a little edge work but touches app routing, so it was left alone.
- **Search Console**: resubmit `sitemap.xml` after deploy and request indexing for `/tools`,
  `/resources`, and their child pages. Measure before drawing conclusions.
