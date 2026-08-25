# Production environment variables

Every `process.env` / `NEXT_PUBLIC_*` key the ShootPortal app reads (as of SaaS prompt 6 / production sweep). Compare this file to `.env.example` whenever you add a key.

**Legend:** R = required for that environment to function; O = optional; Dev = local; Preview = Vercel Preview; Prod = Vercel Production.

## Must differ between Production and Preview

These have already caused incidents when Preview shared Production secrets (or the reverse):

| Variable | Why |
|----------|-----|
| `STRIPE_SECRET_KEY` | `sk_live_…` in Prod only; Preview/Dev must use `sk_test_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Matching `pk_live_` / `pk_test_` |
| `STRIPE_WEBHOOK_SECRET` | Platform (tenant→client) webhook endpoint signing secret — **one secret per endpoint URL** |
| `STRIPE_BILLING_WEBHOOK_SECRET` | SaaS billing webhook — separate endpoint |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect webhook — separate endpoint |
| `NEXT_PUBLIC_APP_URL` | Preview deployment URL vs `https://shootportal.app` (or production apex) |
| `CRON_SECRET` | May be shared, but Production must have it set for Vercel Cron auth |

Mode-aware price IDs live in `plan_stripe_prices` (`test` vs `live` rows). Checkout resolves by `getStripeMode()` from `STRIPE_SECRET_KEY` prefix — never mix live prices with a test key.

---

## Core

| Variable | Purpose | Dev | Preview | Prod |
|----------|---------|-----|---------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | R | R | R |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser / user-scoped client | R | R | R |
| `SUPABASE_SERVICE_ROLE_KEY` | Server bypass RLS (platform, cron, webhooks) | R | R | R |
| `NEXT_PUBLIC_APP_URL` | Canonical origin for redirects, email links, OAuth | R | R | R |
| `NODE_ENV` | Set by Next/Vercel | auto | auto | auto |
| `NEXT_RUNTIME` | Set by Next on server | auto | auto | auto |

## Platform identity

| Variable | Purpose | Dev | Preview | Prod |
|----------|---------|-----|---------|------|
| `PLATFORM_ROOT_DOMAIN` | Root domain for subdomain portals (default `shootportal.app`) | O | O | R |
| `PLATFORM_EMAIL_DOMAIN` | Shared Resend domain for tenant From headers | O | O | R |
| `PLATFORM_FROM_ADDRESS` | Platform lifecycle From mailbox (default `noreply@shootportal.app`) | O | O | R |
| `PLATFORM_REPLY_TO` / `PLATFORM_SUPPORT_EMAIL` | Lifecycle email Reply-To | O | O | O |
| `PLATFORM_SESSION_SECRET` | Impersonation cookie signing (falls back to `CRON_SECRET`) | O | R | R |

## Stripe

| Variable | Purpose | Dev | Preview | Prod |
|----------|---------|-----|---------|------|
| `STRIPE_SECRET_KEY` | Platform Stripe secret (`sk_test_` / `sk_live_`) | R* | R* | R |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout / Elements publishable key | R* | R* | R |
| `STRIPE_WEBHOOK_SECRET` | `/api/stripe/webhook` (tenant payments on platform account) | O† | R | R |
| `STRIPE_BILLING_WEBHOOK_SECRET` | `/api/stripe/webhook/billing` (SaaS subscriptions) | O† | R | R |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | `/api/stripe/webhook/connect` | O† | R | R |

\* Required when testing payments/billing.  
† Local `stripe listen` provides a temporary secret.

## Email (Resend)

| Variable | Purpose | Dev | Preview | Prod |
|----------|---------|-----|---------|------|
| `RESEND_API_KEY` | Send email | O | R | R |
| `RESEND_FROM_EMAIL` | Legacy/fallback From (prefer `PLATFORM_FROM_ADDRESS`) | O | O | O |
| `RESEND_WEBHOOK_SECRET` | `/api/resend/webhook` signature | O | R | R |

## Cron

| Variable | Purpose | Dev | Preview | Prod |
|----------|---------|-----|---------|------|
| `CRON_SECRET` | Bearer token; Vercel Cron auto-sends `Authorization: Bearer <CRON_SECRET>` when this env is set | O | O | R |
| `WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE` | UTC ISO floor for reminder anchors. **Unset = no historical reminders send** (backlog safety). Set to e.g. 7 days ago after first clean dry-run | O | O | R‡ |

‡ Required to enable workflow-reminders after reviewing the dry-run. Leave unset until then.

## Custom domains (Vercel project API)

| Variable | Purpose | Dev | Preview | Prod |
|----------|---------|-----|---------|------|
| `VERCEL_API_TOKEN` | Bearer token to add/verify/remove project domains (prefer project-scoped) | O | O | R* |
| `VERCEL_PROJECT_ID` | Vercel project id or name | O | O | R* |
| `VERCEL_TEAM_ID` | Team id when the project lives under a team | O | O | O |

\* Required for automatic self-serve custom domains. If unset, Settings → Custom Domain degrades to manual DNS + contact support / platform admin (never a hard crash).

## Integrations (optional)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` | Admin web push |
| `GHL_PORTAL_LEAD_WEBHOOK_URL` | Swift-only fallback for GHL; other tenants use settings |

> **2026-08-25:** Google Calendar admin sync was removed (`migration-v67-drop-google-calendar.sql`).
> `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` are no longer used by the app.
> Supabase Auth Google sign-in (if enabled) stores its own OAuth client credentials in the Supabase
> Dashboard, not in these env vars.

## Upload / debug (optional)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_UPLOAD_DIAGNOSTIC_MODE` | Upload diagnostics |
| `NEXT_PUBLIC_UPLOAD_DEBUG_UI` | Upload debug UI |

## Test-only (never Production)

| Variable | Purpose |
|----------|---------|
| `SIGNUP_FORCE_FAIL_AFTER_BUSINESS` | Force signup failure after business create |
| `SIGNUP_TEST_NO_EMAIL` | Skip invite email in signup tests |
| `PLATFORM_FORCE_INVITE_FAIL` | Force invite failure |
| `PENTEST_BASE_URL` | Tenant pentest HTTP base |

---

## `.env.example` delta (this sweep)

Added / clarified:

- `STRIPE_BILLING_WEBHOOK_SECRET` (already present)
- `CRON_SECRET` + `WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE`
- `PLATFORM_SESSION_SECRET`, `PLATFORM_REPLY_TO`
- Comment block on Production vs Preview Stripe keys

Unused in `src/` but may appear in ops docs: none critical. `RESEND_FROM_EMAIL` is still read as fallback — keep documented.
