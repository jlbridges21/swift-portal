# ShootPortal tenant architecture

Final model after prompts 1–19 plus this hardening pass. Production hosts:

| Host | Kind | Business |
|---|---|---|
| `portal.swiftaerialmedia.com` | custom domain | Swift Aerial Media `00000000-0000-0000-0000-000000000001` |
| `test-pilot-drones.shootportal.app` | slug subdomain | Test Pilot Drones `00000000-0000-0000-0000-0000000000aa` |
| `shootportal.app` | platform apex | none (ShootPortal chrome) |

Auth is one global Supabase user pool. The Host header never grants data access.

## Tenant resolution

**Authenticated data** — `getTenantContext()` (`src/lib/tenant.ts`), request-scoped via `React.cache`:

1. `super_admin` — only the httpOnly `sa_business_context` cookie (a business UUID). No cookie → no tenant. Forging this cookie as `admin`/`client` is ignored.
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

Platform tables without tenant rows: `processed_stripe_events`, leftover singletons `app_settings` and `google_calendar_connections` (RLS on, zero policies — fail closed). Live config is `business_settings` and `google_calendar_connections_v2`.

## Standing rule for every new table

1. `business_id uuid NOT NULL REFERENCES businesses(id)` — no DEFAULT.
2. RLS enabled with `current_business_id()` (not global `is_admin()`).
3. `enforce_same_business` trigger for every parent FK that itself has `business_id`.
4. Application writes go through `createTenantServiceClient` or cookie RLS **plus** `.eq("business_id", …)`.
5. `npm run tenant-lint` and `supabase/tests/tenant-sql-audit.sql` must stay green.
6. Extend `supabase/tests/tenant-isolation.sql` with a read + write assertion.

## Onboard a business end to end

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

`app_settings` and `google_calendar_connections` are unused in `src/`. Successors (`business_settings` v33, `google_calendar_connections_v2` v34) have been live since 2026-08-18. That is not a meaningful production period. **Do not drop them yet.** v43 is `projects.service_id` integrity only.

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
