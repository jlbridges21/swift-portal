# First-party marketing analytics & attribution

Super-admin dashboard: `/platform/analytics` (Overview, Acquisition, Blog, Accounts, SEO, Definitions).

This document is the design contract. The metric definitions shown in the dashboard's
**Definitions** tab come from `src/lib/analytics/metrics-dictionary.ts`; keep the two in sync.

## Goals and non-goals

- Measure how visitors find the platform marketing site, which pages and blog articles they read,
  and which of them become registered, trialing, activated, and paying businesses.
- Use authoritative backend records for every lifecycle stage. Client-side signals are only used for
  anonymous marketing traffic (pageviews, CTA clicks, signup-page views).
- Never fabricate, backfill, or guess. Businesses created before this system shipped, or without
  consented tracking, are shown as **Unknown**.
- Not a product-analytics tool: authenticated app navigation is never tracked.

## Where tracking runs

| Surface | Tracked | Why |
| --- | --- | --- |
| Platform marketing pages (home, how-it-works, pricing, partners, blog, contact, privacy, terms, partner landings) | Yes | Rendered through `MarketingShell`, which mounts `<MarketingAnalytics/>` |
| `/signup` | Yes (`signup_start` = signup page viewed) | Tracker mounted on the signup page; the form itself is untouched |
| Tenant hosts (`{slug}.shootportal.app`, custom domains) | **Never** | Tracker is not mounted there; the collector rejects non-platform hosts |
| Admin app, client portal, staff, platform | Never | Not mounted |

The client tracker also skips when: the visitor is signed in (Supabase auth cookie present), the
browser reports automation (`navigator.webdriver`), the page is opened on `localhost` (unless
`NEXT_PUBLIC_ANALYTICS_DEV=1`), or the browser opted out as internal traffic by visiting any
marketing URL with `?sp_internal=1` (undo with `?sp_internal=0`).

The collector additionally rejects known bot/crawler user agents, oversized bodies (> 4 KB), invalid
payloads, unknown hosts, and over-limit IPs (per-instance token bucket).

## Consent modes

| Mode | When | Browser storage | Visitor key | Cross-visit attribution |
| --- | --- | --- | --- | --- |
| `cookieless` (default) | No choice made, choice declined, or Global Privacy Control on | None | `sha256(dailySalt + ip + userAgent)`; salt rotates daily and is deleted after 2 days | No. Same-day sessions only; signups are **Unknown** |
| `persistent` | Visitor accepted analytics in the banner | `sp_vid` first-party cookie (UUID, 395 days), `sessionStorage` session id, `localStorage` consent choice | `sp_vid` | Yes: first touch, last touch, articles read, signup CTA |

Full IP addresses are never stored. In cookieless mode the IP is only an input to a one-way hash
whose salt is destroyed within 48 hours, so keys cannot be linked across days or reversed.

## Event model

```
analytics_sessions        one row per session (landing context, source, UTMs, device class)
analytics_events          pageview | cta_click | signup_start, deduped by client_event_id
analytics_daily_salts     rotating salts for cookieless visitor keys
business_attribution      one snapshot per business, written once at verified signup
business_lifecycle_events billing history the businesses table does not keep
                          (subscription_canceled, payment_failed, refund) from the billing webhook
```

Sessions: persistent-mode browsers send their own session id (new after 30 minutes of inactivity).
Cookieless sessions are assigned server-side: the same visitor key within 30 minutes of its last
event continues the session.

Lifecycle stages come from existing tables (no duplication):

| Stage | Source of truth |
| --- | --- |
| Account created | `businesses.created_at` where `created_via = 'signup'` |
| Trial started | Same row when `trial_ends_at` is set (trials start at creation in `createBusinessForPlatform`; length comes from `plans.trial_days`) |
| Activated | Earliest `projects.created_at` for the business (counted once) |
| Paid subscriber | Earliest `platform_subscription_payments.paid_at` with `amount_paid_cents > 0` |
| Revenue | Sum of `platform_subscription_payments.amount_paid_cents` (ShootPortal subscription invoices only; never tenant client payments) |
| Canceled / payment failed / refund | `business_lifecycle_events`, written by the billing webhook after its own processing, deduped by Stripe event id |

Excluded from lifecycle metrics: businesses created by platform admins (`created_via <> 'signup'`),
protected internal businesses (`is_protected`), and ids listed in `ANALYTICS_EXCLUDED_BUSINESS_IDS`.

## Attribution

Written once by `recordSignupAttribution()` inside `createBusinessForPlatform()` right after the
business row is inserted (password and Google signups share this path). Failures never block signup.

- If the request carries a valid `sp_vid` cookie (persistent consent), the visitor's sessions and
  events up to signup are loaded and summarized:
  - **First touch**: the visitor's earliest session (source, UTMs, referrer host, landing page, time).
  - **Last touch**: the latest session before signup with a non-direct source; Direct only if every
    session was direct.
  - **First / last article**: earliest and latest blog pageview before signup; **articles viewed**:
    every distinct article (used for assisted conversions).
  - **Signup CTA**: the last `cta_click` before signup.
- Otherwise the snapshot is stored with `status = 'unknown'` so the account still appears in reports
  as Unknown rather than Direct.
- Existing businesses get no snapshot (Unknown). Nothing is backfilled.
- Partner referral attribution (`partner_referrals`) is separate and unchanged.

Attribution models in reports:

- **First touch**: credit to the first-touch source / first article.
- **Last touch**: credit to the last non-direct source / last article.
- **Assisted** (articles only): an article "assisted" a registration when the business's
  `articles_viewed` includes it. Assisted counts overlap and must not be summed.

## Source classification

Order of precedence: UTM parameters → referrer host → no referrer (Direct). See
`classifyChannel()` in `src/lib/analytics/channels.ts`. Channels: Google organic, Bing organic,
Other organic search, Instagram, Facebook, TikTok, Other social, Email, Paid, Referral, Direct,
Unknown. Search keywords are never inferred from referrers; query data comes only from Search
Console.

## Reporting

- Timezone: `ANALYTICS_REPORTING_TZ` (default `America/Chicago`) for day buckets and range bounds.
- Funnel rates are cohort-based (see Definitions). Recent cohorts are flagged as still maturing.
- Queries read bounded row sets with the service role inside super-admin-only server code.

## Security

- All new tables: RLS enabled with **no policies**, and privileges revoked from `anon` and
  `authenticated`. Only the service role (server code) can read or write.
- Collector `POST /api/analytics/collect` is write-only, validates with zod, and returns `204`
  without echoing data.
- Dashboard pages call `requireSuperAdminPage()`; analytics APIs call `requireSuperAdminApi()`;
  middleware already blocks `/platform` and `/api/platform` for non-super-admins.

## Retention

`GET /api/cron/analytics-retention` (Vercel cron, `CRON_SECRET`) deletes events and sessions older
than `ANALYTICS_RETENTION_DAYS` (default 395) and salts older than 2 days. Attribution snapshots are
kept with the business and deleted with it (`ON DELETE CASCADE`).

## Search Console (optional)

Read-only via a Google service account with scope `webmasters.readonly`, signed server-side.
Env: `GSC_SITE_URL` (for example `sc-domain:shootportal.app`), `GSC_CLIENT_EMAIL`,
`GSC_PRIVATE_KEY`. Without them the SEO tab shows **Not connected**. Search Console clicks are
aggregated by Google and will not match first-party sessions.
