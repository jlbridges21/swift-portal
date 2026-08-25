# ShootPortal tenant architecture

> **2026-08-25:** Google Calendar sync was removed. `google_calendar_connections` /
> `google_calendar_connections_v2` and `shoot_proposals.google_calendar_event_id` were dropped in
> `migration-v67-drop-google-calendar.sql`. Historical mentions of those tables below describe the
> pre-removal model.

Final model after prompts 1–19 plus this hardening pass. Production hosts:

| Host | Kind | Business |
|---|---|---|
| `portal.swiftaerialmedia.com` | custom domain | Swift Aerial Media `00000000-0000-0000-0000-000000000001` |
| `test-pilot-drones.shootportal.app` | slug subdomain | Test Pilot Drones `00000000-0000-0000-0000-0000000000aa` |
| `shootportal.app` | platform apex | none (ShootPortal chrome) |

Auth is one global Supabase user pool. The Host header never grants data access.

## Platform console (`/platform`)

Super-admin only. Enforced in middleware **and** every `/platform` server component / `/api/platform/*` route handler (`requireSuperAdminPage` / `requireSuperAdminApi`). Business admins hitting those APIs directly receive 403.

`/admin` is the business admin area. A `super_admin` with no impersonation cookie is redirected to `/platform?notice=impersonate` (not `/dashboard`). With a signed `sa_business_context` cookie they use `/admin` as that business.

Onboarding a business is `POST /api/platform/businesses` (`createBusinessForPlatform`): businesses row, `business_settings` seeded with `senderMode='platform'` and empty `senderEmail`, Stripe `not_connected`, starter `business_services`, invite via Auth metadata `business_id` (never `client_id`). `business_stages` does not exist yet.

## Impersonation

Cookie `sa_business_context` is HMAC-SHA256 (`v1.<payload>.<hex>`), httpOnly, 30 minutes, signed with `PLATFORM_SESSION_SECRET` (fallback `CRON_SECRET`). Unsigned UUIDs are rejected. The cookie is **only read when `profile.role === 'super_admin'`**.

Read-only by default. Writes require an audit-logged `allow_writes` toggle that expires with the session. Enforced in middleware (mutating HTTP methods), and in `createTenantServiceClient` insert/update/delete/upsert.

`current_business_id()` still honours `app.impersonated_business_id` (v31b). PostgREST is one statement per transaction, so the app cannot persist `SET LOCAL` across JS queries. Tenant data access for impersonation is the signed cookie + `.eq("business_id", tenant.businessId)` / `createTenantServiceClient`. The GUC is proven in-database via `peek_impersonated_current_business_id(uuid)` (v44, same statement as `set_config`).

v44 `platform_audit_log` is append-only: SELECT for `is_super_admin()` only; no UPDATE/DELETE policies; INSERT revoked from `authenticated`.

## Tenant resolution

**Authenticated data** — `getTenantContext()` (`src/lib/tenant.ts`), request-scoped via `React.cache`:

1. `super_admin` — only a **signed** httpOnly `sa_business_context` cookie. Forged, unsigned, expired, or non-super_admin cookies are ignored. No cookie → no tenant.
2. Everyone else — `profiles.business_id`, else `clients.business_id` via `profiles.client_id`, else `clients.business_id` via `clients.user_id`. Never `?? LEGACY_DEFAULT_BUSINESS_ID`.

**Public chrome and signup** — `resolveRequestHost()` (`src/lib/host-resolution.ts`), copied onto request headers by `src/proxy.ts`:

1. Exact `businesses.custom_domain`
2. First label under `PLATFORM_ROOT_DOMAIN` matching `businesses.slug` (not reserved)
3. Path `/b/{slug}` (local / preview)
4. Apex → platform
5. Unmatched → platform chrome; logged-in users keep profile tenant

A logged-in user on another business’s host is redirected to their own canonical origin (`getLoginRedirectOrigin(..., { foreignTenantHost: true })`). Without that flag, a business that has no `custom_domain` used to stay on any host that is not `*.shootportal.app`, including Swift’s custom domain. Public `/api/request` uses the host; a body `business_id`/`slug` that disagrees is rejected.

## Data model

Every business-owned table has `business_id NOT NULL` (except `profiles`, where `super_admin` is NULL). v35 dropped column defaults — omitting `business_id` on INSERT fails closed.

Isolation layers:

