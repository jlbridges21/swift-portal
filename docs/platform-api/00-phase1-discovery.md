# Platform API: Phase 1 discovery report

> **Status:** Phase 1 (read and understand). No code, config or database changes have been made.
> **Audience:** Jackson. **Internal only.** This file holds no partner-confidential business details (no fundraising, no roadmap internals, no commercial strategy); those stay in `Call Notes/`.
> **Date:** 2026-11-03

## Contents
1. [What we're building, in plain English](#1-what-were-building-in-plain-english)
2. [How ShootPortal works today (codebase map)](#2-how-shootportal-works-today-codebase-map)
3. [Gap analysis against the File 03 proposal](#3-gap-analysis-against-the-file-03-proposal)
4. [Where I disagree with or would simplify File 03](#4-where-i-disagree-with-or-would-simplify-file-03)
5. [Things found along the way (fix before an API exists)](#5-things-found-along-the-way-fix-before-an-api-exists)

---

## 1. What we're building, in plain English

**The problem today.** When a SkyyTask pilot finishes a job, they tap *Complete Job*, generate an OTP code, and paste a Google Drive link. The client gets an alert, types the code, and leaves SkyyTask for an unbranded Drive folder. Nobody can see whether the client opened it, and the experience doesn't look like a product.

**The idea.** ShootPortal already does the hard part (organized, branded, per-section media delivery with a client portal). What it doesn't have is a **door that another company's software can open**. We'll build that door as a general product, the **ShootPortal Platform API**:

1. The partner's **server** tells ShootPortal: "here's a job; here's the client; here's the pilot." ShootPortal creates a project.
2. The partner's **app** opens a short-lived, **branded ShootPortal upload screen** for that one job. The pilot uploads (phone or desktop, large files, resumable) and taps *Submit delivery*.
3. ShootPortal shows the **end client** a branded portal with only the media (no quotes, invoices or payments) and, depending on the partner's choice, emails them or lets the partner notify them in its own chat.
4. ShootPortal **calls the partner's server back** (webhooks) at each step: submitted, published, viewed, downloaded. The partner uses these to move job states and trigger pilot payouts.

**What SkyyTask needs:** delivery, organization and client tracking only. It must feel native inside their app, tied to their job number, and work both for automated marketplace jobs and for hand-run enterprise jobs, where their own staff use the normal ShootPortal UI in a "delivery-only" mode.

**What ShootPortal gets:**
- Paid usage: a per-delivery price with a monthly minimum (File 05), so partner volume covers its own storage and bandwidth.
- A "Powered by ShootPortal" mark in front of every recipient and pilot.
- A path for pilots to start their own ShootPortal account.
- A reusable product for any other platform (drone networks, real estate media marketplaces, inspection platforms, Zapier users).

**What must stay generic:** every part. SkyyTask is one business row with config (logo, colors, domain, pricing plan, notification choice, webhook URL, keys). No `if partner === 'skyytask'` anywhere. A second partner should need **zero code changes**, only new rows.

---

## 2. How ShootPortal works today (codebase map)

**Stack:** Next.js 16 (App Router; `src/proxy.ts` is the middleware), Supabase (Postgres + Auth + Storage), Stripe, Resend, Web Push, deployed on Vercel with 8 Vercel crons (`vercel.json`). Migrations are **hand-run SQL files** in `supabase/` (`schema.sql` + `migration-vN-*.sql`, now at v109). No Supabase edge functions. No test framework; tests are `scripts/verify-*.ts` run with `npx tsx`.

### 2.1 Tenants, people and projects
| Concept | Where | How it works |
|---|---|---|
| **Tenant = `businesses`** | `supabase/migration-v29-businesses.sql:30` | `id, slug, status, custom_domain, plan, deleted_at`, plus subscription columns (v46), owner (v92). Swift is `…0001`. |
| **People = one global auth pool + `profiles`** | `supabase/schema.sql:32`, v29, v90b | `profiles.role` ∈ `admin / staff / client / super_admin`, `profiles.business_id`, `profiles.client_id`. "One person = one business." |
| **Clients** | `schema.sql:43` | CRM row per business; linked to a login by `clients.user_id` and/or `profiles.client_id`. |
| **Projects** | `schema.sql:75` | `property_address` + `property_id → properties`, `service_id → business_services`, `status` (8 canonical values in `src/lib/constants.ts:1-10`: new_request → … → ready_for_review → awaiting_payment → delivered). **No generic `external_id` or `metadata` column.** |
| **Project ↔ clients / staff** | `project_clients` (v3), `project_staff` (v90b) | Many clients per project (`is_primary`); staff assignment. |

### 2.2 Isolation and auth
- **Rule for every table** (`docs/TENANT-ARCHITECTURE.md`): `business_id NOT NULL` (no default), RLS via `current_business_id()`, `enforce_same_business` triggers on parent FKs (v30), writes through `createTenantServiceClient(businessId)` (`src/lib/supabase/tenant-service.ts`), which auto-stamps and auto-filters `business_id`.
- **SQL helpers:** `is_super_admin()`, `current_business_id()`, `get_user_client_id()`, `client_has_project_access()` (v31b); staff helpers (v91).
- **Storage paths:** `{business_id}/{project_id}/{ts}-{uuid}-{name}` (v36, `buildStoragePath` in `src/lib/media-upload.ts:51`).
- **Tenant resolution:** data access comes from the **logged-in profile** (`getTenantContext`, `src/lib/tenant.ts`); the host (`resolveRequestHost`, `src/lib/host-resolution.ts`) only picks branding/chrome.
- **Login:** password, Google OAuth, invite links (`/auth/confirm`). No magic-link sign-in for clients.
- **Passwordless access (relevant to recipients):** email share invites `project_shares` (v81/v82, hashed tokens), "anyone with the link" `/view/[token]` (v82), single-photo and folder shares (v104/v105), cross-domain session handoffs (v68).
- **API gate today:** `requireAdminApi()` (`src/lib/api-auth.ts`) reads the cookie session. **No API keys or machine auth exist.**
- **Isolation tests:** `npm run tenant-lint`, `scripts/tenant-pentest.ts`, `supabase/tests/tenant-isolation.sql` (manual runs).

### 2.3 Media and the "visible to clients" toggles
- **Files:** `media_assets` (`schema.sql:91`), `media_type` = photo / video / document, with `file_size BIGINT` (so delivery size can be summed), `visibility`, `folder_id`, `download_count`. 360 tours (`tours`) and 3D models (`project_3d_models`, v89) are **embed links, not files**.
- **Toggles:** per-project `client_section_photos / videos / tours / documents / models` (v88, v89); defaults from `business_settings.mediaSectionDefaults`. Logic in `src/lib/project-media-sections.ts`; enforced in pages **and** download/thumbnail/ZIP routes. Admin UI: `src/components/admin/project-detail.tsx:384`.
- **Estimates, proposals, payments cannot be hidden per project.** They're gated only by viewer role (`src/lib/project-page-access.ts:5`).
- **Download gate:** `requireDeliveredForDownloads` (v80, default **on**) only allows downloads at status `delivered`, which normally means *paid* (`src/lib/deliverables.ts`).

### 2.4 Storage and uploads
| Bucket | Public | Size cap | Types |
|---|---|---|---|
| `project-media` | no | 2 GB (v2) | jpeg/png/webp/mp4/mov/m4v/octet-stream (v20) |
| `project-documents` | no | 500 MB | **pdf, zip only** |
| `avatars`, `business-logos` | yes | 5 MB | images |

- **Upload flow:** `POST /api/media/upload/sign` (admin session) → browser uploads directly to Supabase: signed PUT for ≤ 6 MB, **TUS resumable** above that (`src/lib/upload/media-upload-client.ts`, 6 MB chunks), authenticated with **the admin's Supabase JWT** → `POST /api/media/upload/complete` (idempotent on `file_path`) inserts `media_assets` and fires `deliverables_ready`.
- **Limits disagree:** app allows video 5 GB (`src/lib/upload/constants.ts`), bucket allows 2 GB, `brand.ts` says 2 GB.
- **Resume after reload doesn't work** (resume state lives only in React state).
- **Thumbnails** are made **in the browser**; no server transcoding (no Mux/HLS).
- **Downloads:** `?file=1` streams the whole file **through the Next.js function**. The project ZIP (`src/lib/project-zip-download.ts`) skips files > 400 MB and has a 300 s limit.

### 2.5 Request form, project creation, notifications
- **`/request`:** `POST /api/request` (`src/app/api/request/route.ts`) is the closest existing "outside system creates a project" path. The tenant comes from the host. It creates auth user → client → profile → project → lead → activity → notifications → preliminary estimate → GHL sync, **all inline**. The logged-in variant duplicates it. There's no reusable `createProject()` service.
- **Admin create:** `POST /api/projects` (manual validation, no zod).
- **Email:** Resend via `sendBrandedEmail` (`src/lib/email.ts`); the sender displays the **business name** (platform domain unless the tenant verified a custom domain); sender policy (`src/lib/email-sender-policy.ts`). Client emails go through `notifyProjectClients` → `client-email-event-map.ts` (`deliverables_ready` = "Your deliverables are ready to review"). Dedup via `client_notification_claims` (v102).
- **Push:** Web Push (v109, `src/lib/web-push.ts`); OneSignal legacy. Push is **admins only**.

### 2.6 Branding and domains
- Branding lives in JSON at `business_settings.settings.business.*` (colors, logos, surface mode). Theme is derived by `deriveBrandTheme` (`src/lib/brand-color.ts`) and injected by `BrandProvider`.
- Custom domains are verified through Vercel (v55, `src/lib/custom-domain.ts`); slug subdomains go under `shootportal.app`; the portal URL comes from `src/lib/portal-url.ts`. Branding/domain features are plan-entitlement gated (`src/lib/entitlements.ts`).
- **There's no "Powered by ShootPortal" mark** in the tenant portal today.

### 2.7 Billing, partner program, platform console
- **SaaS billing:** `plans` (v45) + entitlements; Stripe subscriptions; mode-aware test/live Stripe IDs (v50, mode comes from the key prefix in `src/lib/stripe.ts:23`); trials; comped access; paywall in middleware (402 on API). **No usage-based or metered billing.**
- **Partner program (affiliates):** `partners`, `partner_referrals`, `partner_commissions` (30% default, append-only ledger), Stripe Connect Express payouts, 90-day signed `sp_partner_ref` cookie (`src/lib/partner-referral.ts`). The Swift commission exclusion is data-driven (`partners.commission_eligible`, v108).
- **Platform console** (`/platform`, `super_admin` only): businesses, impersonation (signed cookie, read-only by default), plans, revenue, partners, audit log (`platform_audit_log`, v44).
- **Crons:** `assertCronAuthorized` (Bearer `CRON_SECRET`). The every-minute cron + batch table pattern (`video_review_notification_batches`, v79) is the closest thing to a job queue.
- **Inbound webhooks:** Stripe (4 endpoints) and Resend, deduplicated via `processed_stripe_events`.
- **No outbound webhook system.** GHL sync is a single unsigned `fetch` with no retries.
- **Rate limiting:** in-memory, per serverless instance (best effort only).

### 2.8 ShootPortal brand assets (for Phase 6)
- **Logos:** `public/icons/sp-logo-primary.png` (2172×724 wordmark on white), `sp-logo-white.png`, `sp-app-icon.png`, `sp-icon-512.png`. **All PNG; no SVG logo found.**
- **Colors, per `docs/ShootPortal_Brand_Source_of_Truth.docx` and the code:** Portal Indigo **`#4F46E5`**, Midnight **`#0F172A`**, Slate 600 `#475569`, Cloud `#F8FAFC`, Slate 200 `#E2E8F0`, hover `#4338CA`, violet `#7C3AED`, indigo wash `#EEF2FF` (`src/app/(marketing)/marketing.css:27-35`).
- **Font:** Inter (`src/app/layout.tsx`, `public/fonts/Inter-*.ttf`).
- ⚠️ **Mismatch with your notes:** `#3E2EE7` and `#9C94FF` appear **nowhere** in the code or brand doc. See Q-brand in the chat reply.
- The SkyyTask logo already exists at `public/icons/SKKYTASK-applogo.png` (byte-identical to the supplied file). It's used only by the public marketing page `src/app/(marketing)/strategic-partners/page.tsx`.

---

## 3. Gap analysis against the File 03 proposal

✅ exists · 🟡 partially exists · ❌ missing

| # | File 03 capability | Status | Where / notes |
|---|---|---|---|
| 1 | Organization / tenant | ✅ | `businesses`. A partner can just be a business. |
| 2 | Partner org type flag | ❌ | No `kind`/`type` column on businesses. |
| 3 | API keys (hashed, scoped, test/live, rotation) | ❌ | Nothing. Only cookie-session auth. |
| 4 | API middleware (auth, errors, request IDs, logs) | ❌ | Handlers return ad-hoc `{error}`; no request logging. |
| 5 | Idempotency-Key on POSTs | 🟡 | Inbound Stripe dedup + idempotent upload `complete`; no generic table. |
| 6 | Rate limits | 🟡 | In-memory, per-instance only. |
| 7 | `external_id` / `metadata` | ❌ | Only GHL sync columns on projects. |
| 8 | Capability profiles / delivery-only projects | 🟡 | Media section toggles exist; **no way to hide estimates, proposals, payments**; download gate tied to the paid status. |
| 9 | Create project from an outside system | 🟡 | `/api/request` does it inline from the host; no reusable service. |
| 10 | Recipients (end clients, many per project) | ✅ / 🟡 | `clients` + `project_clients` exist. Access needs an account or a share token. |
| 11 | Partner-asserted recipient access link (replaces OTP) | 🟡 | `project_shares` hashed tokens + `/view/[token]` link access exist; no API to mint one. |
| 12 | Contributors (pilots without a seat) | ❌ | Staff (v90b) are full auth users with business-wide storage access; not suitable. |
| 13 | Upload sessions (scoped, short-lived hosted upload) | ❌ | Uploads require an admin cookie session. |
| 14 | Hosted mobile-first upload UI | 🟡 | Admin upload manager + TUS client exist; tied to admin UI and session. |
| 15 | Resumable large uploads | 🟡 | TUS works; resume-after-reload doesn't; 2 GB bucket cap; TUS auth needs a user JWT. |
| 16 | Geo/thermal/mapping file types | ❌ | Bucket allowlists block TIFF, LAS/LAZ, KML/KMZ, DNG/RAW, HEIC; documents = PDF/ZIP only. |
| 17 | Integrity: checksum, MIME sniffing, virus scan | ❌ | Existence check only. |
| 18 | Delivery-only recipient portal | 🟡 | Client portal + section filtering exist; financial UI not hideable; no "Powered by". |
| 19 | Download-all ZIP | 🟡 | Exists, but skips > 400 MB files and has a 300 s cap. Not viable for 25–100 GB deliveries. |
| 20 | View / download tracking | 🟡 | `media_downloads`, `download_count`, share access timestamps, link view count; no per-delivery "first viewed/downloaded". |
| 21 | Deliveries (object with states) | ❌ | Closest is project status `ready_for_review` / `delivered`. |
| 22 | Outbound webhooks (signed, retried, logged) | ❌ | Only an unsigned GHL fetch. Pattern to copy: v79 batch table + minute cron. |
| 23 | Events list / replay | ❌ | |
| 24 | Notification ownership (`shootportal` / `partner`) | 🟡 | Full branded email pipeline + per-event toggles exist; no per-partner "don't email recipients" switch. |
| 25 | Partner branding + custom domain | ✅ | Business branding, slug subdomain, Vercel-verified custom domain, branded sender name. |
| 26 | "Powered by ShootPortal" mark | ❌ | |
| 27 | Partner staff using the UI for manual/enterprise jobs | ✅ / 🟡 | Normal admin + staff UI; needs delivery-only mode to hide commercial modules. |
| 28 | Usage metering, per-delivery tier pricing, monthly minimum | ❌ | `file_size` exists to sum; no metering or invoicing. |
| 29 | Retention policy (90 days) | ❌ | Soft delete only (v24); no expiry job. |
| 30 | Partner developer dashboard | ❌ | Platform console and partner (affiliate) dashboard exist as UI patterns to copy. |
| 31 | Audit log | 🟡 | `platform_audit_log` for super-admin actions; nothing for API calls. |
| 32 | Feature flag `platform_api_enabled` | ❌ | No flag system; plan entitlements + `business_settings` JSON are the closest. |
| 33 | Contributor "claim your workspace" + attribution | 🟡 | Affiliate attribution/commission machinery exists (cookie-based); no partner-business → referral link. |
| 34 | OAuth connected accounts (Mode B) | ❌ | |
| 35 | OpenAPI spec, docs, Postman, sandbox | ❌ | |
| 36 | Tenant isolation tests | ✅ | Lint, pentest, SQL suites. New tables must extend them. |

**Bottom line:** the delivery product (branding, portal, sections, email, storage paths, isolation) is about 70% built. The **integration surface** (keys, sessions, contributors, deliveries, webhooks, metering) is almost entirely missing. That matches your "I've already built it, right?" on the call: true for what the client sees, not yet for the door.

---

## 4. Where I disagree with or would simplify File 03

File 03 is a good north star, but it's written as if a team were building Stripe. For one founder with a Q1 2027 partner deadline, I'd cut it roughly in half. The goal stays the same: a v1 that SkyyTask can integrate against without rework later.

### Naming: two collisions in the codebase
1. **"Partner" is already taken** by the affiliate program (`partners`, `partner_referrals`, `/partner` dashboard, `src/lib/partner-*.ts`, about 40 files). Calling API integrators "partners" in code will cause real confusion and bugs. **Proposal:** in code, use `api_` / "platform account" naming (`api_keys`, `api_webhook_endpoints`…), keep the word "partner" for marketing copy, and pick one internal name together in Phase 2.
2. **"Capabilities" is already taken** by `src/lib/capabilities.ts` (which surfaces a login can reach). Don't reuse it for "capability profiles."

### Simplify (v1)
3. **Capability profiles → one project mode.** Instead of a module system with named and custom profiles, add `projects.delivery_mode` (`standard | delivery_only`) plus a business-level default. Delivery-only hides estimates, proposals, payments and the pipeline, and bypasses the paid-status download gate. Regular customers get "hide pricing on this project" for free. Custom profiles can come later if a second partner ever needs one.
4. **Test vs live = two businesses, not a `livemode` column everywhere.** File 03 suggests a `livemode` flag on every row. That touches every table and every query. Our tenant model already gives perfect isolation: each partner gets a **live business** and a linked **sandbox business**. `sp_test_…` keys resolve to the sandbox, `sp_live_…` keys to live. Sandbox emails go only to the partner's own allowlisted addresses, and sandbox deliveries are never billed. Isolation is proven by tests we already have.
5. **Contributors aren't accounts in v1.** File 03 implies pilots become users. Staff accounts can read the whole business's storage, which is exactly wrong for strangers. In v1, a contributor is a **row of contact info** (name, email, external ID), and the **upload session link is their credential**: one project, a few hours, upload-only. No login, no seat, no new auth surface. "Claim your workspace" comes later.
6. **Recipients reuse what exists.** A recipient is a `clients` row + `project_clients`. Access uses the existing hashed share-token machinery (`project_shares` / link access) through one new endpoint: "mint an access link." That replaces the OTP directly. (Gated on fixing §5 item 3 first.)
7. **Fewer endpoints for v1.** Keep: create/get/update project (with `external_id` lookup), add/remove recipient, add contributor, create/get upload session, list files, create/get delivery, mint access link, webhook endpoints (CRUD + test), quote price. **Defer:** archive, delete file, server-side import-from-URL, events list/replay (a console "resend" button covers support), `/organization`, `/capability_profiles`, `/usage` API (the console + monthly statement cover it).
8. **Webhooks: same guarantees, smaller catalog.** v1 events: `delivery.submitted`, `delivery.published`, `delivery.viewed`, `delivery.downloaded`, `upload_session.expired`. Drop `project.created`/`project.updated` (the partner made the call, so it already knows) and `file.uploaded` (noisy; counts go in `delivery.submitted`). Keep HMAC signing, an outbox table, the every-minute cron with retries for about 3 days, and a log with resend in the console.
9. **No dated version header in v1.** URL `/api/v1/…` is enough. Add a dated header only when you first need a non-breaking change you can't make additively.
10. **No partner self-serve dashboard in v1.** You'll onboard partners by hand for a while. Put keys, webhook endpoints, logs and usage in **your** `/platform` console (super-admin), and send the partner keys once. A partner-facing developer page can come in v2.
11. **Billing: record and report, invoice by hand at first.** Compute size, tier and price on each delivery at submit time (stored on the row and shown in API and webhook), plus a monthly statement in the console using `max(total, minimum)`. Send the invoice as a Stripe invoice (manual or one-click) until there are several partners. Automated metered Stripe billing is real work for one customer that's in a free launch period anyway.
12. **Rate limiting: simple and honest.** The in-memory limiter isn't reliable on serverless. For v1, use a per-key, per-minute counter in Postgres (or skip it and rely on Vercel's platform protection) and document a soft limit. Don't build `RateLimit-*` header machinery yet.
13. **Cut from v1:** OAuth connected accounts (Mode B), portfolio copy, IP allowlists, virus scanning, server-side thumbnails for TIFF/RAW, the docs site, SDKs, Zapier, status page, SMS notifications, the `usage.threshold_reached` event.

### Things File 03 under-weights (bigger than it suggests)
14. **Large uploads are the riskiest part.** Supabase TUS authenticates with a user JWT checked by storage RLS. A pilot without an account has no JWT, so we need either (a) Supabase **signed upload URLs** used with TUS, which needs a spike to confirm it works for multi-GB resumable uploads, or (b) a short-lived JWT we mint for the session. We also need to raise the bucket cap, check the Supabase plan's global object limit, and save resume state on the server so a backgrounded app or dropped connection can continue. **I'd do a proof-of-concept spike first, before promising "resumable multi-GB from a phone."**
15. **Downloads of big deliveries.** Today's `?file=1` path streams through a Vercel function, and the ZIP gives up on files over 400 MB. Delivery-mode downloads must **redirect to signed storage URLs**. "Download all" for 25 GB+ needs a different design: per-file downloads, a desktop download list, or a pre-built ZIP job. Promising download-all-ZIP is unsafe until then.
16. **Extract a shared `createProject` service first.** The `/request` route has everything inline (and seems to skip `project_clients`; worth checking). The API, the request form and the admin UI should all call one function.
17. **The paywall.** Middleware returns 402 for unpaid businesses on `/api/*`. Partner businesses must be comped or exempt, or API calls will fail mysteriously.
18. **File types.** Geo and thermal deliverables (GeoTIFF, LAS/LAZ, KMZ, radiometric JPG/TIFF, DNG/HEIC) are blocked by bucket MIME allowlists, and documents only allow PDF/ZIP. v1 needs a "generic file" lane (stored and downloadable, no preview).

---

## 5. Things found along the way (fix before an API exists)

These aren't part of the API, but the API would sit on top of them. They're **confirmed by reading the repo SQL only.** I haven't checked the live database (no credentials, and Phase 1 is read-only).

| # | Severity | Finding | Where |
|---|---|---|---|
| 1 | 🔴 High | **Any signed-in user can update their own `profiles` row, including `role`, `business_id`, `email` and `staff_permissions`.** The UPDATE policy has `USING` but no `WITH CHECK`, and nothing guards those columns. A client could make themselves admin of any business through the Supabase REST API directly. | `supabase/migration-v32-rls-tenant-scope.sql:79-85` |
| 2 | 🔴 High | **The signup trigger trusts the `role` and `business_id` supplied in signup metadata.** With public signup on and the anon key public, anyone can sign up as `admin` of an existing business UUID. | `handle_new_user()` in `supabase/migration-v90b-staff-accounts.sql:125-166` |
| 3 | 🟠 Medium | A share token mints a full session for that email's global account, even if it's an admin elsewhere. The user lookup fallback uses an unpaged `listUsers()`. | `src/lib/project-share-access.ts:116-160` |
| 4 | 🟠 Medium | `session-continue` mints handoff tokens for any `next` host. Consume trusts `x-forwarded-host`. | `src/app/api/auth/session-continue/route.ts`, `src/app/auth/handoff/consume/route.ts` |
| 5 | 🟡 Low | Staff storage access covers all business files; staff can assign themselves to projects; `link_access_token` is stored in plaintext; the tenant client's `update()` doesn't block changing `business_id`. | v91, v82, `tenant-service.ts:110` |
| 6 | 🧹 Hygiene | About 15 duplicate `* 2.sql` / `* 3.sql` migrations and `src/lib/* 2.ts` copies that get compiled; version collisions at v71 and v82. It's unclear which are applied. | `supabase/`, `src/lib/` |

Items 1 and 2 should be verified against production and fixed **before** anything else, partner or not.
