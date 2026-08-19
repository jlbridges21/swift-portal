# Tenant domains

The URL determines **branding and new-signup attribution only**. It never grants access to data. Supabase Auth is a single global user pool. An authenticated user’s business always comes from their profile (`profiles.business_id` / client hop), never from the Host header. If a logged-in admin or client is on another business’s host, the proxy redirects them to their own portal origin and does not serve the host’s tenant UI.

Platform chrome (apex `shootportal.app`, unmatched Vercel preview URLs, unknown hosts) is ShootPortal. Tenant chrome is that business’s settings and landing assets.

## Resolution order

Resolved once in `src/proxy.ts` → `updateSession` (`src/lib/supabase/middleware.ts`) via `resolveRequestHost` (`src/lib/host-resolution.ts`). The result is copied onto **request** headers (`x-sp-host-kind`, `x-sp-business-id`, `x-sp-business-slug`, `x-sp-business-status`, `x-sp-resolve-source`) using `NextResponse.next({ request: { headers } })` / `rewrite` as documented in Next.js 16 `proxy.md`. Incoming client values for those header names are overwritten every time.

Server Components and route handlers read the headers with `getPublicHostContext()` (`headers()` from `next/headers`). Authenticated data paths keep using `getTenantContext()` (profile). Do not put tenant identity in `'use cache'`.

Lookup cache: in-memory Map, **30s TTL**, keys `custom:{host}`, `slug:{slug}`, `id:{uuid}`. A miss or hit for host A cannot be served as host B.

| Step | Match | Result |
|---|---|---|
| **a** | Exact `businesses.custom_domain` (lowercase host, port stripped). Swift: `portal.swiftaerialmedia.com`. | That business (including `status='suspended'`, so public pages can explain). Soft-deleted rows are ignored. |
| **b** | First DNS label under `PLATFORM_ROOT_DOMAIN` (default `shootportal.app`) **equals `businesses.slug` exactly**. | That business. `test-pilot-drones.shootportal.app` → Test Pilot Drones (`slug = test-pilot-drones`). `testpilot.shootportal.app` does **not** match. Reserved labels (`www`, `app`, `api`, `mail`, `admin`, `platform`, …) are never treated as slugs. |
| **c** | Path `/b/{slug}` (and `/b/{slug}/…`). Used for local development and for testing on unmatched hosts (including Vercel previews). Also honored on the platform apex. Ignored when (a) or (b) already matched. | Rewrite internally to the remainder (`/b/swift-aerial-media/login` → `/login`) so existing routes run. Sets httpOnly cookie `sp_path_tenant` so `/api/request` and `/api/catalog/services` keep the same tenant after the path is rewritten. The cookie is **not** used for HTML pages — `http://localhost:3000/` after visiting `/b/{slug}` is still the platform landing. `/b/nonexistent` is the platform, not Swift, and clears that cookie. |
| **d** | Apex `shootportal.app` or `www.shootportal.app` with no `/b/{slug}`. | **Platform**, not a tenant. Minimal ShootPortal landing. |
| **e** | No match (Vercel `*.vercel.app` previews, unknown hosts, bare `localhost` without `/b/` or cookie). | **Unmatched.** Authenticated users continue with profile tenant context (same as today). Public pages show the **platform** landing, not a 404 and not Swift. |

## Wildcard DNS (already in place)

`*.shootportal.app` points at the Vercel project that serves this app. No per-tenant DNS is required for `{slug}.shootportal.app`.

Env:

- `PLATFORM_ROOT_DOMAIN=shootportal.app`
- Resend: platform domain verified
- Stripe Connect branding: ShootPortal

## Custom domain (existing Swift pattern)

Swift Aerial Media already has `custom_domain = 'portal.swiftaerialmedia.com'` (migration v29). That exact host is step (a) and must keep working: landing, login, dashboard, project, media download. PWA `start_url` and `scope` stay `/` on that host (`src/app/manifest.ts`); do not change them for an existing custom domain.

To attach another business’s own hostname:

1. **Registrar:** CNAME (or A/ALIAS per Vercel) from the customer hostname to the Vercel target for this project.
2. **Vercel:** Project → Domains → add the hostname (and wait for HTTPS).
3. **Database:** set `businesses.custom_domain` to the hostname only (no scheme), unique, e.g. `portal.example.com`.
4. Confirm step (a) resolves before cutting over email/push links.

## Onboard a new tenant end to end

1. Insert `businesses` with unique `slug` (DNS label), `name`, `status='active'`.
2. Seed `business_settings`, `business_services`, Stripe/email as in earlier prompts.
3. Create the first admin `profiles` row with that `business_id`.
4. Wildcard: open `https://{slug}.shootportal.app` — branded landing, login, request form.
5. Optional custom domain: registrar + Vercel + `custom_domain` as above.
6. Local: `http://localhost:3000/b/{slug}` for landing / login / request.
7. Confirm public `/api/request` stamps `clients`, `projects`, `profiles.business_id`, and the preliminary estimate on **that** business.
8. Confirm a client of another business who visits this host is redirected to **their** origin (`custom_domain` or `{slug}.{PLATFORM_ROOT_DOMAIN}`).
9. Suspend: `status='suspended'` — public pages show unavailable; admins/clients cannot complete login. Reactivate to restore.

## Portal URLs in email, push, and Stripe

`getBusinessPortalOrigin` (`src/lib/portal-url.ts`): `https://{custom_domain}` or `https://{slug}.{PLATFORM_ROOT_DOMAIN}`.

Used for notification email CTAs, OneSignal URLs, GHL portal links, Stripe Checkout success/cancel (customer-facing), and workflow `portal_link` variables.

`NEXT_PUBLIC_APP_URL` remains the **deployment** origin (this Vercel preview/production URL). It is still used for OAuth-style callbacks that must return to the running app: Stripe Connect onboarding, Google Calendar OAuth, sign-out fallback, and `getSiteUrl()` / root `metadataBase` (platform chrome).

## Next.js 16 notes verified in `node_modules/next/dist/docs`

- File convention is `src/proxy.ts` (middleware renamed). Runtime is Node.js, not Edge.
- Pass data with request headers via `NextResponse.next({ request: { headers } })`, not `NextResponse.next({ headers })` (that would expose them to the client).
- `headers()` in Server Components is async.
- `React.cache` is request-scoped; do not use `'use cache'` for host identity.