1. **RLS** — `is_super_admin() OR (is_admin() AND business_id = current_business_id())` plus client policies via `get_user_client_id()` / `client_has_project_access()`.
2. **`createTenantServiceClient(businessId)`** — service role bypasses RLS; the wrapper re-applies `business_id` on `from()`. Use `.raw` only for `profiles`, `businesses`, `processed_stripe_events`, Auth, Storage, RPC.
3. **`enforce_same_business` triggers** (v30 + v43 `projects.service_id`) — not bypassed by the service role. NULL parents are allowed where the schema allows them (`media_assets.project_id`, etc.).

Platform tables without tenant rows: `processed_stripe_events`, `platform_audit_log` (v44, super_admin SELECT only), `plans` (v45 entitlement catalog; super_admin manage + authenticated read of active plans), `platform_email_templates` (v53 lifecycle copy/timing catalog; super_admin only — no `business_id` by design), leftover singletons `app_settings` and `google_calendar_connections` (RLS on, zero policies — fail closed). Live config is `business_settings` and `google_calendar_connections_v2`. `platform_email_sends` (v53) has `business_id` but is platform operational log (super_admin SELECT only). `partners` / `partner_applications` (v58) are platform-scoped with **no** `business_id`. `partner_referrals` (v59) **has** `business_id NOT NULL` (UNIQUE) — attribution join from partner → business, written once at create; RLS super_admin only (same family as `platform_email_sends`, not in BUSINESS_OWNED_TABLES). `partner_commissions` (v60) is an append-only platform ledger with **nullable** `business_id` (ON DELETE SET NULL so history survives tenant delete — intentional SQL-audit exception) and FK to `platform_subscription_payments`; RLS super_admin + partner-own SELECT. `partner_payouts` (v61) is platform-scoped with **no** `business_id` (manual payouts; partners SELECT own; super_admin manage). `partner_landing_pages` (v62) is platform-scoped with **no** `business_id` (custom apex landings; super_admin manage).

## Standing rule for every new table

1. `business_id uuid NOT NULL REFERENCES businesses(id)` — no DEFAULT.
2. RLS enabled with `current_business_id()` (not global `is_admin()`).
3. `enforce_same_business` trigger for every parent FK that itself has `business_id`.
4. Application writes go through `createTenantServiceClient` or cookie RLS **plus** `.eq("business_id", …)`.
5. `npm run tenant-lint` and `supabase/tests/tenant-sql-audit.sql` must stay green.
6. Extend `supabase/tests/tenant-isolation.sql` with a read + write assertion.

**Intentional exceptions (no `business_id`):** platform-scoped tables that are not tenant data —
`processed_stripe_events`, `platform_audit_log`, `plans` (v45 subscription catalog),
`platform_email_templates` (v53 ShootPortal→business lifecycle copy), and
`partners` / `partner_applications` (v58 Partner Program accounts). Plans are
shared ShootPortal product definitions; every business points at `plans.key` via `businesses.plan`.
Lifecycle templates are platform-scoped the same way — they have no `business_id`.
`partner_payouts` (v61) is also platform-scoped with no `business_id`.
`partner_landing_pages` (v62) is platform-scoped with no `business_id` (apex `/\{slug\}` only).

**Attribution join (has `business_id`, not tenant CRM):** `partner_referrals` (v59) links a
platform partner to exactly one business (`UNIQUE(business_id)`). Written once at business
creation via `attribute_partner_referral()`. Not added to `BUSINESS_OWNED_TABLES`.

**Commission ledger (nullable `business_id`):** `partner_commissions` (v60) is append-only.
Reversals are new negative rows. `business_id` may be NULL after tenant delete. Idempotency:
one `commission` per `subscription_payment_id`; one `reversal` per `stripe_refund_id`.
Manual `adjustment` rows (v61) may omit `subscription_payment_id` but require `note` + `created_by`.
`partner_payouts` (v61) stamps `payout_id` onto all currently-payable ledger rows in one transaction.

## Plans & entitlements (v45)

`businesses.plan` is TEXT FK’d to `plans.key` (plus a trigger that rejects unknown keys). No Stripe
subscriptions, trials, or proration in this layer — entitlements only.

Enforced today (server-side): `custom_branding`, `custom_services`, `custom_domain`. All other
entitlement flags are catalog-only and marked “not yet enforced” in `/platform/plans`.

Helpers: `getBusinessPlan` / `hasEntitlement` / `getPlanLimits` in `src/lib/entitlements.ts`
(React `cache()`, fail closed on unknown or inactive plans).

## Onboard a business end to end

