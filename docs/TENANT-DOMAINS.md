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
| **b** | First DNS label under `PLATFORM_ROOT_DOMAIN` (default `shootportal.app`) **equals `businesses.slug` exactly**, and the label is **not reserved**. | That business. `test-pilot-drones.shootportal.app` → Test Pilot Drones. `testpilot.shootportal.app` does **not** match. Reserved labels (`www`, `api`, `admin`, `app`, `mail`, `smtp`, `ftp`, `cdn`, `static`, `assets`, `status`, `help`, `support`, `docs`, `blog`, `platform`, `dashboard`) never resolve to a tenant — they are the platform (`api.shootportal.app` shows ShootPortal, not a business). |
| **c** | Path `/b/{slug}` (and `/b/{slug}/…`). Used for local development and for testing on unmatched hosts (including Vercel previews). Also honored on the platform apex. Ignored when (a) or (b) already matched. | Rewrite internally to the remainder (`/b/swift-aerial-media/login` → `/login`) so existing routes run. Sets httpOnly cookie `sp_path_tenant` so `/api/request` and `/api/catalog/services` keep the same tenant after the path is rewritten. The cookie is **not** used for HTML pages — `http://localhost:3000/` after visiting `/b/{slug}` is still the platform landing. `/b/nonexistent` is the platform, not Swift, and clears that cookie. |
| **d** | Apex `shootportal.app` or `www.shootportal.app` with no `/b/{slug}`. | **Platform**, not a tenant. Minimal ShootPortal landing. |
| **e** | No match (Vercel `*.vercel.app` previews, unknown hosts, bare `localhost` without `/b/` or cookie). | **Unmatched.** Authenticated users continue with profile tenant context (same as today). Public pages show the **platform** landing, not a 404 and not Swift. |

## Wildcard DNS (already in place)

`*.shootportal.app` points at the Vercel project that serves this app. No per-tenant DNS is required for `{slug}.shootportal.app`.

Env:

- `PLATFORM_ROOT_DOMAIN=shootportal.app`
- Resend: platform domain verified
- Stripe Connect branding: ShootPortal

## Custom domain (self-serve)

Businesses with the `custom_domain` entitlement connect a hostname in **Settings → Custom Domain**.

Flow:

1. Enter a hostname (recommend `portal.yourstudio.com`; apex is supported as advanced via A record).
2. App registers the hostname on the Vercel project via REST API (`POST /v10/projects/.../domains`).
3. Show exact DNS records (CNAME or A, plus TXT if ownership verification is required).
4. **Check status** polls `GET /v9/.../domains/{domain}`, `POST .../verify`, and `GET /v6/domains/{domain}/config`.
5. On connected: `businesses.custom_domain` is already set (since claim); status columns mark `connected`. Portal URLs from `getBusinessPortalOrigin` switch automatically.
6. Remove clears DB and `DELETE /v9/projects/.../domains/{domain}` on Vercel.

### Env (required for automatic Vercel registration)

| Variable | Purpose |
|----------|---------|
| `VERCEL_API_TOKEN` | Bearer token (prefer project-scoped) |
| `VERCEL_PROJECT_ID` | Project id / name |
| `VERCEL_TEAM_ID` | Team id when the project is under a team |

If any are missing, the UI still shows DNS instructions and a contact-support / platform-admin path (`status=manual`) — never a broken screen.

### Auth redirect allow-list (critical)

`https://*.shootportal.app/**` does **not** cover a customer hostname. After connect, add to Supabase Auth → URL Configuration → Redirect URLs:

```text
https://{custom_domain}/auth/confirm
```

Also keep `https://*.shootportal.app/auth/confirm`. Without the custom entry, password reset / invite / confirm emails break for clients on that domain even though the portal loads over HTTPS. There is no safe wildcard for arbitrary customer domains; operators must add each connected hostname (or automate via Supabase Management API with a personal access token — not implemented in-app by default).

### Operator / legacy manual path

1. Registrar DNS → Vercel target.
2. Vercel project Domains → add hostname (or self-serve API).
3. `businesses.custom_domain` = hostname (unique).
4. Supabase redirect allow-list entry as above.

Swift (`portal.swiftaerialmedia.com`) already uses step (a) and must keep working; migration v55 backfills existing domains as `connected`.

## Onboard a new tenant end to end

1. Insert `businesses` with unique `slug` (DNS label), `name`, `status='active'`. The slug must not be a reserved platform subdomain (see below); create/edit goes through `validateBusinessSlug` / `parseBusinessSlugOrThrow` in `src/lib/reserved-subdomains.ts`, and Postgres rejects reserved values with the same message.
2. Seed `business_settings`, `business_services`, Stripe/email as in earlier prompts.
3. Create the first admin `profiles` row with that `business_id`.
4. Wildcard: open `https://{slug}.shootportal.app` — branded landing, login, request form.
5. Optional custom domain: registrar + Vercel + `custom_domain` as above.
6. Local: `http://localhost:3000/b/{slug}` for landing / login / request. `/b/www` (and other reserved labels) is the platform page, not a tenant.
7. Confirm public `/api/request` stamps `clients`, `projects`, `profiles.business_id`, and the preliminary estimate on **that** business.
8. Confirm a client of another business who visits this host is redirected to **their** origin (`custom_domain` or `{slug}.{PLATFORM_ROOT_DOMAIN}`).
9. Suspend: `status='suspended'` — public pages show unavailable; admins/clients cannot complete login. Reactivate to restore.

## Reserved subdomains

These labels are never tenant slugs. Host resolution skips them; `businesses.slug` insert/update is rejected (migration v41).

`www`, `api`, `admin`, `app`, `mail`, `smtp`, `ftp`, `cdn`, `static`, `assets`, `status`, `help`, `support`, `docs`, `blog`, `platform`, `dashboard`

Keep `src/lib/reserved-subdomains.ts` and `supabase/migration-v41-reserved-subdomains.sql` in sync.

## Portal URLs in email, push, and Stripe

`getBusinessPortalOrigin` (`src/lib/portal-url.ts`): `https://{custom_domain}` or `https://{slug}.{PLATFORM_ROOT_DOMAIN}`.

Used for notification email CTAs, OneSignal URLs, GHL portal links, Stripe Checkout success/cancel (customer-facing), and workflow `portal_link` variables.

`NEXT_PUBLIC_APP_URL` remains the **deployment** origin (this Vercel preview/production URL). It is still used for OAuth-style callbacks that must return to the running app: Stripe Connect onboarding, sign-out fallback, and `getSiteUrl()` / root `metadataBase` (platform chrome).

> **2026-08-25:** Google Calendar OAuth callbacks were removed with the Calendar integration. Supabase Auth Google sign-in uses `/auth/callback` on allowlisted origins instead.

## Next.js 16 notes verified in `node_modules/next/dist/docs`

- File convention is `src/proxy.ts` (middleware renamed). Runtime is Node.js, not Edge.
- Pass data with request headers via `NextResponse.next({ request: { headers } })`, not `NextResponse.next({ headers })` (that would expose them to the client).
- `headers()` in Server Components is async.
- `React.cache` is request-scoped; do not use `'use cache'` for host identity.