Prefer **Platform → Create a business**. The SQL runbook below is the same sequence the console runs.

1. Insert `businesses` (`slug` not reserved, `status='active'`). App + v41 trigger both reject reserved labels.
2. Seed `business_settings` from `DEFAULT_APP_SETTINGS`, `business_services` from the v40 catalog, Stripe Connect if they will take payments.
3. Create the first admin (`auth.users` + `profiles.role='admin'` + `profiles.business_id`).
4. Wildcard: `https://{slug}.shootportal.app`. Optional custom domain: DNS + Vercel + `businesses.custom_domain`.
5. Confirm `/api/request` stamps that `business_id` on client, project, profile, lead.
6. Confirm a client of another business is redirected to **their** origin.
7. Smoke: settings save, one CRM insert, one media upload, one payment link.

## Remaining `LEGACY_DEFAULT_BUSINESS_ID` uses (justified)

The constant is Swift’s production UUID. It is **not** a fail-open default (`?? LEGACY_DEFAULT_BUSINESS_ID` in `src/` is lint-fail).

| Site | Why it stays |
|---|---|
| `src/lib/tenant.ts` | Export of Swift’s id |
| `src/lib/stripe-connect.ts` `isPlatformStripeBusiness` | Swift charges the platform Stripe account; others use Connect |
| `src/lib/ghl/sync-portal-lead.ts` | Swift-only env webhook fallback when settings URL is empty |
| `src/lib/onesignal-push.ts` | Untagged devices (pre-prompt 11) treated as Swift **on send filters only**, AND’d with that business’s admin `external_id`s |

## TODOs

- `src/app/opengraph-image.tsx` — per-business OG/PWA is a later product phase, not an isolation hole. Documented in-file.
- `TODO(tenant):` on `client-portal-link.ts` is **done**: profiles are refused when `business_id` belongs to another tenant; admins are not demoted.
- `TODO(stages):` — none in `src/`.

## Singleton tables (no v43 drop)

`app_settings` and `google_calendar_connections` are unused in `src/`. Successors (`business_settings` v33, `google_calendar_connections_v2` v34) have been live since 2026-08-18. That is not a meaningful production period. **Do not drop them yet.** v43 is `projects.service_id` integrity. v44 is `platform_audit_log` + `peek_impersonated_current_business_id`. v45 is `plans` + `businesses.plan` FK.

## Dual-hat profiles

`role='admin'` with `client_id` set means the same auth user is a business admin **and** a CRM client.

Live: `cannon@swiftaerialmedia.com` (Swift). `myt.21.21@gmail.com` is `role='client'` (not admin).

**Proposed fix that does not change access:** leave dual-hat rows. Add an operator note / future check constraint that `client_id` on an admin must point at a client in the **same** `business_id`. Do not NULL `client_id` or flip `role` — that would lock Cannon out of whichever side they still use. Portal-link will not demote admins and will not attach another business’s profile.

## Signed URLs (8 call sites)

| Site | Guard |
|---|---|
| `media/download/[id]` | Tenant `from()` + `asset.business_id === tenant.businessId` |
| `media/bulk` | Same per id |
| `media/upload/sign` | Project must exist in caller business; path tenant-prefixed |
| `project-zip-download` | Tenant `from()` then `db.raw.storage` |
| `cover.ts` | `.eq("business_id", businessId)` before `createSignedUrl`. Injected client — callers pass `tenant.businessId` |
| `upload/storage-verify.ts` | Existence probe only. Single caller: upload complete, after `isTenantPrefixedStoragePath` |

## Pre-merge checklist

- [ ] `npm run tenant-lint`
- [ ] `supabase/tests/tenant-sql-audit.sql` → `TENANT SQL AUDIT PASSED`
- [ ] `supabase/tests/tenant-isolation.sql` (then teardown: zero rows for `…0000ff` and `…0000cc`)
- [ ] `npx tsx scripts/tenant-pentest.ts` → all attempts blocked
- [ ] New-tenant settings save (Part D.1) and NULL-parent inserts (Part D.2)
- [ ] `npm run typecheck && npm run build && npm run lint`
- [ ] No new `createServiceClient()` outside the lint allowlist
- [ ] No `?? LEGACY_DEFAULT_BUSINESS_ID` on authenticated paths
- [ ] No Swift / Jackson / phone literals in `src/` outside documented fallbacks
- [ ] Full lifecycle on Swift (request → pay → ZIP) and one **pre-migration** Swift project (legacy storage path, historical quote/payment, legacy status enum)
