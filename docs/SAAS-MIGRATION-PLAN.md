# Swift Portal → Multi-Tenant SaaS: Architecture & Cursor Prompt Series

> **Directory note:** You invoked me in `~/Desktop/coding/Swift Portal`, which is an empty
> Create Next App scaffold (one commit, `src/app/page.tsx` is still the Next.js starter, empty
> `supabase/migrations/`). The **real working app is `~/Desktop/coding/swift portal v2`**
> (38,471 LOC, 29 SQL migrations, remote `github.com/jlbridges21/swift-portal.git`, latest
> commit `129e656 youtube link`). Everything below refers to `swift portal v2`. Run the Cursor
> prompts there.

---

## 1. What exists today

### Stack
Next.js 16.2.9 (App Router) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth +
Storage) · Stripe · Resend · OneSignal · Google Calendar · GoHighLevel webhook.
No test suite. Migrations are hand-run `.sql` files in `supabase/`, not Supabase CLI-managed.

### Data model (29 migrations, `schema.sql` → `migration-v28`)

| Group | Tables |
|---|---|
| Identity | `profiles` (FK → `auth.users`, `role user_role`, `client_id`), `clients` |
| Intake | `leads`, `properties` |
| Core | `projects`, `project_clients` (M2M), `project_quotes`, `asset_reviews`, `revisions` |
| Media | `media_assets`, `media_folders`, `media_asset_tags`, `media_downloads`, `media_asset_events`, `tours` |
| Money | `payments`, `processed_stripe_events` |
| Comms | `client_messages`, `client_message_reads`, `project_messages`, `project_message_reads`, `notifications`, `communications`, `email_events` |
| Config | `app_settings` (**singleton, `CHECK (id = 1)`**), `google_calendar_connections` (**singleton, `CHECK (id = 1)`**) |
| Audit | `activity_logs`, `client_notes` |
| View | `client_stats` (`GRANT SELECT TO authenticated`) |

**Nothing in the schema has a tenant column.** Isolation today is entirely
"admin sees everything / client sees their own rows."

### Auth & roles
- `user_role` enum = `('admin', 'client')`. One global admin tier.
- `handle_new_user()` trigger auto-creates a `profiles` row on `auth.users` insert; role comes
  from `raw_user_meta_data->>'role'`.
- RLS helpers: `is_admin()`, `get_user_client_id()` (v26 version falls back to
  `clients.user_id`, `LIMIT 1`), `client_has_project_access(project_id)`.
- Route protection: `src/proxy.ts` → `src/lib/supabase/middleware.ts` (redirects `/admin`
  for non-admins, `/dashboard` + `/admin` for anon).
- Server helpers: `getProfile()` / `requireAuth()` / `requireAdmin()` in `src/lib/auth.ts`;
  `requireAdminApi()` in `src/lib/api-auth.ts`.

### RLS pattern
Every tenant table has two policies: `FOR ALL USING (is_admin())` and a client-scoped
`FOR SELECT USING (client_id = get_user_client_id())` or
`USING (client_has_project_access(project_id))`.

### Project lifecycle (hardcoded)
`PROJECT_STATUSES` in `src/lib/constants.ts` — 8 stages hardcoded as a TS const array, mirrored
by the `project_status` Postgres enum (which also still carries ~8 dead legacy values mapped via
`LEGACY_STATUS_MAP`):

`new_request` → `quote_sent` → `proposal_approved` → `scheduled` →
`shoot_complete_editing` → `ready_for_review` → `awaiting_payment` → `delivered`

Consumers: `journey.ts`, `admin-project-pipeline.ts`, `admin-project-status.ts`,
`status-automation.ts`, `workflow-settings.ts`, `project-pipeline.tsx`, `status-timeline.tsx`,
`email-templates.ts`, `build-portal-lead-payload.ts`.

### Estimates & pricing (hardcoded)
`src/lib/service-templates.ts` — 15 `ServiceTemplate` objects hardcoded in TypeScript with
`startingAtCents`, `includes[]`, `notes`, `hidePricing`. `SERVICE_TYPES` (15 strings) in
`constants.ts` drives the request form. `buildPreliminaryEstimatePayload()` +
`createPreliminaryEstimate()` write a `project_quotes` row with `quote_kind='preliminary'`.
Official proposals are `quote_kind='official'`. `quote_status` = draft/sent/approved/changes_requested.

### Payments
One Stripe account via `STRIPE_SECRET_KEY`. `getStripe()` is a **module-level singleton**.
Payment links + Checkout Sessions in `stripe-payments.ts`. One global webhook at
`/api/stripe/webhook` guarded by `STRIPE_WEBHOOK_SECRET`, idempotent via `processed_stripe_events`.

### Messaging
`client_messages` (per-client thread, privacy-correct) superseded `project_messages` in v26; both
tables still exist and both API routes are still live.

### Media
`project-media` (2 GB limit), `project-documents`, `avatars` buckets. Upload paths built in
`src/lib/media-upload.ts:43`: `const prefix = projectId ? projectId : "library/unassigned"`.
So objects live at `{projectId}/…` or the **globally shared** `library/unassigned/…`.
Storage RLS keys off `(storage.foldername(name))[1] = project_id`. TUS resumable uploads
(`tus-js-client`), signed URLs, `reorder_media_assets` `SECURITY DEFINER` RPC.

### Scheduling
`shoot_proposals` (admin ↔ client counter-proposal loop, statuses pending/accepted/countered/
confirmed/declined/superseded). Google Calendar OAuth stored in the **singleton** row.

### Notifications & email
`notifications` table + `notifyAdmins()` / `notifyProjectClients()` / `notifyUsers()` in
`src/lib/notifications.ts`. Resend for email (`email.ts`, `email-templates.ts`), Resend webhook
→ `email_events` + `communications`. OneSignal web push for admins. Per-event channel toggles in
`app_settings.notifications` (19 `NotificationEventKey`s). Cron sweep at
`/api/cron/workflow-reminders`.

### Hardcoded to Swift Aerial Media
- `src/lib/brand.ts` — `BRAND.name`, `portalName`, `LOGO_URL` (external filesafe.space CDN).
- `src/lib/portal-brand.ts` — `SWIFT_BUSINESS_DEFAULTS` (name, Jackson Bridges, phone
  `6626871259`, `jackson@swiftaerialmedia.com`, colors `#0F172A`/`#3B82F6`).
- `src/lib/site-metadata.ts` — `SITE.name/company/title/description`, fallback host
  `portal.swiftaerialmedia.com`.
- `src/lib/app-settings.ts` — `DEFAULT_APP_SETTINGS.email` sender
  `notification@swiftaerialmedia.com`, footer text.
- `src/lib/email.ts:36` — `"Swift Portal <portal@swiftaerialmedia.com>"` fallback.
- **~45 literal "Swift Aerial Media" / "Swift Portal" strings** in user-facing copy across
  `landing-page.tsx` (18), `journey.ts` (4), `client-messages.ts`, `shoot-proposals/route.ts`,
  `quotes/route.ts`, `messages/route.ts`, `revisions/route.ts`, `payments/[id]/receipt/route.ts`,
  `project-hero.tsx`, `project-messages.tsx`, `proposal-card.tsx`, `quote-section.tsx`,
  `payments-section.tsx`, `shoot-scheduling.tsx`, `client-messages-chat.tsx`, `footer.tsx`,
  `not-found.tsx`, `url-toast-handler.tsx`, `service-templates.ts` (disclaimer + 3 templates).
- `next.config.js` — `assets.cdn.filesafe.space` in `images.remotePatterns`.
- The 15 `SERVICE_TEMPLATES` and their pricing are Swift's own catalog.

---

## 2. Recommended architecture

### 2.1 Tenancy model: shared schema, `business_id` column, RLS + DB triggers

Do **not** go database-per-tenant or schema-per-tenant. You have 30 tables, 55 files using the
service role, and a working app with live clients. A `business_id` column on every tenant-owned
table is the only approach that lets you migrate incrementally without a rewrite.

```
businesses (the tenant)
  id, slug, name, status, plan, custom_domain, created_at, deleted_at
  ↑
  business_id on: clients, leads, properties, projects, project_clients, project_quotes,
  asset_reviews, revisions, media_assets, media_folders, media_asset_tags, media_downloads,
  media_asset_events, tours, payments, client_messages, client_message_reads,
  project_messages, project_message_reads, notifications, communications, email_events,
  activity_logs, client_notes, shoot_proposals, business_settings, business_services,
  business_stages, google_calendar_connections, business_integrations
```

`profiles` gets `business_id` (NULL for `super_admin`, set for `admin` and `client`).

### 2.2 Roles: **add** `super_admin`, do not rename `admin`

```sql
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
```

Keep `'admin'` meaning "business admin". Renaming it would break `is_admin()`, the
`handle_new_user()` trigger, every `profile.role !== "admin"` check in middleware and
`requireAdminApi()`, and dozens of components. `'admin'` scoped by `business_id` **is**
"Business Admin". This single decision saves you hundreds of edits.

| Role | Scope |
|---|---|
| `super_admin` | Platform. `/platform/*`. `business_id IS NULL`. Bypasses tenant filters. Every action audit-logged. |
| `admin` | One business (`profiles.business_id`). Existing `/admin/*` unchanged. |
| `client` | Own `clients` row(s), within one business. Existing `/dashboard/*` unchanged. |

### 2.3 Tenant resolution

| Surface | Source of truth |
|---|---|
| Authenticated admin | `profiles.business_id` |
| Authenticated client | `clients.business_id` via `profiles.client_id` |
| Public pages (`/`, `/request`, `/login`) | subdomain → `businesses.slug`, or `businesses.custom_domain`, with `/b/[slug]` path fallback for local dev |
| Stripe webhook | Connect `event.account` → `business_integrations`, cross-checked against `payments.business_id` |
| Resend webhook | `business_id` Resend tag → cross-checked against the project |
| Cron | iterate `businesses WHERE status='active'` |

**The URL never grants access.** For a logged-in user the URL's tenant is used only for branding;
if it disagrees with their profile's business, redirect to their own. Supabase Auth is one global
user pool — a login is not tenant-scoped and must not be treated as such.

Swift Aerial Media keeps `portal.swiftaerialmedia.com` as its `custom_domain`, so no existing
client bookmark, email link, or Stripe redirect URL breaks.

### 2.4 RLS: mechanical, additive rewrite

Add two helpers, then add one predicate to every existing policy.

```sql
CREATE OR REPLACE FUNCTION is_super_admin() RETURNS BOOLEAN
  LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION current_business_id() RETURNS UUID
  LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE bid UUID;
BEGIN
  SELECT business_id INTO bid FROM profiles WHERE id = auth.uid();
  IF bid IS NOT NULL THEN RETURN bid; END IF;
  SELECT c.business_id INTO bid FROM clients c
    WHERE c.user_id = auth.uid() AND c.deleted_at IS NULL LIMIT 1;
  RETURN bid;
END; $$;
```

Then every policy becomes:

```sql
-- before
FOR ALL USING (is_admin())
-- after
FOR ALL USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))

-- before
FOR SELECT USING (client_id = get_user_client_id())
-- after
FOR SELECT USING (business_id = current_business_id() AND client_id = get_user_client_id())
```

### 2.5 The real isolation layer: DB triggers, not RLS

**This is the most important architectural point in this document.**

55 files call `createServiceClient()` (`SUPABASE_SERVICE_ROLE_KEY`), which **bypasses RLS
entirely**. Every read/write in those 55 files — including the entire media pipeline, the whole
notification system, all of `app-settings.ts`, `status-automation.ts`, `stripe-payments.ts`, and
the public `/api/request` route — is invisible to RLS. Perfect RLS policies give you *no*
protection there.

Service role does **not** bypass triggers, CHECK constraints, or foreign keys. So:

1. **Composite FKs / integrity triggers** on every cross-table reference, rejecting rows whose
   parent belongs to a different business. E.g. a `payments` row whose `project_id` points at
   another business's project must fail at the DB level.
2. **`business_id NOT NULL`** everywhere, so a forgotten column can't silently become "global".
3. A **tenant-scoped service client wrapper** so `.eq("business_id", …)` is the default, not
   something a developer has to remember 400 times.

Treat RLS as defense-in-depth for the anon-key paths, and triggers as the actual guarantee.

### 2.6 Editable services

New `business_services` table. Seed Swift's 15 `SERVICE_TEMPLATES` rows verbatim so the existing
preliminary-estimate output is byte-identical after the cutover.

```sql
business_services (
  id, business_id, name, slug, description, preliminary_estimate_cents,
  includes JSONB DEFAULT '[]', notes, hide_pricing BOOLEAN, starting_label,
  line_items JSONB, display_order, is_active, created_at, updated_at
)
```

`getServiceTemplate()` keeps its exact signature but reads from the DB (business-scoped, cached),
with the hardcoded array as a fallback until the seed is verified.

### 2.7 Editable stages: table **alongside** the enum, not instead of it

`projects.status` is a Postgres enum used by ~10 modules and 3 SQL views. Postgres cannot remove
enum values. Replacing it in one step is the single fastest way to break this app.

Instead:

```sql
business_stages (
  id, business_id, key, label, client_label, sort_order, color_class,
  is_terminal, is_default, created_at
)
ALTER TABLE projects ADD COLUMN stage_id UUID REFERENCES business_stages(id);
```

- Seed each business's `business_stages` from the current 8 `PROJECT_STATUSES` (same `key`s).
- Backfill `projects.stage_id` from `projects.status`.
- A trigger keeps `status` and `stage_id` in sync **both ways** while both exist.
- Read paths migrate to `stage_id`/`business_stages` gradually. Writes keep setting both.
- Custom stages beyond the 8 defaults get `status = 'new_request'` as an enum placeholder plus a
  real `stage_id`; only new-stage-aware code reads `stage_id`.
- The enum column is never dropped. It becomes a legacy mirror.

### 2.8 Per-business settings

`app_settings` (singleton, `CHECK (id = 1)`) → `business_settings (business_id PRIMARY KEY,
settings JSONB, …)`. Keep the `AppSettings` TypeScript shape exactly as-is — including
`business`, `notifications`, `email`, `proposals`, `workflow` — so `getPortalBrandFromSettings()`,
`admin-settings-client.tsx`, and `workflow-settings-card.tsx` need almost no changes. Only the
load/save functions change signature: `getAppSettings(businessId)`.

### 2.9 Per-business integrations

| Integration | Plan |
|---|---|
| **Stripe** | Stripe **Connect** (Standard accounts). Each business onboards its own account; platform charges via `stripeAccount` header. Interim option: encrypted per-business API keys in `business_integrations`. Connect is the correct end state — you must not custody other businesses' payouts. |
| **Resend** | Keep one platform API key. Per-business `from` name and reply-to immediately. Verified custom sending domains per business via the Resend Domains API later; until verified, send from `noreply@yourplatform.com` with the business name as the display name and their address as reply-to. |
| **OneSignal** | One app. Tag each subscription with `business_id`; send with a tag filter. |
| **Google Calendar** | Drop the `CHECK (id = 1)`; key the table by `business_id`. OAuth redirect carries a signed `state` containing `business_id`. |
| **GoHighLevel** | Move `GHL_PORTAL_LEAD_WEBHOOK_URL` from env into per-business settings. |

### 2.10 Storage

New writes: `{business_id}/{project_id}/…` and `{business_id}/library/…`.
**Do not move existing objects.** `media_assets.file_path` / `storage_path` store absolute paths
and there is a global `UNIQUE` index on `file_path`; a bulk move risks orphaning every existing
client's downloads. Storage policies handle both shapes during a long transition: legacy
`{project_id}/…` objects resolve via a `projects` lookup, new `{business_id}/…` objects resolve
via a prefix match. The `library/unassigned/` prefix is the urgent one — it is a shared global
namespace and must be closed to new writes in the same migration that introduces prefixing.

### 2.11 Super admin surface

New `/platform/*` route tree (leave `/admin/*` as the business area). Businesses list, create,
suspend; per-business usage; platform-wide audit log. "View as business" sets a signed,
short-TTL `sa_business_context` cookie; `current_business_id()` honours it **only** for
`super_admin`, and every impersonated request is written to `platform_audit_log`.

### 2.12 Automations (last phase)

`business_automations (business_id, trigger_type, trigger_stage_id, conditions JSONB,
actions JSONB, is_active)`. The existing `status-automation.ts` +
`workflow-settings.stages[*].{autoAdvance, requireManualApproval}` is already an automation engine
in miniature — extend it, don't replace it. Build this **after** everything else is isolated.

---

## 3. Major architectural risks — read before starting

Ranked by likelihood × blast radius.

### R1 — 55 files bypass RLS via the service role 🔴
`createServiceClient()` is used in 55 files including `api/request/route.ts` (public,
unauthenticated, creates auth users + clients + projects), the entire `api/media/*` tree,
`notifications.ts`, `status-automation.ts`, `app-settings.ts`, `media-library.ts`,
`stripe-payments.ts`, `google-calendar.ts`, `auth.ts`. A single missing `.eq("business_id", …)`
is a full cross-tenant data leak that RLS will not catch. **Mitigation:** DB integrity triggers
(§2.5), a tenant-scoped wrapper, and a file-by-file audit checklist. Budget the most time here.

### R2 — Module-level caches leak across tenants 🔴
Three module-scoped singletons persist across requests in a warm Next.js server instance:
- `src/lib/app-settings.ts` — `let cachedSettings: AppSettings | null` + 30 s TTL. **Business A's
  branding, email sender, and workflow settings will be served to Business B.** This is not
  theoretical; it will happen on the first concurrent request pair.
- `src/lib/stripe.ts` — `let stripeInstance: Stripe | null`.
- `src/lib/email.ts` — `let resend: Resend | null` (safe while the API key is shared, unsafe the
  moment keys are per-business).
- `src/lib/email.ts` — `let lastEmailSendResult` (diagnostic leak: one business's admin can see
  another's last email recipient/subject via the settings diagnostics).

All must become `Map<businessId, …>` or per-request.

### R3 — `project_status` enum rigidity 🟠
~10 modules `switch` on it; `client_stats` and two other views reference it; Postgres cannot
remove enum values. Follow §2.7 (add `stage_id` alongside) or expect a multi-day breakage.

### R4 — Two singleton tables with `CHECK (id = 1)` 🟠
`app_settings` and `google_calendar_connections`. Both need a new table + data copy; the CHECK
constraint means you cannot simply add a column.

### R5 — `client_stats` view is world-readable to any authenticated user 🟠
`GRANT SELECT ON client_stats TO authenticated` with no RLS and no business filter. Today that
means any logged-in client can read every client's `lifetime_revenue` and
`outstanding_balance`. Post-multi-tenancy it is a cross-business financial leak. Views don't
inherit RLS from base tables — this needs `security_invoker = true` (PG15+) or replacement with a
`SECURITY DEFINER` function. **This is a live bug today, before any SaaS work.**

### R6 — `getProfile()` auto-links clients by email with no business scope 🟠
`src/lib/auth.ts` runs `.ilike("email", user.email)` across **all** `clients` and then writes
`profiles.client_id`. With two businesses that both have a client at `bob@example.com`, a user
gets silently linked to the wrong business's client record. Must be business-scoped.

### R7 — `get_user_client_id()` returns exactly one client (`LIMIT 1`) 🟠
Supabase Auth is one global user pool: one email = one `auth.users` row. A person who is a client
of two different drone businesses has one login. `get_user_client_id()` picks arbitrarily.
**Decision needed.** Recommended v1: keep one-client-per-user (the overwhelmingly common case),
add a `UNIQUE (business_id, lower(email))` on clients, and detect the collision case explicitly
with a clear error + a client-side business switcher deferred to a later phase. Do not silently
pick one.

### R8 — Storage policies key off `(storage.foldername(name))[1] = project_id` 🟠
Changing the path shape breaks every existing client's media downloads unless policies accept
both shapes. Also: the global `UNIQUE INDEX idx_media_assets_file_path_unique` on `file_path`
means two businesses can collide on an unprefixed path.

### R9 — `notifyAdmins()` fans out to every admin on the platform 🟠
`src/lib/notifications.ts:78` — `.from("profiles").eq("role", "admin")` with no other filter.
Every business admin gets push + email + in-app notifications about every other business's
projects, including client names, addresses, and dollar amounts.

### R10 — Public `leads` INSERT is `WITH CHECK (true)` 🟡
Anyone can insert a lead. Post-multi-tenancy anyone can inject leads into any business.
Needs `business_id` validation against an active business plus rate limiting.

### R11 — `notifications` / `activity_logs` INSERT policies are effectively open 🟡
`notifications`: `FOR INSERT WITH CHECK (true)`. `activity_logs`:
`WITH CHECK (auth.uid() IS NOT NULL)`. Any authenticated user can write a notification for any
user, or activity into any project. Pre-existing; tighten during the RLS pass.

### R12 — `reorder_media_assets` is `SECURITY DEFINER` granted to `authenticated` 🟡
It validates project ownership but not the caller's business. Add a business check.

### R13 — Backfill ordering 🟡
Always: add `business_id` **nullable** → backfill → verify zero NULLs → `SET NOT NULL`.
Adding `NOT NULL` to a populated table without a default fails outright.

### R14 — Zero automated tests 🔴
No test files anywhere in the repo. There is no safety net. **Build a SQL tenant-isolation test
harness in Prompt 5 and re-run it after every single subsequent prompt.** This is non-negotiable
for a migration of this shape.

### R15 — Two live message systems 🟡
`project_messages` (v25) and `client_messages` (v26) both exist, both have live API routes
(`/api/messages`, `/api/projects/[id]/messages`). Both need `business_id`. Do not consolidate
them during this migration — that's separate work.

### R16 — Enum values must be committed before use 🟡
The v5/v5b split exists because `ALTER TYPE … ADD VALUE` cannot be used in the same transaction.
`super_admin` needs the same two-file treatment.

### R17 — Stripe webhook is global and single-secret 🟠
One endpoint, one `STRIPE_WEBHOOK_SECRET`. Under Connect, events arrive with an `account` field
that must be mapped to a business and cross-checked against `payments.business_id` before any
status write — otherwise a crafted event could mark another business's payment paid.

### R18 — Live secrets and dirty working tree 🟡
`.env.local` holds live Supabase service-role, Stripe, Resend, and OneSignal keys. Branch and
snapshot the production database before Prompt 1.

---

## 4. Cursor prompt series

Run in order. Do not skip. Each prompt is self-contained and copy/paste ready.

Before you start:

```bash
cd "/Users/jlbridges21/Desktop/coding/swift portal v2" && git checkout -b saas-multi-tenant && git status
```

Take a full Supabase database snapshot (Dashboard → Database → Backups) and confirm the
restore path works before running any migration.

---

### Prompt 1 — Read-only audit and inventory (no code changes)

```
You are working in the Swift Portal codebase (Next.js 16 App Router + Supabase). This is a
LIVE production app with real paying clients. Your task in this prompt is INVESTIGATION ONLY.

DO NOT modify, create, or delete any file except the single report file named at the end.

We are converting this single-business app into a multi-tenant SaaS. Before any change, produce
a complete inventory.

Inspect and read fully:
1. Every file in supabase/ (schema.sql and all migration-v*.sql, in numeric order). Build the
   effective current schema: every table, column, index, constraint, trigger, function, view,
   RLS policy, and storage bucket/policy.
2. src/lib/auth.ts, src/lib/api-auth.ts, src/lib/project-access.ts, src/lib/supabase/*.
3. src/proxy.ts and the middleware it calls.
4. src/lib/app-settings.ts, portal-brand.ts, brand.ts, site-metadata.ts, constants.ts,
   workflow-settings.ts, workflow.ts, service-templates.ts, preliminary-estimates.ts.
5. Every file under src/app/api/ (all route handlers).
6. src/lib/notifications.ts, email.ts, email-templates.ts, onesignal-push.ts,
   stripe.ts, stripe-payments.ts, google-calendar.ts, media-upload.ts, media-library.ts,
   status-automation.ts, activity.ts.

Produce docs/TENANT-AUDIT.md containing:

A. TABLE INVENTORY — every table, with: does it hold business-owned data? What is its path to
   an owning business (direct, via project, via client, or none)? Current RLS policies verbatim.

B. SERVICE-ROLE INVENTORY — every file calling createServiceClient(). For each: list every
   .from(...) call with the operation (select/insert/update/upsert/delete) and the table. Flag
   each as SCOPED (already filters by a project/client the caller was authorized for) or
   UNSCOPED (queries a table with no ownership filter). This is the highest-risk list in the
   codebase; be exhaustive.

C. HARDCODED BRAND INVENTORY — every occurrence of "Swift Aerial Media", "Swift Portal",
   "swiftaerialmedia.com", "Jackson Bridges", the phone number, and the filesafe.space logo URL,
   with file:line. Group into: (1) brand config constants, (2) user-facing UI copy,
   (3) email/notification body text, (4) metadata/SEO, (5) service catalog copy.

D. HARDCODED LIFECYCLE INVENTORY — every file that reads PROJECT_STATUSES, the project_status
   enum, LEGACY_STATUS_MAP, WORKFLOW_STAGE_DEFINITIONS, or switches on a status string.

E. HARDCODED SERVICE/PRICING INVENTORY — every consumer of SERVICE_TYPES, SERVICE_TEMPLATES,
   getServiceTemplate, buildPreliminaryEstimatePayload, DAM_SERVICE_FILTERS.

F. SHARED-STATE INVENTORY — every module-level mutable variable (let/var at module scope) in
   src/lib/. These persist across requests in a warm server and are cross-tenant leak vectors.
   Include the file, variable name, and what it caches.

G. EXTERNAL INTEGRATION INVENTORY — Stripe, Resend, OneSignal, Google Calendar, GoHighLevel.
   For each: which env vars, which module-level clients, which webhook endpoints, and whether
   any per-business identifier exists today.

H. SINGLETON TABLES — every table with a CHECK constraint pinning a single row.

I. VIEWS AND SECURITY-DEFINER FUNCTIONS — every view and every SECURITY DEFINER function, with
   its GRANTs, and a note on whether it can leak data across owners.

Verification: after writing the report, re-run your own greps for "Swift Aerial", "Swift Portal",
"createServiceClient", "PROJECT_STATUSES", and "SERVICE_TEMPLATES" and confirm the counts in your
report match the actual grep counts. State the numbers explicitly.

Do not propose or write any code changes. Do not touch any other file. Do not start
implementation. Stop when docs/TENANT-AUDIT.md is complete and its counts are verified.
```

---

### Prompt 2 — `businesses` table + nullable `business_id` + backfill

```
Continue the Swift Portal multi-tenant migration. Read docs/TENANT-AUDIT.md first — it is the
inventory you produced in the previous step.

GOAL: introduce the tenant table and add a NULLABLE business_id to every business-owned table,
backfilled to a single "Swift Aerial Media" business. ZERO application code changes in this
prompt. The app must behave identically after this migration.

Before writing anything, read supabase/schema.sql and every supabase/migration-v*.sql in order
so your new migration matches the existing conventions exactly (idempotent, IF NOT EXISTS,
hand-run in the Supabase SQL editor, header comment describing what it does and how to run it).

Create supabase/migration-v29-businesses.sql that:

1. Creates:
   CREATE TABLE IF NOT EXISTS businesses (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     slug TEXT NOT NULL UNIQUE,
     name TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'active'
       CHECK (status IN ('active','suspended','pending','cancelled')),
     custom_domain TEXT UNIQUE,
     plan TEXT NOT NULL DEFAULT 'standard',
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     deleted_at TIMESTAMPTZ
   );
   Add the updated_at trigger using the existing update_updated_at() function.

2. Inserts the first tenant with a FIXED, hardcoded UUID so it is stable and referenceable
   across all later migrations. Use:
     '00000000-0000-0000-0000-000000000001'
   with slug 'swift-aerial-media', name 'Swift Aerial Media',
   custom_domain 'portal.swiftaerialmedia.com', status 'active'.
   Use ON CONFLICT (id) DO NOTHING so re-running is safe.

3. Adds `business_id UUID REFERENCES businesses(id)` — NULLABLE, no default — to every
   business-owned table identified in section A of the audit. At minimum: profiles, clients,
   leads, properties, projects, project_clients, project_quotes, asset_reviews, revisions,
   media_assets, media_folders, media_asset_tags, media_downloads, media_asset_events, tours,
   payments, client_messages, client_message_reads, project_messages, project_message_reads,
   notifications, communications, email_events, activity_logs, client_notes, shoot_proposals.
   Use ALTER TABLE ... ADD COLUMN IF NOT EXISTS for each.
   Do NOT add business_id to processed_stripe_events yet (platform-level, handled later).

4. Backfills every one of those columns to the Swift business UUID with
   `UPDATE <table> SET business_id = '00000000-...0001' WHERE business_id IS NULL;`

5. Creates an index on business_id for every table above, plus these composite indexes that
   match how the app actually queries:
     (business_id, deleted_at) on clients, projects, properties, leads
     (business_id, status) on projects, payments
     (business_id, created_at DESC) on activity_logs, media_assets, notifications

6. Ends with a verification block: a single SELECT that unions one row per table reporting
   table_name and COUNT(*) FILTER (WHERE business_id IS NULL) AS null_business_ids.
   Add a comment stating every count must be 0 before running the next migration.

Do NOT add NOT NULL constraints yet. Do NOT change any RLS policy. Do NOT change any
TypeScript file. Do NOT touch src/ at all in this prompt.

Also update src/lib/types.ts ONLY to add `business_id?: string | null` as an OPTIONAL field to
the existing row interfaces for the tables above, so later prompts can reference it without type
errors. Optional, never required — nothing should break.

VERIFICATION INSTRUCTIONS to include as a comment block at the top of the migration file:
  1. Run the migration in the Supabase SQL editor.
  2. Run the final verification SELECT — every null_business_ids count must be 0.
  3. Run `npm run typecheck` and `npm run build` — both must pass.
  4. Manually smoke-test in the running app: log in as admin, open /admin, open a project,
     open /admin/media, open /admin/messages. Log in as a test client, open /dashboard and a
     project. Everything must look and behave exactly as before.

Do not move on to RLS, roles, or NOT NULL constraints. Stop here.
```

---

### Prompt 3 — `NOT NULL`, cross-tenant integrity triggers, and defaults

```
Continue the Swift Portal multi-tenant migration. Prerequisite: migration-v29 has been run and
its verification SELECT returned 0 NULLs for every table. Confirm this assumption is stated in
your output before proceeding.

Read docs/TENANT-AUDIT.md section A (table inventory and ownership paths) and section B
(service-role inventory) before writing anything.

GOAL: make business_id mandatory and make cross-tenant writes IMPOSSIBLE AT THE DATABASE LEVEL.
This matters because 55 files use the Supabase service role, which bypasses RLS entirely.
Triggers and constraints are NOT bypassed by the service role, so they are our real guarantee.

Create supabase/migration-v30-tenant-integrity.sql that:

1. For every table given business_id in v29, sets it NOT NULL:
     ALTER TABLE <t> ALTER COLUMN business_id SET NOT NULL;
   EXCEPT profiles — leave profiles.business_id nullable, because super_admin rows will have
   NULL. Add a comment explaining exactly that.

2. Adds a reusable SECURITY DEFINER trigger function that enforces that a child row's
   business_id matches its parent's:

   CREATE OR REPLACE FUNCTION enforce_same_business()
   RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
   DECLARE
     parent_table TEXT := TG_ARGV[0];
     parent_col   TEXT := TG_ARGV[1];
     parent_bid   UUID;
     child_parent UUID;
   BEGIN
     EXECUTE format('SELECT ($1).%I', parent_col) INTO child_parent USING NEW;
     IF child_parent IS NULL THEN RETURN NEW; END IF;
     EXECUTE format('SELECT business_id FROM %I WHERE id = $1', parent_table)
       INTO parent_bid USING child_parent;
     IF parent_bid IS NULL THEN
       RAISE EXCEPTION 'tenant integrity: % % not found', parent_table, child_parent;
     END IF;
     IF parent_bid <> NEW.business_id THEN
       RAISE EXCEPTION 'tenant integrity violation: %.% (%) belongs to business %, row claims %',
         TG_TABLE_NAME, parent_col, child_parent, parent_bid, NEW.business_id;
     END IF;
     RETURN NEW;
   END; $$;

   Verify this dynamic-SQL approach actually works on this Postgres version. If EXECUTE ... USING
   NEW does not behave as expected, replace it with explicit per-table trigger functions instead
   — correctness over cleverness. Test it before moving on.

3. Attaches BEFORE INSERT OR UPDATE triggers using that function for every parent/child pair,
   derived from the audit's ownership paths. At minimum:
     projects.client_id -> clients
     projects.property_id -> properties
     project_clients.project_id -> projects, project_clients.client_id -> clients
     project_quotes.project_id -> projects
     payments.project_id -> projects, payments.client_id -> clients, payments.quote_id -> project_quotes
     media_assets.project_id -> projects, media_assets.client_id -> clients,
       media_assets.property_id -> properties, media_assets.folder_id -> media_folders
     media_folders.project_id -> projects
     media_asset_tags.media_asset_id -> media_assets
     media_downloads.media_asset_id -> media_assets
     media_asset_events.media_asset_id -> media_assets
     tours.project_id -> projects
     revisions.project_id -> projects, revisions.client_id -> clients
     shoot_proposals.project_id -> projects
     asset_reviews.project_id -> projects
     client_messages.client_id -> clients, client_messages.project_id -> projects
     project_messages.project_id -> projects
     communications.project_id -> projects, communications.client_id -> clients
     activity_logs.project_id -> projects, activity_logs.client_id -> clients,
       activity_logs.property_id -> properties
     notifications.project_id -> projects, notifications.payment_id -> payments
     client_notes.client_id -> clients
     email_events.project_id -> projects
     leads.project_id -> projects
     properties.client_id -> clients

4. Adds a UNIQUE constraint that prevents the same email being two clients in one business:
     CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_business_email
       ON clients (business_id, lower(email)) WHERE deleted_at IS NULL;
   Before creating it, run a detection query for existing duplicates within the Swift business
   and REPORT them. If duplicates exist, do NOT create the index — output the duplicate rows and
   stop, so a human can resolve them.

5. Replaces the global media path unique index with a business-scoped one:
     DROP INDEX IF EXISTS idx_media_assets_file_path_unique;
     CREATE UNIQUE INDEX idx_media_assets_business_file_path
       ON media_assets (business_id, file_path);
   Add a comment noting media-library upsert-by-path logic must now include business_id.

6. Ends with verification: for each trigger you added, a commented-out example INSERT that
   should FAIL, so a human can spot-check the guard is live.

Do NOT change RLS policies. Do NOT add the super_admin role. Do NOT touch src/ except: if
migration step 5 changes upsert semantics, find the exact upsert-by-file_path call in
src/lib/media-library.ts (and anywhere else) and add business_id to the conflict target. Make
that change minimal and surgical.

VERIFICATION (state these as instructions in the migration header):
  1. Run in the Supabase SQL editor. It must complete with no errors.
  2. Manually attempt one of the commented-out cross-tenant INSERTs — it MUST be rejected.
  3. npm run typecheck && npm run build must pass.
  4. Full app smoke test: create a project as admin, upload one photo, create a quote, create a
     payment link, send a message, mark a shoot proposal. Every one must still succeed — the
     triggers must not block legitimate single-tenant writes.

Do not move on to roles or RLS. Stop here.
```

---

### Prompt 4 — `super_admin` role and tenant-aware SQL helpers

```
Continue the Swift Portal multi-tenant migration. Prerequisites: migration-v29 and v30 are run
and verified. Read docs/TENANT-AUDIT.md and src/lib/auth.ts, src/lib/api-auth.ts,
src/lib/supabase/middleware.ts, and supabase/fix-auth-trigger.sql before writing anything.

CRITICAL CONSTRAINT: we are ADDING a 'super_admin' value to the user_role enum. We are NOT
renaming 'admin'. 'admin' continues to mean "business admin" and is scoped by business_id.
Renaming it would break is_admin(), handle_new_user(), the middleware role checks,
requireAdminApi(), and dozens of components. Do not rename it. Do not add a 'business_admin'
value. Confirm you understand this before you write code.

Postgres cannot use a new enum value in the same transaction that adds it. Follow the existing
two-file convention in this repo (see migration-v5.sql / migration-v5b.sql).

Create supabase/migration-v31-roles.sql (PART 1, run first, alone):
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
  Header comment: run this file alone, wait for success, THEN run v31b.

Create supabase/migration-v31b-tenant-helpers.sql (PART 2):

1. is_super_admin() — SECURITY DEFINER, STABLE, returns true when the caller's profile
   role = 'super_admin'.

2. current_business_id() — SECURITY DEFINER, STABLE. Resolution order:
   a) If the caller is super_admin AND a valid impersonation context is set, return that.
      Implement the context via a settable GUC read with
      current_setting('app.impersonated_business_id', true) so the app can set it per
      transaction. If it is not a valid UUID of an existing business, ignore it.
   b) profiles.business_id for the caller.
   c) For clients whose profile has no business_id: clients.business_id where
      clients.user_id = auth.uid() AND deleted_at IS NULL, LIMIT 1.
   d) NULL.

3. Update get_user_client_id() (currently defined in migration-v26) so its clients.user_id
   fallback is business-scoped: add `AND business_id = current_business_id()`. Keep the
   profiles.client_id path first and its exact existing behavior. Preserve the function
   signature and volatility exactly — many policies depend on it.

4. Update client_has_project_access(p_project_id UUID) (defined in migration-v3) to also require
   the project's business_id = current_business_id(). Keep the signature identical.

5. Update handle_new_user() (see supabase/fix-auth-trigger.sql for the current version — start
   from THAT version, not the older schema.sql one) so it also reads
   NEW.raw_user_meta_data->>'business_id' and writes it to profiles.business_id when present and
   a valid UUID. Everything else about the function must stay byte-identical, including the
   unique_violation exception handler and SET search_path = public.

6. Backfill: UPDATE profiles SET business_id = '00000000-0000-0000-0000-000000000001'
   WHERE business_id IS NULL AND role IN ('admin','client');
   (Leave any future super_admin rows NULL.)

7. Add a commented-out command a human runs manually to promote themselves:
   -- UPDATE profiles SET role = 'super_admin', business_id = NULL WHERE email = 'YOUR@EMAIL';

Now make MINIMAL TypeScript changes — do not refactor:

8. src/lib/types.ts — extend the role union to include 'super_admin'. Add
   business_id?: string | null to Profile.

9. src/lib/supabase/middleware.ts — read the existing logic carefully. Change only this:
   the /admin guard currently redirects when profile.role !== 'admin'. It must now allow both
   'admin' and 'super_admin'. Add a new guard so /platform requires role === 'super_admin' and
   redirects others to /admin or /dashboard as appropriate. The login redirect must send
   super_admin to /platform, admin to /admin, client to /dashboard. Change nothing else in this
   file.

10. src/lib/auth.ts — requireAdmin() must accept 'admin' OR 'super_admin'. Add a new
    requireSuperAdmin() that only accepts 'super_admin'. Do NOT otherwise change getProfile()
    yet — its cross-business email auto-link bug is fixed in a later prompt. Leave a
    // TODO(tenant): business-scope this lookup — see prompt 7 comment at the ilike() call.

11. src/lib/api-auth.ts — requireAdminApi() must accept 'admin' OR 'super_admin'. Add
    requireSuperAdminApi() alongside it. Do not change the cookie/client-construction logic.

VERIFICATION:
  1. Run v31 alone, confirm success, then run v31b.
  2. SELECT unnest(enum_range(NULL::user_role)); must include super_admin.
  3. SELECT count(*) FROM profiles WHERE business_id IS NULL AND role <> 'super_admin';
     must be 0.
  4. npm run typecheck && npm run build must pass.
  5. Log in as the existing admin — /admin must work exactly as before.
  6. Log in as a test client — /dashboard and a project page must work exactly as before.
  7. Promote one account to super_admin manually, log in, confirm /platform is reachable
     (a 404 is fine — the route does not exist yet) and /admin still loads.

Do NOT rewrite RLS policies in this prompt. Do NOT create the /platform routes. Stop here.
```

---

### Prompt 5 — Business-scope every RLS policy

```
Continue the Swift Portal multi-tenant migration. Prerequisites: v29, v30, v31, v31b run and
verified. Read docs/TENANT-AUDIT.md section A (which lists every current policy verbatim) plus
every RLS policy in supabase/schema.sql and all migration-v*.sql files. You must enumerate the
EFFECTIVE current policy set — later migrations DROP and recreate policies, so the last
definition wins. Do this carefully; getting the starting state wrong is the main failure mode.

GOAL: add business scoping to every RLS policy, with super_admin bypass. This is a mechanical,
additive transformation. Do not redesign the access model.

Create supabase/migration-v32-rls-tenant-scope.sql.

For every policy on every business-owned table, apply exactly these transformations, using
DROP POLICY IF EXISTS followed by CREATE POLICY (matching the existing convention):

  Admin policies:
    USING (is_admin())
      becomes
    USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))

  Client policies keyed on client id:
    USING (client_id = get_user_client_id())
      becomes
    USING (business_id = current_business_id() AND client_id = get_user_client_id())

  Client policies keyed on project access:
    USING (client_has_project_access(project_id))
      becomes
    USING (business_id = current_business_id() AND client_has_project_access(project_id))

  For every policy that has a WITH CHECK, apply the same transformation to the WITH CHECK
  expression as well. Where an existing FOR ALL / FOR INSERT policy has only USING, add an
  explicit WITH CHECK so inserts cannot write another business's business_id.

Preserve every other predicate exactly as-is — including deleted_at IS NULL on projects,
sender_user_id = auth.uid() and sender_role = 'client' on the message tables, proposed_by =
'client' on shoot_proposals, and the storage.foldername checks.

Additionally fix these specific pre-existing problems:

A. leads INSERT is currently `WITH CHECK (true)` — anyone can insert into any business. Replace
   with a check that business_id refers to an existing business with status='active' and
   deleted_at IS NULL. Public lead capture must keep working for the active Swift business, so
   verify the public /request flow still succeeds after this change.

B. notifications INSERT is currently `WITH CHECK (true)`. Restrict it so a caller can only
   insert notifications whose business_id = current_business_id(), and keep service-role writes
   working (service role bypasses RLS, so this only tightens the anon/authenticated path).

C. activity_logs INSERT is currently `WITH CHECK (auth.uid() IS NOT NULL)`. Add
   business_id = current_business_id().

D. client_stats view: it is currently GRANT SELECT TO authenticated with NO business filter and
   NO RLS, so any authenticated user can read every client's lifetime_revenue and
   outstanding_balance. This is a live data leak today. Fix it: recreate the view with
   `WITH (security_invoker = true)` if this Postgres version supports it (check the version
   first), so it respects the underlying tables' RLS. If security_invoker is unavailable,
   replace the view with a SECURITY INVOKER function or add an explicit
   `business_id = current_business_id()` filter to the view body and expose business_id as a
   column. Whichever route you take, verify with a real client-role session that it can no
   longer see other clients' rows. Report exactly which approach you used and why.

E. reorder_media_assets(UUID, UUID[]) — the SECURITY DEFINER RPC granted to authenticated (see
   migration-v28). It validates that media belongs to the project but not that the caller
   belongs to the project's business. Add that check and raise a clear exception on mismatch.

F. Storage policies: leave the existing project-media / project-documents / avatars policies
   UNCHANGED in this prompt. Storage path prefixing is a separate, later phase and changing
   these now would break existing client downloads. Add a comment saying so.

End the migration with a verification block containing:
  - A query listing every table with RLS enabled and its policy count, so a human can eyeball
    that nothing lost its policies.
  - A query listing any policy definition that still contains 'is_admin()' but NOT
    'current_business_id()' — this must return zero rows.

Do NOT change any TypeScript in this prompt. Do NOT touch src/.

VERIFICATION:
  1. Run the migration. Run both verification queries; the second must return 0 rows.
  2. npm run typecheck && npm run build.
  3. Full manual regression as the existing admin: /admin dashboard, projects list, one project
     detail, media library, messages, calendar, clients list, leads, settings. All must load
     with the same data as before.
  4. Full manual regression as a test client: /dashboard, project detail, quote view, messages,
     payments, media gallery, download one file. All must work.
  5. Submit the public /request form end to end and confirm a project and preliminary estimate
     are created.

Do not proceed to the test harness or the service-role refactor. Stop here.
```

---

### Prompt 6 — Tenant-isolation test harness

```
Continue the Swift Portal multi-tenant migration. Prerequisites: v29–v32 run and verified.

This repository has ZERO automated tests. Before we touch the 55 files that use the Supabase
service role, we need a repeatable way to prove tenant isolation. That is this prompt's only job.

Read docs/TENANT-AUDIT.md and supabase/migration-v29 through v32 first.

Create supabase/tests/tenant-isolation.sql — a single, self-contained, idempotent SQL script,
runnable in the Supabase SQL editor, that:

1. Creates a SECOND test business with a fixed UUID '00000000-0000-0000-0000-0000000000ff',
   slug 'test-tenant-b', name 'Test Tenant B'.

2. Creates a complete, realistic data set inside Tenant B: one admin profile, one client with a
   profile, one property, one project, one media_folder, two media_assets, one project_quote,
   one payment, one shoot_proposal, one client_message, one activity_log, one notification.
   All with business_id = the Tenant B UUID. Use fixed UUIDs so the script is re-runnable.
   Note: profiles has an FK to auth.users, so create the auth.users rows too, or document
   clearly that a human must create two test auth users first and paste their UUIDs at the top
   of the script as variables. Choose whichever is actually reliable and say which.

3. ISOLATION ASSERTIONS. For each of the following, run the query with the RLS context set to a
   Swift-business admin (use `SET LOCAL ROLE authenticated` plus
   `SET LOCAL request.jwt.claims` to impersonate a specific auth.uid(), the standard Supabase
   pattern — verify it actually works on this project before relying on it) and assert the
   result count is ZERO:
     - SELECT from clients, projects, properties, leads, payments, project_quotes,
       media_assets, media_folders, tours, revisions, shoot_proposals, client_messages,
       project_messages, notifications, communications, activity_logs, client_notes,
       email_events, asset_reviews, media_asset_tags — filtered to Tenant B's rows.
     - SELECT from client_stats for Tenant B's client.
   Each assertion must RAISE EXCEPTION with a clear message naming the table if any row leaks.

4. CROSS-TENANT WRITE ASSERTIONS. As the Swift admin, attempt each of these and assert each
   one FAILS:
     - INSERT a project with Tenant B's client_id
     - INSERT a payment referencing Tenant B's project
     - INSERT a media_asset referencing Tenant B's project
     - UPDATE Tenant B's project status
     - UPDATE Tenant B's payment to status='paid'
     - DELETE Tenant B's client
     - CALL reorder_media_assets with Tenant B's project and media ids
   Use BEGIN/EXCEPTION blocks; RAISE EXCEPTION if any of them SUCCEEDS.

5. REVERSE-DIRECTION ASSERTIONS: repeat the read assertions from a Tenant B admin's context
   against Swift's real data. Zero rows.

6. CLIENT-ROLE ASSERTIONS: from Tenant B's client context, assert zero visibility of Swift data
   AND zero visibility of Tenant B's other clients (if you create a second client).

7. A final summary SELECT printing 'ALL TENANT ISOLATION TESTS PASSED' plus the assertion count.

8. A clearly separated teardown section at the bottom that deletes all Tenant B data and the
   Tenant B business, so the script leaves no residue. It must be safe to run against
   production (it must be impossible for teardown to touch the Swift business — hardcode the
   Tenant B UUID everywhere and add a guard).

Also create docs/TENANT-TESTING.md explaining: how to run the script, what each assertion group
proves, and an explicit instruction that this script MUST be re-run and pass after every
subsequent migration or refactor in this project.

Do NOT modify any application code. Do NOT modify any existing migration.

VERIFICATION:
  1. Run supabase/tests/tenant-isolation.sql. It must reach 'ALL TENANT ISOLATION TESTS PASSED'.
  2. Deliberately break one thing to prove the harness works: temporarily drop the business_id
     predicate from ONE policy (e.g. clients), re-run, and confirm the script FAILS with a clear
     message. Then restore the policy and confirm it passes again. Report the output of all
     three runs.
  3. Run the teardown and confirm Swift's data is untouched: counts of clients, projects,
     payments, and media_assets for business 00000000-...0001 must be identical before and after.

Stop here. Do not begin the service-role refactor.
```

---

### Prompt 7 — Tenant context resolution and the leaking module caches

```
Continue the Swift Portal multi-tenant migration. Prerequisites: v29–v32 plus the test harness
from prompt 6, all passing.

Read docs/TENANT-AUDIT.md sections F (shared-state inventory) and G (integrations), plus
src/lib/auth.ts, src/lib/api-auth.ts, src/lib/app-settings.ts, src/lib/stripe.ts,
src/lib/email.ts, src/lib/supabase/server.ts, src/proxy.ts.

GOAL: one canonical way to know which business the current request belongs to, and elimination
of cross-tenant leaks caused by module-level caches. No user-visible behavior change.

PART A — tenant context

Create src/lib/tenant.ts exporting:
  export interface TenantContext {
    businessId: string;
    business: { id: string; slug: string; name: string; status: string; custom_domain: string | null };
    role: 'super_admin' | 'admin' | 'client';
    isSuperAdmin: boolean;
    impersonating: boolean;
  }
  getTenantContext(): Promise<TenantContext | null>   // from the authenticated profile
  requireTenantContext(): Promise<TenantContext>      // throws when absent
  requireBusinessAdmin(): Promise<TenantContext>      // admin or super_admin (with context)

Resolution: profile.business_id for admins; for clients, profile.client_id -> clients.business_id
(fall back to clients.user_id lookup). For super_admin, read the impersonation cookie if present
(name it sa_business_context) and set impersonating: true; otherwise businessId resolution
returns null and callers must handle it. Cache the resolved context per REQUEST only — use React
`cache()` from 'react' for server components, and no module-level variable. Read the Next.js 16
docs in node_modules/next/dist/docs/ for the current guidance on per-request caching before you
pick an approach.

PART B — fix the module-level cache leaks (this is a real, active bug class)

1. src/lib/app-settings.ts currently holds `let cachedSettings: AppSettings | null` and
   `let cacheExpiresAt` at module scope with a 30s TTL. In a warm server this serves one
   business's branding, email sender, and workflow config to another business. Convert to a
   `Map<string, { settings: AppSettings; expiresAt: number }>` keyed by businessId. Change
   getAppSettings() to getAppSettings(businessId: string) and
   invalidateAppSettingsCache(businessId?: string). Keep the AppSettings TYPE and
   DEFAULT_APP_SETTINGS shape EXACTLY as they are — only the cache and the load/save signatures
   change. It still reads app_settings id=1 in this prompt; the table split happens in prompt 8.
   For now, thread the businessId through but have the loader ignore it and read id=1, so
   behavior is unchanged. Add a // TODO(tenant): read business_settings — prompt 8.

2. Update EVERY caller of getAppSettings() to pass a businessId. Find them all (there are many:
   admin/layout.tsx, dashboard/layout.tsx, email.ts, workflow.ts, preliminary-estimates.ts,
   notifications.ts, api/admin/settings/route.ts, and more). Where the caller has a tenant
   context, use it. Where it does not yet (webhooks, cron), pass the Swift business UUID via an
   explicit, clearly-named constant so it is easy to grep and remove later:
   export const LEGACY_DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001' in
   src/lib/tenant.ts, with a comment that every use is a TODO to be removed.

3. src/lib/email.ts — `let lastEmailSendResult` at module scope leaks one business's last email
   recipient and subject to another business's admin via the settings diagnostics panel. Make it
   a Map keyed by businessId, and make getLastEmailSendResult(businessId) require the key.

4. src/lib/stripe.ts — `let stripeInstance` is a module singleton. Leave the shared-platform
   instance for now but restructure getStripe() to accept an optional per-business config and
   cache per key in a Map, so prompt 17 (Stripe Connect) is a small change rather than a rewrite.
   Do not change any Stripe behavior in this prompt.

5. src/lib/email.ts — `let resend` module singleton: same treatment, keyed by API key. Behavior
   unchanged today.

Scan src/lib/ for any OTHER module-scope `let`/`var` and fix or explicitly document each as safe.

PART C — fix the cross-business client auto-link bug

src/lib/auth.ts getProfile() runs `.ilike("email", user.email)` across ALL clients and then
writes profiles.client_id. With two businesses this links a user to the wrong business's client
record. Scope both the user_id and email lookups by the business resolved from the profile; if
the profile has no business_id and the email matches clients in MORE THAN ONE business, do NOT
guess — log a clear warning, leave client_id null, and return the profile. Add a code comment
explaining the one-auth-user-many-businesses limitation.

VERIFICATION:
  1. npm run typecheck && npm run build must pass with zero errors.
  2. Re-run supabase/tests/tenant-isolation.sql — must still pass.
  3. grep for `^\s*let ` in src/lib/*.ts and confirm every remaining hit is either request-scoped
     or documented as tenant-safe. Paste the list.
  4. Manual regression, admin: /admin, project detail, /admin/settings (change the business name,
     save, confirm it persists and the header updates), /admin/media, /admin/messages,
     /admin/calendar.
  5. Manual regression, client: /dashboard, project detail, quote, message send, payment view.
  6. Send the test email from /admin/settings and confirm it still sends and the diagnostic
     result still displays.
  7. Confirm the public /request flow still creates a project + preliminary estimate.

Do NOT split app_settings into business_settings yet. Do NOT refactor the service-role call
sites yet. Stop here.
```

---

### Prompt 8 — Per-business settings table

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–7 complete, test
harness passing.

Read src/lib/app-settings.ts, src/lib/workflow-settings.ts, src/lib/portal-brand.ts,
src/app/api/admin/settings/route.ts, src/components/admin/admin-settings-client.tsx,
src/components/admin/workflow-settings-card.tsx, and supabase/migration-v13-admin-settings.sql.

GOAL: replace the singleton app_settings table with per-business settings, without changing the
AppSettings TypeScript shape or the settings UI.

Note the blocker: app_settings is `id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1)`. You cannot
add a business_id and keep that constraint. Create a new table; do not try to alter it in place.

Create supabase/migration-v33-business-settings.sql that:

1. CREATE TABLE IF NOT EXISTS business_settings (
     business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
     settings JSONB NOT NULL DEFAULT '{}'::jsonb,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
   );
   Add the updated_at trigger.

2. Copies the existing app_settings id=1 row's `settings` JSONB verbatim into business_settings
   for the Swift business UUID. Verbatim — do not transform, reshape, or re-key it. Swift's live
   branding, email config, notification toggles, proposal rules, and workflow templates all live
   in that blob and must survive byte-identical.

3. Enables RLS on business_settings with:
     super_admin: full access
     admin: full access WHERE business_id = current_business_id()
     no client access
   (The app reads/writes via the service role, but these policies are defense-in-depth.)

4. Inserts an empty '{}' row for any business that has none, so getAppSettings never 404s.

5. LEAVES app_settings in place, untouched, as a rollback safety net. Add a comment that it can
   be dropped in a later cleanup migration once business_settings is proven in production.

6. Ends with a verification query comparing app_settings.settings and
   business_settings.settings for the Swift business — they must be identical
   (`SELECT app_settings.settings = business_settings.settings AS identical`).

Then update the application:

7. src/lib/app-settings.ts — getAppSettings(businessId) now reads business_settings by
   business_id (removing the prompt-7 TODO), and saveAppSettings(patch, updatedBy, businessId)
   upserts by business_id. Keep mergeAppSettings, DEFAULT_APP_SETTINGS, the AppSettings interface,
   NOTIFICATION_EVENT_DEFINITIONS, addProposalExpiration, and getBrandFromSettings signatures
   and behavior unchanged. Keep the per-business Map cache from prompt 7.

8. src/app/api/admin/settings/route.ts — resolve the business from the tenant context and pass
   it through. A super_admin without an impersonation context must get a clear 400, not a silent
   write to the wrong business.

9. Do NOT change admin-settings-client.tsx or workflow-settings-card.tsx unless a prop type
   forces it. The settings UI should be unaffected.

VERIFICATION:
  1. Run the migration; the identity check in step 6 must return true.
  2. npm run typecheck && npm run build.
  3. Open /admin/settings as the Swift admin. Every field — business name, portal name, admin
     display name, contact email, phone, website, logo URL, both brand colors, email from-name /
     sender / reply-to / footer, all 19 notification event toggles, all proposal settings, all
     workflow stage automations, all reminder timings, and every message template subject+body —
     must show exactly the same values as before this migration. Compare against a screenshot or
     a JSON dump of app_settings taken beforehand. Report any field that differs.
  4. Change the business name, save, reload — it must persist and appear in the admin header.
  5. Confirm the client portal header/branding still renders correctly.
  6. Re-run supabase/tests/tenant-isolation.sql, extended with an assertion that a Tenant B admin
     cannot read Swift's business_settings row.

Stop here. Do not refactor the service-role call sites yet.
```

---

### Prompt 9 — Tenant-scoped service client + core write paths

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–8 complete, test
harness passing.

Read docs/TENANT-AUDIT.md section B (the service-role inventory) in full before writing code.

CONTEXT YOU MUST UNDERSTAND: 55 files call createServiceClient(), which uses
SUPABASE_SERVICE_ROLE_KEY and BYPASSES ROW LEVEL SECURITY COMPLETELY. Every one of those queries
is invisible to the policies we wrote in prompt 5. The DB triggers from prompt 3 catch
cross-tenant PARENT references, but they cannot catch a bare
`select * from clients` with no business filter. Those reads are the leak.

This prompt builds the tooling and converts the FIRST batch only. Do not attempt all 55 files at
once — that is how this migration breaks.

PART A — the wrapper

Create src/lib/supabase/tenant-service.ts exporting:
  createTenantServiceClient(businessId: string)
which returns an object with:
  - businessId
  - raw: the underlying service-role SupabaseClient (escape hatch, must be used deliberately)
  - from(table): a thin wrapper whose select/update/delete automatically append
    .eq('business_id', businessId), and whose insert/upsert automatically inject
    business_id: businessId into every row (single or array), without overwriting an
    explicitly-set matching value and THROWING if an explicit value differs.

Implement this so it is genuinely type-safe enough to be useful and does not silently drop
filters. If a fluent proxy over the Supabase builder proves fragile, prefer an explicit, boring
helper API (e.g. tenantSelect(db, table, cb)) over a clever proxy. Correctness over elegance —
say which you chose and why.

Add a short doc comment listing the tables that are NOT business-scoped and must use .raw:
profiles (super_admin rows), businesses, processed_stripe_events, and storage.

PART B — convert this batch ONLY

Convert these files to resolve a businessId (from tenant context, or from the parent record they
already load, or from an explicit parameter) and use the tenant-scoped client:

  src/lib/activity.ts
  src/lib/clients-crm.ts
  src/lib/clients-data.ts
  src/lib/client-portal-link.ts
  src/lib/properties.ts
  src/lib/soft-delete.ts
  src/app/api/clients/route.ts
  src/app/api/clients/[id]/route.ts
  src/app/api/clients/[id]/notes/route.ts
  src/app/api/clients/[id]/portal/route.ts
  src/app/api/projects/route.ts
  src/app/api/projects/[id]/route.ts
  src/app/api/project-clients/route.ts

Rules for every file you touch:
  - Every insert must set business_id.
  - Every select/update/delete on a business-owned table must filter by business_id.
  - Where a function currently takes only an id, add an explicit businessId parameter rather
    than resolving it inside a library function — callers have the context and implicit
    resolution hides bugs.
  - Do NOT change any function's observable behavior, return shape, error messages, or HTTP
    status codes. This is a scoping change only.
  - Where you genuinely cannot resolve a businessId, use LEGACY_DEFAULT_BUSINESS_ID from
    src/lib/tenant.ts and add a // TODO(tenant): explaining what is needed. Do not silently skip
    the filter.

Produce docs/SERVICE-ROLE-MIGRATION.md: a checklist of all 55 files with their status
(done / pending / N-A), so later prompts can pick up exactly where this one stopped. Mark this
batch done and everything else pending.

VERIFICATION:
  1. npm run typecheck && npm run build.
  2. Re-run supabase/tests/tenant-isolation.sql — must pass.
  3. Manual regression on everything this batch touches: create a client, edit a client, add a
     client note, soft-delete and restore a client, generate a client portal link, create a
     project, edit a project, add a second client to a project, remove a client from a project,
     soft-delete a project. Every one must behave exactly as before.
  4. grep the converted files for `createServiceClient` and confirm each remaining use is either
     replaced or explicitly justified in a comment. Paste the results.

Do NOT convert the media, notification, payment, quote, scheduling, or messaging files in this
prompt. Stop here.
```

---

### Prompt 10 — Service-role batch 2: media and storage reads

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompt 9 complete;
docs/SERVICE-ROLE-MIGRATION.md exists.

Read docs/SERVICE-ROLE-MIGRATION.md and docs/TENANT-AUDIT.md section B, then read every file
listed below in full before changing any of them. The media pipeline is the most intricate part
of this app (TUS resumable uploads, signed URLs, thumbnails, property-line annotations, ZIP
downloads, folder ordering) and the easiest to break.

Convert to the tenant-scoped service client:
  src/lib/media-library.ts
  src/lib/media-upload.ts
  src/app/api/media/upload/route.ts
  src/app/api/media/upload/sign/route.ts
  src/app/api/media/upload/complete/route.ts
  src/app/api/media/[id]/route.ts
  src/app/api/media/[id]/property-line/route.ts
  src/app/api/media/bulk/route.ts
  src/app/api/media/download/[id]/route.ts
  src/app/api/media/library/route.ts
  src/app/api/media/library/[id]/route.ts
  src/app/api/media/move-to-folder/route.ts
  src/app/api/media/reorder/route.ts
  src/app/api/media/youtube/route.ts
  src/app/api/media-folders/route.ts
  src/app/api/tours/route.ts
  src/app/api/projects/[id]/download-zip/route.ts
  src/app/api/asset-reviews/route.ts

Specific requirements:

1. queryMediaLibrary() and getLibraryFilterOptions() in media-library.ts are the highest-risk
   functions in this batch — the media library lists assets across ALL projects and includes
   unassigned assets with project_id IS NULL. Without a business_id filter, one business's admin
   sees every other business's photos. Add the filter to the base query AND to every filter-option
   aggregation (client list, property list, service list, tag list).

2. The upsert-by-file_path logic must use the (business_id, file_path) conflict target created in
   migration-v30, not the old global file_path index.

3. Every media_assets, media_folders, media_asset_tags, media_downloads, and media_asset_events
   insert must set business_id.

4. Signed-URL generation and the download route must verify the asset's business_id matches the
   caller's business BEFORE minting a URL. A signed URL is a bearer capability — an authorization
   miss here leaks the actual file, not just a row.

5. Do NOT change storage paths, bucket names, or storage RLS policies in this prompt. Path
   prefixing is prompt 13. Add a // TODO(tenant): prefix storage paths — prompt 13 at the one
   place in src/lib/media-upload.ts where the prefix is computed.

6. Do NOT change upload behavior, chunk sizes, TUS config, retry logic, progress reporting,
   thumbnail generation, or error messages.

Update docs/SERVICE-ROLE-MIGRATION.md.

VERIFICATION:
  1. npm run typecheck && npm run build.
  2. Re-run supabase/tests/tenant-isolation.sql, extended with: a Tenant B media_asset must be
     invisible to a Swift admin via queryMediaLibrary's underlying query shape, and an unassigned
     (project_id IS NULL) Tenant B asset must also be invisible.
  3. Manual regression — do ALL of these against a real project:
     - Upload a photo via the admin media modal; confirm progress, completion, and thumbnail.
     - Upload a video larger than 100 MB (exercises the TUS resumable path).
     - Upload a PDF (project-documents bucket).
     - Add a YouTube video.
     - Add a 360 tour.
     - Reorder photos by drag and drop; reload and confirm the order persisted.
     - Create a folder, move photos into it, reorder, delete the folder.
     - Edit an asset's title, description, alt text, favorite flag, downloadable flag.
     - Use the property-line editor: draw, save, confirm the rendered preview and that the
       editable coordinates round-trip.
     - Download a single asset as admin, then as the client.
     - Download the project ZIP.
     - Open /admin/media, exercise EVERY filter (type, service, property type, project status,
       source, date presets, custom date range, client, property, favorites) and pagination.
     - As a client, open the project gallery, open the lightbox, download a photo.
  4. Confirm no console or server errors during any of the above.

Do NOT convert notifications, email, payments, quotes, scheduling, or messaging. Stop here.
```

---

### Prompt 11 — Service-role batch 3: notifications, messaging, email

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompt 10 complete.

Read docs/SERVICE-ROLE-MIGRATION.md, then read in full:
  src/lib/notifications.ts
  src/lib/client-messaging.ts
  src/lib/client-messages.ts
  src/lib/client-email-notifications.ts
  src/lib/communication-records.ts
  src/lib/communications.ts
  src/lib/email.ts
  src/lib/email-templates.ts
  src/lib/email-analytics.ts
  src/lib/message-templates.ts
  src/lib/onesignal-push.ts
  src/app/api/messages/route.ts
  src/app/api/projects/[id]/messages/route.ts
  src/app/api/notifications/route.ts
  src/app/api/admin/email/route.ts
  src/app/api/admin/push/route.ts
  src/app/api/resend/webhook/route.ts

CRITICAL BUG TO FIX: notifications.ts around line 78 does
`.from("profiles").select(...).eq("role", "admin")` with no other filter. Today that is fine.
The moment there are two businesses, EVERY business admin receives push, email, and in-app
notifications about EVERY other business's projects — including client names, property
addresses, and dollar amounts. Fix this first and verify it explicitly.

Requirements:

1. notifyAdmins / notifyUsers / notifyProjectClients / notifyClient must all take or resolve a
   businessId, and every profiles/clients/projects/project_clients lookup inside them must
   filter by it. The admin recipient query must be
   role IN ('admin') AND business_id = <businessId> — note super_admins must NOT receive
   business notifications by default.

2. Every notifications and communications insert must set business_id.

3. Email: sendBrandedEmail and the template builders must take the business's settings (already
   per-business after prompt 8) so from-name, reply-to, footer text, logo, and colors come from
   the right business. Do NOT implement per-business verified sending domains in this prompt —
   that is prompt 15. For now: shared Resend API key, per-business from-NAME and reply-to, and
   the platform's verified sender address. Add a // TODO(tenant): per-business sending domain —
   prompt 15.

4. Resend webhook (/api/resend/webhook): it currently resolves a project from the email tags.
   Add a business_id tag when sending, and on receipt resolve the business from that tag AND
   cross-check it against the project's business_id before writing email_events or
   communications. Reject mismatches with a logged warning; never write a row you cannot
   attribute.

5. OneSignal: keep one OneSignal app. When a subscription is registered, tag it with
   business_id. When sending admin push, add a tag filter for that business_id so no
   cross-business push is possible. Read the current onesignal-push.ts send payload carefully and
   make the minimum change that adds the filter.

6. Both message systems (client_messages and project_messages) get business_id on every insert
   and a business filter on every read. Do NOT consolidate the two systems — that is separate
   work.

7. Do not change notification copy, channel-toggle semantics, dedupe logic, or the
   NotificationEventKey list in this prompt.

Update docs/SERVICE-ROLE-MIGRATION.md.

VERIFICATION:
  1. npm run typecheck && npm run build.
  2. Extend supabase/tests/tenant-isolation.sql with: creating a Tenant B project notification
     must produce ZERO notification rows for any Swift-business profile, and vice versa. Run it.
  3. Manual regression: as a client send a project message and confirm the admin gets in-app +
     email + push. As admin reply and confirm the client gets in-app + email. Confirm the
     notification bell count, the mark-as-read behavior, and the deep link all still work.
  4. Send the test email from /admin/settings; confirm delivery, and confirm the email header
     logo, business name, colors, and footer text all come from business_settings.
  5. Trigger a Resend webhook (or replay a real one) and confirm email_events and communications
     rows are written with the correct business_id.
  6. Toggle off one notification event's email channel in /admin/settings, trigger it, and
     confirm no email is sent — the toggle semantics must be unchanged.

Do NOT convert payments, quotes, scheduling, or the request flow. Stop here.
```

---

### Prompt 12 — Service-role batch 4: quotes, payments, scheduling, automation, request flow

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompt 11 complete.

Read docs/SERVICE-ROLE-MIGRATION.md, then read in full:
  src/lib/preliminary-estimates.ts
  src/lib/pricing-workflow.ts
  src/lib/quote-archive.ts
  src/lib/payment-quote.ts
  src/lib/payment-status.ts
  src/lib/stripe-payments.ts
  src/lib/stripe-webhook-events.ts
  src/lib/status-automation.ts
  src/lib/workflow.ts
  src/lib/scheduling.ts
  src/lib/google-calendar.ts
  src/lib/ghl/sync-portal-lead.ts
  src/lib/ghl/build-portal-lead-payload.ts
  src/app/api/quotes/route.ts
  src/app/api/approvals/route.ts
  src/app/api/revisions/route.ts
  src/app/api/shoot-proposals/route.ts
  src/app/api/payments/route.ts
  src/app/api/payments/[id]/route.ts
  src/app/api/payments/[id]/checkout/route.ts
  src/app/api/payments/[id]/receipt/route.ts
  src/app/api/stripe/webhook/route.ts
  src/app/api/request/route.ts
  src/app/api/request/logged-in/route.ts
  src/app/api/leads/route.ts
  src/app/api/leads/[id]/route.ts
  src/app/api/cron/workflow-reminders/route.ts
  src/app/api/profile/route.ts
  src/app/api/profile/avatar/route.ts
  src/app/api/google-calendar/route.ts
  src/app/api/google-calendar/connect/route.ts
  src/app/api/google-calendar/callback/route.ts

This is the money-and-lifecycle batch. A mistake here can mark the wrong business's payment
paid or move the wrong project's status. Be conservative.

Requirements:

1. Every insert into project_quotes, payments, revisions, shoot_proposals, asset_reviews, leads,
   properties, activity_logs, and communications sets business_id. Every read filters by it.

2. src/app/api/request/route.ts is PUBLIC and UNAUTHENTICATED and creates an auth user, a
   client, a project, a lead, activity logs, a preliminary estimate, admin notifications, and a
   GHL sync. It must now determine WHICH BUSINESS the request belongs to. In this prompt, resolve
   it from an explicit `business_slug` or `business_id` field in the request body, falling back to
   LEGACY_DEFAULT_BUSINESS_ID when absent so the existing public form keeps working unchanged.
   Validate that the business exists, is status='active', and is not soft-deleted — reject
   otherwise with a 400. Subdomain/host-based resolution comes in prompt 18; leave a
   // TODO(tenant): resolve business from host — prompt 18.
   The auth user must be created with business_id in user_metadata so handle_new_user() (updated
   in v31b) writes profiles.business_id.

3. src/app/api/request/logged-in/route.ts must use the authenticated user's own business and must
   never accept a business id from the request body.

4. Stripe webhook: this is the highest-risk route in the codebase. It currently resolves a
   payment from metadata / checkout session / payment intent and then writes status. After
   resolving the payment, you must ALSO verify the resolved payment's business_id is consistent
   with the event before any write. Since Stripe Connect is not wired up yet (prompt 17), the
   platform account is still shared, so at minimum: log the resolved business_id on every event,
   and add an explicit assertion + hard rejection path for the case where a metadata-supplied
   business id disagrees with the payment row's business_id. Do NOT change idempotency handling,
   the processed_stripe_events logic, or any existing success/failure path behavior.

5. status-automation.ts setProjectStatus / setProjectStatusForward: business-scope every lookup,
   and load workflow settings for the project's OWN business — not a cached global. Verify with
   two businesses that have DIFFERENT autoAdvance settings that each project follows its own
   business's rules.

6. Cron /api/cron/workflow-reminders currently sweeps globally. Rewrite it to iterate
   `businesses WHERE status='active' AND deleted_at IS NULL` and run the existing per-business
   sweep logic for each, loading that business's reminder settings. Keep the CRON_SECRET bearer
   check exactly as it is. Make it resilient: one business erroring must not abort the others —
   log and continue, and report a per-business summary in the response.

7. Google Calendar: google_calendar_connections is a singleton with CHECK (id = 1) and cannot
   hold a business_id. Create supabase/migration-v34-gcal-per-business.sql that creates
   google_calendar_connections_v2 keyed by business_id (business_id UUID PRIMARY KEY REFERENCES
   businesses, plus every existing column), copies the id=1 row to the Swift business, enables
   business-scoped RLS, and leaves the old table in place for rollback. Update google-calendar.ts
   to read/write the new table. The OAuth connect flow must carry business_id in a SIGNED state
   parameter and the callback must verify it — an unsigned state is an account-takeover vector
   for calendar connections. Verify the signature check actually rejects tampered state.

8. GoHighLevel: move the webhook URL from the GHL_PORTAL_LEAD_WEBHOOK_URL env var to per-business
   settings (add a `ghlWebhookUrl` field to the integrations area of AppSettings, defaulting to
   the env var so Swift's behavior is unchanged). Skip the sync silently when a business has no
   URL configured.

Update docs/SERVICE-ROLE-MIGRATION.md and confirm every one of the 55 files is now marked done or
explicitly N-A with a reason. Paste the final tally.

VERIFICATION:
  1. npm run typecheck && npm run build.
  2. Re-run and extend supabase/tests/tenant-isolation.sql: a Swift admin must not be able to
     read or update a Tenant B payment, quote, shoot_proposal, or lead.
  3. Manual regression — the FULL lifecycle, end to end, on a fresh test project:
     public /request submit -> preliminary estimate appears in the client portal ->
     admin sends official proposal -> client requests changes -> admin sends revised proposal ->
     client approves -> admin proposes a shoot date -> client counter-proposes -> admin confirms ->
     Google Calendar event created -> admin marks shoot complete -> admin uploads media ->
     admin sends for review -> client approves deliverables -> admin creates a Stripe payment
     link -> client pays with a Stripe test card -> webhook fires -> payment marks paid ->
     downloads unlock -> project marks delivered -> receipt renders.
     Every single step must work. Report any step that does not.
  4. Confirm the activity timeline and the admin notification feed show the correct entries for
     the whole run.
  5. Hit /api/cron/workflow-reminders with the correct bearer token and confirm the per-business
     summary response.
  6. Reconnect Google Calendar from /admin/calendar and confirm the signed-state check works;
     then tamper with the state parameter and confirm it is rejected.

Stop here.
```

---

### Prompt 13 — Storage path prefixing (both shapes supported)

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–12 complete.

Read src/lib/media-upload.ts (note line ~43: `const prefix = projectId ? projectId :
"library/unassigned"`), src/lib/upload/*, every route under src/app/api/media/, and every storage
policy in supabase/schema.sql and supabase/migration-v12-avatars-bucket.sql.

GOAL: prefix NEW storage objects with business_id, without breaking the thousands of existing
objects that live at {project_id}/... or library/unassigned/...

HARD CONSTRAINT — READ CAREFULLY: media_assets.file_path and storage_path hold ABSOLUTE object
paths for real client media that is live today. DO NOT move, copy, rename, or re-key any existing
storage object. DO NOT rewrite any existing file_path value. Every existing client download must
keep working byte-for-byte. Migration of old objects is explicitly out of scope forever; the two
path shapes coexist permanently.

The urgent problem is `library/unassigned/` — it is a single GLOBAL namespace shared by every
business. New writes must never go there again.

1. Change the path builder so NEW uploads use:
     {business_id}/{project_id}/{filename}       for project-attached media
     {business_id}/library/{filename}            for unassigned library media
   Implement this as a single exported function (e.g. buildStoragePath({businessId, projectId,
   fileName})) and route every upload path through it — direct upload, TUS resumable, signed
   upload, and the property-line save path. Grep to confirm there is no second place constructing
   a path.

2. Create supabase/migration-v35-storage-tenant-paths.sql that replaces the project-media and
   project-documents storage policies so they accept BOTH shapes:
     - Legacy: (storage.foldername(name))[1] is a project id the caller can access (keep the
       EXACT existing predicate for this branch, including the project_clients junction lookup
       from migration-v3).
     - New: (storage.foldername(name))[1] = current_business_id()::text AND, for the
       {business}/{project}/ form, (storage.foldername(name))[2] is a project the caller can
       access; for the {business}/library/ form, the caller is an admin of that business.
   Admin upload/update/delete policies get the same two-shape treatment plus a business check.
   Write these as one policy per operation with an OR between the two shapes — do not create
   overlapping duplicate policies.
   Leave the avatars bucket policies unchanged (they are keyed on auth.uid()).

3. Do NOT change bucket names, size limits, or MIME allowlists.

4. Add a comment block in the migration documenting the two-shape scheme and why old objects are
   never moved, so a future developer does not "clean it up".

VERIFICATION — this is the highest-regression-risk prompt in the series. Do all of it:
  1. Run the migration.
  2. npm run typecheck && npm run build.
  3. LEGACY PATHS (most important): pick a project that has media uploaded BEFORE this change.
     As admin, view its gallery, open the lightbox, download a photo, download a video, download
     a document, and download the project ZIP. Then log in as that project's CLIENT and repeat
     every one. All must work. If any legacy download breaks, STOP and fix it before continuing.
  4. NEW PATHS: upload a photo, a >100 MB video (TUS path), and a PDF to a project. Confirm the
     stored file_path begins with the business UUID. Download each as admin and as the client.
  5. Upload to the unassigned library; confirm the path is {business}/library/... and that it
     appears in /admin/media.
  6. Save a property-line annotation and confirm both the rendered preview and the editable
     coordinates round-trip.
  7. Mixed project: confirm a project containing BOTH legacy and new-path assets renders and
     downloads every asset, and that its ZIP contains all of them.
  8. Extend supabase/tests/tenant-isolation.sql with a storage assertion: a Tenant B object under
     its own business prefix must not be selectable by a Swift admin. Run the full harness.

Stop here. Do not touch branding or services.
```

---

### Prompt 14 — Database-driven branding

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–13 complete.

Read docs/TENANT-AUDIT.md section C (the hardcoded brand inventory), plus src/lib/brand.ts,
src/lib/portal-brand.ts, src/lib/site-metadata.ts, src/components/brand/brand-provider.tsx,
src/components/brand/logo.tsx, src/app/layout.tsx, src/app/manifest.ts,
src/app/opengraph-image.tsx, src/app/twitter-image.tsx, src/app/admin/layout.tsx,
src/app/dashboard/layout.tsx.

GOAL: every business-identifying string, color, logo, and contact detail comes from
business_settings. Swift Aerial Media's rendered output must be pixel-identical afterward.

1. Extend the BusinessSettings interface in src/lib/app-settings.ts with the fields the audit
   shows are still hardcoded. At minimum: supportEmail, addressLine1, addressLine2, city, state,
   postalCode, country, legalName (for copyright lines), tagline, faviconUrl, emailLogoUrl,
   termsUrl, privacyUrl. Give every one a default that reproduces Swift's current output exactly.
   Do not remove or rename any existing field.

2. src/lib/brand.ts: keep BRAND, LOGO_URL, FILE_SIZE_LIMITS, and formatFileSize exported so
   nothing breaks, but re-document BRAND as "platform fallback only — never render this to a
   user". FILE_SIZE_LIMITS and formatFileSize are not brand data; leave them alone.

3. src/lib/portal-brand.ts: extend PortalBrand with the new fields and map them in
   getPortalBrandFromSettings(). Rename SWIFT_BUSINESS_DEFAULTS to PLATFORM_BUSINESS_DEFAULTS
   with generic platform values, and move Swift's actual values into a seed migration
   (supabase/migration-v36-seed-swift-branding.sql) that writes them into Swift's
   business_settings row ONLY IF that field is currently empty. Verify Swift's settings row
   already contains its real values from the prompt-8 copy before assuming the seed is needed —
   report what you found.

4. src/components/brand/brand-provider.tsx: DEFAULT_BRAND must become platform-generic. Extend
   the injected CSS variables to cover everything components need. Note it currently uses
   dangerouslySetInnerHTML for :root vars — keep that approach but ensure the color values are
   validated as hex/rgb before injection so a malicious business admin cannot inject CSS or break
   out of the style block. This is a real stored-XSS-adjacent risk once businesses are self-serve.
   Add the same validation to the settings save path.

5. Replace EVERY hardcoded user-facing brand string from audit section C with a value from the
   brand context (client components) or from getAppSettings(businessId) (server components and
   API routes). Work through these files:
     src/components/landing/landing-page.tsx (18 occurrences — includes an external
       swiftaerialmedia.com link, a showreel iframe, and alt text)
     src/lib/journey.ts (4)
     src/lib/client-messages.ts
     src/components/layout/footer.tsx
     src/app/not-found.tsx
     src/components/ui/url-toast-handler.tsx
     src/components/projects/project-hero.tsx
     src/components/projects/project-messages.tsx
     src/components/projects/proposal-card.tsx
     src/components/projects/quote-section.tsx
     src/components/projects/payments-section.tsx
     src/components/projects/shoot-scheduling.tsx
     src/components/projects/client-messages-chat.tsx
     src/components/admin/push-notifications-card.tsx
     src/components/admin/google-calendar-card.tsx
     src/components/admin/admin-settings-client.tsx (the "reset to Swift defaults" copy)
     src/app/admin/settings/page.tsx
     src/app/dashboard/settings/settings-client.tsx
     src/app/api/messages/route.ts
     src/app/api/projects/[id]/messages/route.ts
     src/app/api/quotes/route.ts
     src/app/api/revisions/route.ts
     src/app/api/shoot-proposals/route.ts
     src/app/api/payments/[id]/receipt/route.ts (a full HTML receipt with the business name)
   For server-side notification and email bodies, load the project's business settings — do not
   reach for a request-scoped context that may not exist in a webhook or cron path.

6. src/lib/site-metadata.ts: SITE is used in the ROOT layout, which has no tenant context. Make
   root metadata platform-generic, and add per-tenant metadata via generateMetadata in the
   tenant-scoped layouts (/admin, /dashboard) and, once prompt 18 lands, the public tenant
   layout. Read node_modules/next/dist/docs/ for the current Next.js 16 metadata API before
   implementing — do not assume older conventions.

7. src/app/manifest.ts, opengraph-image.tsx, twitter-image.tsx: make these platform-generic for
   now and add a // TODO(tenant): per-business PWA manifest and OG images — later phase. Do not
   attempt per-tenant PWA manifests in this prompt; they interact with service-worker scope and
   installed-app identity and need their own phase.

8. next.config.js: images.remotePatterns currently allows assets.cdn.filesafe.space (Swift's
   logo host). Businesses will upload logos to arbitrary hosts. Prefer requiring logos to be
   uploaded into a Supabase storage bucket (create a public `business-logos` bucket with
   business-scoped write policies) rather than opening remotePatterns to arbitrary hosts. Keep the
   filesafe.space entry so Swift's current logo keeps working. Implement the bucket and wire the
   settings logo field to an upload control if that is a small change; otherwise create the
   bucket and leave the upload UI as a documented TODO.

VERIFICATION:
  1. npm run typecheck && npm run build.
  2. grep -rniE "swift aerial|swiftaerialmedia|Swift Portal|Jackson Bridges|6626871259" src/
     Every remaining hit must be either (a) a platform fallback constant that is never rendered,
     or (b) inside a seed migration. Paste the full remaining list with a justification per line.
  3. Load the client portal as a Swift client and compare against a pre-change screenshot of:
     the landing page, login page, dashboard, a project detail page (hero, timeline, next-step
     banner, quote card, proposal card, scheduling card, payments section, gallery, messages),
     the 404 page, and the footer. Report ANY visual or copy difference.
  4. Send one email of each type and confirm the logo, business name, colors, and footer are
     correct.
  5. Render a payment receipt and confirm the business name.
  6. Create a second test business, set a completely different name, logo, and colors, and
     confirm its portal renders with ITS branding and never Swift's — including emails.
  7. Attempt to save a brand color of `red; } body { display:none } :root { --x:` and confirm it
     is rejected by the validation from step 4.
  8. Re-run supabase/tests/tenant-isolation.sql.

Stop here.
```

---

### Prompt 15 — Per-business email sender identity

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompt 14 complete.

Read src/lib/email.ts, src/lib/email-templates.ts, src/lib/email-analytics.ts,
src/app/api/resend/webhook/route.ts, src/app/api/admin/email/route.ts, and the email section of
src/lib/app-settings.ts.

GOAL: each business sends email that looks like it comes from that business, without letting one
business spoof another and without breaking Swift's current deliverability.

Understand the constraint first: Resend will only send from a domain that has been verified in
the Resend account. A business cannot simply type any sender address and have it deliver. So:

1. Add to BusinessSettings.email: senderMode ('platform' | 'custom_domain'), customDomain,
   domainVerificationStatus ('unverified' | 'pending' | 'verified'), and keep the existing
   fromName / senderEmail / replyTo / footerText.

2. Default and safe path (senderMode='platform'): send from the PLATFORM's verified address with
   the business name as the display name, and set reply-to to the business's contact email:
     From: "{businessName}" <noreply@{platformDomain}>
     Reply-To: {business.primaryContactEmail}
   Add PLATFORM_EMAIL_DOMAIN / PLATFORM_FROM_ADDRESS env vars for this.

3. Swift Aerial Media MUST keep its current behavior exactly: senderMode='custom_domain' with
   its already-verified swiftaerialmedia.com sender. Seed that in a migration so nothing about
   Swift's deliverability changes. Verify by sending a real test email and confirming the From
   header is identical to what it is today.

4. SECURITY: validate on save that a business cannot set senderEmail to a domain it has not
   verified, and cannot set it to the platform domain or another business's domain. Reject with a
   clear error. Without this check, any business admin can send email as any other business.
   Write this validation server-side in the settings API route, not only in the UI.

5. Implement domain verification as an admin-facing flow only if it is a contained change: an
   endpoint that calls the Resend Domains API to create a domain and return DNS records, a
   settings card that displays them, and a re-check endpoint that updates
   domainVerificationStatus. If the Resend API surface makes this large, implement ONLY the
   settings fields plus a super-admin-managed manual verification toggle, and document the
   self-serve flow as a follow-up. State which route you took.

6. Every send must tag the Resend message with business_id (in addition to the existing
   project_id / notification_id / email_type tags) so the webhook can attribute events. Confirm
   the webhook attribution added in prompt 11 uses it.

7. getEmailConfigStatus() and the diagnostics panel must report PER-BUSINESS status and must
   never expose the platform API key, another business's sender, or another business's last send
   result (the Map fix from prompt 7).

VERIFICATION:
  1. npm run typecheck && npm run build.
  2. Send the test email as the Swift admin. Inspect the raw headers: From, Reply-To, and
     DKIM/SPF alignment must be identical to a pre-change email. Paste both header sets.
  3. Create a second test business on senderMode='platform'; send its test email; confirm From
     shows its display name on the platform domain and Reply-To is its own contact address.
  4. As the second business's admin, attempt to set senderEmail to
     notification@swiftaerialmedia.com. It must be rejected server-side. Verify by calling the
     API route directly, bypassing the UI.
  5. Trigger a real notification email for each business and confirm each arrives with the right
     branding and sender.
  6. Confirm Resend webhook events for both businesses land in email_events with the correct
     business_id.
  7. Confirm /admin/settings diagnostics for business A never shows business B's last send.
  8. Re-run supabase/tests/tenant-isolation.sql.

Stop here.
```

---

### Prompt 16 — Editable services and preliminary-estimate pricing

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–15 complete.

Read docs/TENANT-AUDIT.md section E, plus src/lib/service-templates.ts (all 15 templates),
src/lib/constants.ts (SERVICE_TYPES, DAM_SERVICE_FILTERS), src/lib/preliminary-estimates.ts,
src/lib/quote-display.ts, src/lib/types.ts (QuoteLineItem),
src/app/request/page.tsx, src/app/dashboard/request/page.tsx,
src/app/admin/projects/new/page.tsx, src/lib/ghl/build-portal-lead-payload.ts.

GOAL: services and their preliminary estimate prices become per-business database rows an admin
can edit. Swift's generated estimates must be byte-identical to today's output.

1. Create supabase/migration-v37-business-services.sql:
   CREATE TABLE IF NOT EXISTS business_services (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     slug TEXT NOT NULL,
     description TEXT,
     preliminary_estimate_cents INTEGER,
     starting_label TEXT,
     includes JSONB NOT NULL DEFAULT '[]'::jsonb,
     line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
     notes TEXT,
     hide_pricing BOOLEAN NOT NULL DEFAULT false,
     is_recommended BOOLEAN NOT NULL DEFAULT false,
     display_order INTEGER NOT NULL DEFAULT 0,
     is_active BOOLEAN NOT NULL DEFAULT true,
     aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (business_id, slug)
   );
   `aliases` carries each template's serviceNames array so the existing fuzzy matcher keeps
   working against historical projects whose service_type strings must still resolve.
   Add the updated_at trigger, business_id + (business_id, display_order) indexes, and RLS:
   super_admin full; admin full where business_id = current_business_id(); clients SELECT where
   business_id = current_business_id() AND is_active (the request form needs to read them).

2. Seed all 15 SERVICE_TEMPLATES into Swift's business, preserving EXACTLY: id->slug,
   serviceNames->aliases, title->name, startingAtCents->preliminary_estimate_cents,
   startingLabel, lineItems, includes, description, notes, hidePricing, recommended, and the
   current array order as display_order. Also carry over
   PRELIMINARY_ESTIMATE_DISCLAIMER — it names "Swift Aerial Media" in its text, so store it as a
   per-business setting (add BusinessSettings.proposals.preliminaryDisclaimer) with a
   {businessName} placeholder and seed Swift's current wording.

3. Add projects.service_id UUID REFERENCES business_services(id) alongside the existing
   service_type TEXT column. Backfill it by matching service_type against name and aliases.
   Report how many projects matched and list any that did not. DO NOT drop or stop writing
   service_type — it is stored free text on historical rows, is used in GHL payloads, DAM
   filters, and Stripe payment descriptions, and dropping it would break history.

4. Rewrite src/lib/service-templates.ts so getServiceTemplate and
   buildPreliminaryEstimatePayload read from business_services for a given businessId, keeping
   their existing return SHAPES exactly. Keep the full fuzzy-matching cascade behavior (exact
   alias match, then substring both directions, then the keyword heuristics) — just source the
   candidates from the DB. Keep the hardcoded array in the file as a clearly-labeled fallback
   used only when a business has zero services, and cache per business.

5. getServicePaymentDescription: source from the service row's description, with the existing
   hardcoded map as a fallback for unmatched legacy service_type strings.

6. constants.ts SERVICE_TYPES and DAM_SERVICE_FILTERS: both are Swift's catalog. Replace their
   consumers with per-business queries. For DAM filters, the options must be derived from the
   business's own services PLUS any distinct service_type values present in its historical
   projects, so old filters still find old media.

7. Add a services management UI at /admin/settings (a new section or tab, following the existing
   settings-collapsible / sticky-save-bar patterns in src/components/admin/): list, create, edit,
   reorder (drag, reusing the existing @dnd-kit setup), activate/deactivate, and delete-if-unused.
   Include name, description, preliminary estimate dollars (use the existing currency-input
   component), starting label, includes list, notes, and hide-pricing. Deleting a service that is
   referenced by projects must be blocked — offer deactivate instead.
   Add the API route(s) under src/app/api/ following the existing requireAdminApi pattern.

8. Both request forms and the admin new-project form must list the business's active services
   instead of the constant.

VERIFICATION:
  1. Run the migration; report the service_id backfill match counts and any unmatched projects.
  2. npm run typecheck && npm run build.
  3. BYTE-IDENTICAL CHECK: before/after, generate a preliminary estimate for each of the 15
     services (via the public request form or a script) and diff the resulting project_quotes
     row's title, description, line_items, total_cents, and notes. All 15 must match exactly.
     Paste the diff result. This is the acceptance criterion for this prompt.
  4. Open an OLD project created before this change and confirm its estimate, quote display,
     payment description, and DAM filters all still render correctly.
  5. In /admin/settings, create a new service "Aerial Videography Pro" with a $299 preliminary
     estimate and a description; confirm it appears in the client request form; submit a request
     for it; confirm the generated preliminary estimate shows $299 and the description.
  6. Edit an existing service's price; confirm NEW estimates use the new price and EXISTING
     quotes are unchanged.
  7. Reorder and deactivate services; confirm the request form reflects both.
  8. Attempt to delete a service that has projects; confirm it is blocked with a clear message.
  9. Create a second business with completely different services and confirm zero bleed in
     either direction, in both the admin UI and the request form.
 10. Re-run supabase/tests/tenant-isolation.sql with business_services assertions added.

Stop here. Do not touch project stages.
```

---

### Prompt 17 — Editable pipeline stages (additive, enum preserved)

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompt 16 complete.

Read docs/TENANT-AUDIT.md section D, plus src/lib/constants.ts (PROJECT_STATUSES,
LEGACY_STATUS_MAP, normalizeStatus, getStatusLabel, getClientStatusLabel, getStatusOrder,
getStatusColor), src/lib/journey.ts, src/lib/admin-project-status.ts,
src/lib/admin-project-pipeline.ts, src/lib/status-automation.ts, src/lib/workflow-settings.ts,
src/lib/workflow.ts, src/lib/email-templates.ts, src/lib/ghl/build-portal-lead-payload.ts,
src/components/admin/project-pipeline.tsx, src/components/admin/project-detail.tsx,
src/components/admin/workflow-settings-card.tsx, src/components/projects/status-timeline.tsx,
and the project_status enum definition across schema.sql, migration-v3, v4, v5, v5b, v7b.

READ THIS BEFORE WRITING ANY CODE. projects.status is a Postgres ENUM. Postgres cannot remove
enum values. The enum is referenced by ~10 TypeScript modules and by the client_stats view.
Replacing it with a table-driven column in one step is the single most likely way to break this
production app. You will NOT do that.

The approach is strictly ADDITIVE:
  - Add a business_stages table and projects.stage_id.
  - Keep projects.status and the enum forever, as a synchronized legacy mirror.
  - Migrate READ paths to stage_id incrementally. Keep WRITING both.

1. Create supabase/migration-v38-business-stages.sql:
   CREATE TABLE IF NOT EXISTS business_stages (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     key TEXT NOT NULL,
     label TEXT NOT NULL,
     client_label TEXT NOT NULL,
     sort_order INTEGER NOT NULL,
     color_class TEXT,
     legacy_status TEXT,              -- the project_status enum value this maps to
     is_terminal BOOLEAN NOT NULL DEFAULT false,
     is_system BOOLEAN NOT NULL DEFAULT false,  -- true for the 8 seeded stages
     is_active BOOLEAN NOT NULL DEFAULT true,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     UNIQUE (business_id, key),
     UNIQUE (business_id, sort_order) DEFERRABLE INITIALLY DEFERRED
   );
   Seed every existing business with the current 8 PROJECT_STATUSES rows — same keys, labels,
   clientLabels, order values, and the getStatusColor() class for color_class, with
   legacy_status = key and is_system = true. delivered gets is_terminal = true.
   Business-scoped RLS as in prior migrations (clients need SELECT for the timeline).

2. ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES business_stages(id);
   Backfill from normalizeStatus() semantics: map each project's current status (including every
   LEGACY_STATUS_MAP key: lead_received, shot_complete, editing, shoot_complete,
   shoot_rescheduled, shoot_confirmed, review, approved) to the business's stage with the
   matching key. Report the count per stage and assert zero projects end with a NULL stage_id.

3. Add a BEFORE INSERT OR UPDATE trigger on projects that keeps the two in sync:
   - If stage_id changed and status did not, set status = the stage's legacy_status.
   - If status changed and stage_id did not, set stage_id = the business's stage whose
     legacy_status matches (via normalizeStatus semantics).
   - If both changed and disagree, prefer stage_id and set status from it.
   For a CUSTOM stage (is_system=false, legacy_status NULL), set status to a designated
   placeholder enum value and document which one and why. This keeps every existing
   status-reading code path functional while custom stages exist.

4. Application changes — MINIMAL and additive:
   - Add src/lib/stages.ts with getBusinessStages(businessId) (cached per business),
     resolveStage(businessId, key|id), stageLabel(stage, audience), and stageOrder(stage).
   - Keep constants.ts PROJECT_STATUSES, normalizeStatus, getStatusLabel, getStatusOrder, and
     getStatusColor exported and working unchanged as the platform-default fallback.
   - Convert these READ paths to business_stages: project-pipeline.tsx, status-timeline.tsx,
     project-detail.tsx's stage selector, journey.ts's stage labels, and
     admin-project-pipeline.ts's stage counts and filters.
   - Do NOT convert status-automation.ts, workflow-settings.ts, email-templates.ts, or
     build-portal-lead-payload.ts in this prompt. They keep using the enum. Add
     // TODO(stages): read stage_id — later phase at each.
   - Every project write must set BOTH stage_id and status (the trigger is the backstop, not the
     contract).

5. Add stage management to /admin/settings: list, rename label and client_label, reorder,
   recolor, add a custom stage, deactivate. Guard rails: system stages cannot be deleted or have
   their key changed (renaming labels is fine); a stage with projects cannot be deleted; there
   must always be at least one non-terminal and one terminal stage. Follow the existing settings
   UI patterns and the requireAdminApi route pattern.

6. workflow-settings.ts stages are keyed by WorkflowStageKey (a fixed union). Do NOT restructure
   that in this prompt — automation settings continue to key off the 8 system stages. Custom
   stages get no automations yet; note this clearly in the UI ("automations available for
   default stages"). Full stage-keyed automations are the last prompt.

VERIFICATION:
  1. Run the migration; paste the per-stage backfill counts and confirm zero NULL stage_id.
  2. npm run typecheck && npm run build.
  3. SYNC TRIGGER TESTS, run directly in SQL: update a project's status only -> stage_id must
     follow. Update stage_id only -> status must follow. Update both consistently -> both stick.
     Update both inconsistently -> stage_id wins. Paste all four results.
  4. Manual regression: /admin projects list, every pipeline stage filter and its count, a
     project detail page's stage selector and stage change, the client status timeline, the
     client next-step banner. All must match pre-change behavior.
  5. Run the FULL project lifecycle again (request through delivered) and confirm every stage
     transition, notification, and automation still fires exactly as before.
  6. Rename a stage's label and client_label; confirm the admin pipeline and the client timeline
     both show the new text, and that automations still fire.
  7. Reorder stages; confirm the pipeline and timeline order follow.
  8. Add a custom stage; move a project into it; confirm the admin UI and client timeline render
     it, that the project still loads everywhere, and that no code path crashes on the
     placeholder enum value.
  9. Confirm an OLD project whose status is a legacy enum value (e.g. lead_received) still
     renders correctly.
 10. Re-run supabase/tests/tenant-isolation.sql with business_stages assertions.

Stop here.
```

---

### Prompt 18 — Stripe Connect

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–17 complete.

Read src/lib/stripe.ts, src/lib/stripe-payments.ts, src/lib/stripe-metadata.ts,
src/lib/stripe-webhook-events.ts, src/lib/payment-quote.ts, src/lib/payment-status.ts,
src/lib/use-mark-payment-paid.ts, src/app/api/payments/route.ts,
src/app/api/payments/[id]/route.ts, src/app/api/payments/[id]/checkout/route.ts,
src/app/api/payments/[id]/receipt/route.ts, src/app/api/stripe/webhook/route.ts,
src/components/admin/admin-payment-actions.tsx,
src/components/admin/proposal-payment-link-actions.tsx,
src/components/admin/pricing-payment-workflow.tsx,
src/components/projects/payments-section.tsx, and supabase/migration-v23.

Before writing code, read the current Stripe API docs for Connect (Standard accounts), Account
Links, direct charges via the Stripe-Account header, and Connect webhooks. The installed SDK is
stripe ^22 with apiVersion "2026-05-27.dahlia" — verify the exact current API surface rather than
relying on recalled patterns, and state what you verified.

GOAL: each business collects payments into its own Stripe account. The platform must never
custody another business's funds.

Money code on a live app — be conservative. Swift Aerial Media's existing payments, payment
links, and Checkout Sessions must continue to work unchanged.

1. Create supabase/migration-v39-stripe-connect.sql:
   business_integrations (
     business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
     stripe_account_id TEXT UNIQUE,
     stripe_account_status TEXT NOT NULL DEFAULT 'not_connected'
       CHECK (stripe_account_status IN ('not_connected','pending','active','restricted','disabled')),
     stripe_charges_enabled BOOLEAN NOT NULL DEFAULT false,
     stripe_payouts_enabled BOOLEAN NOT NULL DEFAULT false,
     stripe_connected_at TIMESTAMPTZ,
     ghl_webhook_url TEXT,
     onesignal_tag TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   Business-scoped RLS; no client access. Never store another business's secret keys here —
   Connect means you use account ids, not keys. If a fallback direct-key mode is unavoidable,
   store keys encrypted (pgsodium/Vault) and say exactly how.
   Also add stripe_account_id TEXT to payments so every payment records which Stripe account
   processed it, and add business_id to processed_stripe_events.

2. Swift Aerial Media stays on the PLATFORM account. Seed its business_integrations row with
   stripe_account_status='active' and a NULL stripe_account_id, and make the code treat
   "NULL stripe_account_id" as "use the platform account with no Stripe-Account header" — i.e.
   byte-identical to today's behavior. This is the key backward-compatibility mechanism. Verify
   it by creating a payment link for Swift and confirming the request is identical to a
   pre-change one.

3. getStripe(): extend the prompt-7 Map so it returns { stripe, requestOptions } where
   requestOptions includes { stripeAccount } only when the business has a connected account.
   Thread it through every Stripe call in stripe-payments.ts: payment link creation, Checkout
   Session creation, payment intent retrieval, receipt lookup, and session expiry handling.

4. Onboarding: add /api/stripe/connect (creates or resumes an Account Link and returns the URL)
   and /api/stripe/connect/callback (refreshes account status via the Accounts API). Add a
   settings card showing connection status, charges/payouts enabled, and a connect/manage button.
   Follow the existing google-calendar-card.tsx pattern for the UI shape.

5. Webhook: /api/stripe/webhook must handle BOTH platform events (Swift) and Connect events
   (event.account present). Resolve the business as: event.account -> business_integrations, else
   the platform business. Then — and this is the security-critical part — verify the resolved
   payment's business_id matches the resolved business BEFORE any status write, and reject with a
   logged error otherwise. Extend processed_stripe_events idempotency to be keyed on
   (event_id) still, but record business_id. Connect events may need a separate endpoint secret;
   check the current Stripe requirements and support both secrets via env vars.

6. Guard rails: creating a payment link or Checkout Session for a business whose
   stripe_account_status is not 'active' (or which is not the platform business) must fail with a
   clear admin-facing error, not a silent charge to the wrong account.

7. Receipts and the client-facing payment UI must show the correct business, and the checkout
   success/cancel URLs must point at the correct business's portal host.

VERIFICATION — use Stripe TEST mode throughout; do not touch live keys.
  1. Run the migration.
  2. npm run typecheck && npm run build.
  3. SWIFT REGRESSION (most important): create a payment link for a Swift project, pay it with a
     test card, confirm the webhook fires, the payment marks paid, downloads unlock, the project
     advances, the receipt renders, and the activity timeline and notifications are correct.
     Compare the Stripe dashboard request payload against a pre-change one — they must match.
  4. Connect a SECOND test business to its own Stripe test account via the onboarding flow;
     confirm business_integrations reflects active + charges_enabled.
  5. Create and pay a payment link for that business; confirm the charge lands in ITS Stripe
     account, not the platform's, and that its webhook path marks its payment paid.
  6. Confirm business A's admin cannot see or act on business B's payments anywhere in the UI.
  7. ATTACK TEST: replay a Connect webhook event for business B's payment while spoofing
     metadata to reference business A's payment id; confirm it is rejected and logged and that no
     payment status changes.
  8. Attempt to create a payment link for a business with stripe_account_status='not_connected';
     confirm a clear error and no Stripe call.
  9. Re-run supabase/tests/tenant-isolation.sql with payments/business_integrations assertions.

Stop here.
```

---

### Prompt 19 — Public tenant resolution (subdomain / custom domain / slug)

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–18 complete.

Read src/proxy.ts, src/lib/supabase/middleware.ts, src/app/page.tsx,
src/components/landing/landing-page.tsx, src/app/login/page.tsx, src/app/login/layout.tsx,
src/app/request/page.tsx, src/app/dashboard/request/page.tsx, src/app/api/request/route.ts,
src/app/api/request/logged-in/route.ts, src/lib/tenant.ts, src/lib/site-metadata.ts, and
src/app/layout.tsx. Then read node_modules/next/dist/docs/ on routing, middleware/proxy, and
metadata for THIS Next.js version — do not assume conventions from other versions.

GOAL: unauthenticated visitors reach the right business's branded landing page, login page, and
request form.

SECURITY PRINCIPLE — state that you understand it before coding: the URL determines BRANDING and
NEW-SIGNUP ATTRIBUTION only. It NEVER grants access to data. Supabase Auth is a single global
user pool; an authenticated user's business always comes from their profile, never from the host
or path. If a logged-in user is on the wrong business's host, redirect them to their own.

1. Resolution order in the proxy/middleware, resolving host -> business:
   a) exact match on businesses.custom_domain
   b) first subdomain label matched against businesses.slug, for hosts under a configured
      PLATFORM_ROOT_DOMAIN env var
   c) an explicit /b/{slug} path prefix (needed for localhost development)
   d) no match -> a platform marketing/404 page, NOT a Swift-branded page
   Pass the resolved business id/slug to the app via a request header set in the proxy (the
   standard pattern) rather than re-querying in every layout. Cache the host->business lookup
   with a short TTL — but per-host, and never in a way that can serve one host's business to
   another.

2. Swift Aerial Media MUST keep working at portal.swiftaerialmedia.com via its custom_domain row.
   Every existing bookmark, email deep link, Stripe redirect URL, and the PWA's installed scope
   must be unaffected. Verify each.

3. Add a public tenant layout that wraps the landing page, login page, and request form in the
   resolved business's BrandProvider and per-business generateMetadata. The root layout stays
   platform-generic.

4. The public request form must submit the resolved business_id/slug (validated server-side
   against an active business — the API route already does this from prompt 12) so the new
   client, project, and auth user are attributed to the right business. Never trust a
   business id from the body without validating it against the resolved host.

5. Login: keep ONE global login. On success, redirect based on the profile's role and business:
   super_admin -> /platform; admin/client -> their own business's host if it differs from the
   current one. Add a clear error for a suspended or soft-deleted business, and confirm a
   suspended business's clients and admins cannot sign in.

6. Update NEXT_PUBLIC_APP_URL usage: there are several hardcoded
   `process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com"` fallbacks (email.ts,
   onesignal-push.ts, api/messages/route.ts, api/projects/[id]/messages/route.ts). Replace with a
   per-business portal URL derived from custom_domain or slug + PLATFORM_ROOT_DOMAIN, so email
   links, push deep links, and Stripe redirects point at the right host. Grep for every
   occurrence.

7. Document the DNS/hosting setup in docs/TENANT-DOMAINS.md: wildcard subdomain, custom-domain
   CNAME + verification, and the Vercel (or current host) configuration needed. Include what a
   new business must do to attach a custom domain.

VERIFICATION:
  1. npm run typecheck && npm run build.
  2. Local dev: /b/swift-aerial-media renders Swift's branded landing, login, and request form.
     /b/test-tenant-b renders the second business's. /b/nonexistent renders the platform 404.
  3. Submit the request form from each tenant path and confirm the client, project, auth user,
     profile.business_id, and preliminary estimate are all attributed to the correct business.
  4. Log in as a Swift client while on Tenant B's host; confirm the redirect to Swift's host and
     that NO Tenant B data is ever visible.
  5. Confirm portal.swiftaerialmedia.com still resolves to Swift end to end (or verify the
     custom_domain path with a local hosts-file entry if you cannot change DNS in this step).
  6. Click a deep link from a real notification email for each business and confirm it lands on
     the right host and page.
  7. Suspend Tenant B (status='suspended'); confirm its admin and clients cannot log in and its
     public pages show a clear message. Reactivate and confirm access returns.
  8. Confirm the installed PWA for Swift still opens correctly (manifest scope unchanged).
  9. Re-run supabase/tests/tenant-isolation.sql.

Stop here.
```

---

### Prompt 20 — Super admin platform console

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–19 complete.

Read src/lib/auth.ts, src/lib/api-auth.ts, src/lib/tenant.ts, src/lib/supabase/middleware.ts,
src/components/admin/admin-shell.tsx, src/app/admin/layout.tsx, and
supabase/migration-v31b-tenant-helpers.sql (specifically current_business_id() and its
impersonation GUC).

GOAL: a platform console at /platform for the super admin. /admin remains the business admin
area and must not change.

1. Create supabase/migration-v40-platform-audit.sql:
   platform_audit_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
     actor_email TEXT,
     action TEXT NOT NULL,
     target_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
     target_type TEXT,
     target_id TEXT,
     metadata JSONB,
     ip_address TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   RLS: only super_admin may SELECT. No UPDATE or DELETE policy for anyone — this is an audit
   log and must be append-only.

2. Build /platform (super_admin only, enforced in BOTH middleware and every server component /
   route handler — never rely on middleware alone):
   - /platform — businesses list with per-business counts (clients, projects, media, revenue),
     status, plan, created date, Stripe connection status.
   - /platform/businesses/new — create a business: name, slug, custom domain, plan; seeds
     business_settings, business_stages (the 8 defaults), and optionally a starter
     business_services set; creates the first business admin via a Supabase invite with
     business_id in user_metadata.
   - /platform/businesses/[id] — detail: edit name/slug/domain/plan, suspend/reactivate,
     soft-delete, view that business's admins, resend an admin invite, view its settings
     read-only.
   - /platform/audit — the audit log with filters.
   Reuse the existing UI primitives in src/components/ui/ and the admin-shell layout patterns so
   this looks native to the app. Do not build a new design system.

3. "View as business" impersonation:
   - A super_admin action that sets a SIGNED, HTTP-only, short-TTL (e.g. 30 min)
     sa_business_context cookie containing the business id, and sets the
     app.impersonated_business_id GUC for DB calls so current_business_id() honours it (the hook
     already exists from v31b — verify it actually works end to end).
   - A persistent, unmissable banner in every impersonated view naming the business, with an
     exit button.
   - EVERY impersonated request writes a platform_audit_log row. Also audit-log entering and
     exiting impersonation.
   - Impersonation must be READ-ONLY by default. Writes require an explicit, separately-confirmed
     "allow writes" toggle that is itself audit-logged, and that toggle must expire with the
     session. Implement the read-only enforcement server-side, not just by hiding buttons.
   - Confirm the cookie cannot be forged: it must be signed with a server secret and verified on
     every use. Test with a tampered cookie.

4. Audit-log every super-admin mutation: business create, update, suspend, reactivate, delete,
   admin invite, plan change, and any write performed while impersonating.

5. Business soft-delete must set businesses.deleted_at and cascade to blocking login for that
   business's users. It must NOT hard-delete any client data. Add a documented, super-admin-only,
   explicitly-confirmed hard-delete path for genuine data-deletion requests, and audit it.

VERIFICATION:
  1. Run the migration.
  2. npm run typecheck && npm run build.
  3. As the existing business admin (role 'admin'), attempt to load /platform and every
     /api/platform/* route directly. All must be denied. Test the API routes with curl, not just
     the UI — middleware-only protection is not sufficient and you must prove the route handlers
     also reject.
  4. As super_admin: create a new business end to end, invite its admin, accept the invite, log
     in as that admin, and confirm they see an empty, correctly-branded portal and CANNOT see
     Swift's or Tenant B's data.
  5. Impersonate a business; confirm the banner, that data is scoped to that business, that
     writes are blocked in read-only mode, and that exiting restores the super-admin view.
  6. Tamper with the sa_business_context cookie (change the business id, drop the signature) and
     confirm every variant is rejected.
  7. Confirm platform_audit_log has a row for every action in steps 4–6, then attempt an UPDATE
     and a DELETE on the audit log as super_admin and confirm both are refused.
  8. Suspend a business; confirm its users cannot log in and its public pages show the suspended
     message. Reactivate and confirm access returns.
  9. Re-run supabase/tests/tenant-isolation.sql.

Stop here.
```

---

### Prompt 21 — Configurable stage automations

```
Continue the Swift Portal multi-tenant migration. Prerequisites: prompts 1–20 complete. This is
the last feature phase; do not start it until everything above is verified in production.

Read src/lib/status-automation.ts, src/lib/workflow.ts, src/lib/workflow-settings.ts (all of it —
StageAutomationSettings, PaymentAutomationSettings, ProposalAutomationSettings,
SchedulingAutomationSettings, DeliverableAutomationSettings, ReminderSettings,
MessageTemplateKey/MESSAGE_TEMPLATE_DEFINITIONS, BusinessDefaultsSettings),
src/lib/message-templates.ts, src/lib/notifications.ts,
src/app/api/cron/workflow-reminders/route.ts, src/lib/stages.ts,
src/components/admin/workflow-settings-card.tsx.

IMPORTANT FRAMING: this app ALREADY has an automation engine. workflow.settings.stages[*]
{inApp, email, push, logActivity, autoAdvance, requireManualApproval}, the payment/proposal/
scheduling/deliverable automation groups, the reminder timings, and the message templates are it.
status-automation.ts is its executor. Your job is to GENERALIZE that engine to work with
per-business custom stages and arbitrary actions — NOT to replace it. Every existing automation
must keep behaving identically.

1. Create supabase/migration-v41-automations.sql:
   business_automations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
     name TEXT NOT NULL,
     trigger_type TEXT NOT NULL CHECK (trigger_type IN (
       'stage_entered','stage_exited','quote_approved','quote_changes_requested',
       'shoot_proposed','shoot_confirmed','shoot_completed','media_uploaded',
       'deliverables_approved','payment_link_sent','payment_received','payment_failed',
       'revision_requested','revision_completed','message_received','time_elapsed_in_stage'
     )),
     trigger_stage_id UUID REFERENCES business_stages(id) ON DELETE CASCADE,
     delay_minutes INTEGER NOT NULL DEFAULT 0,
     conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
     actions JSONB NOT NULL DEFAULT '[]'::jsonb,
     is_active BOOLEAN NOT NULL DEFAULT true,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   automation_runs (id, automation_id, business_id, project_id, status
     CHECK (status IN ('pending','succeeded','failed','skipped')), scheduled_for, executed_at,
     error, idempotency_key, created_at) with a UNIQUE index on
     (automation_id, project_id, idempotency_key) so a retry cannot double-fire.
   Business-scoped RLS on both; no client access.

   Supported action types (document each in a code comment): advance_to_stage, send_email
   (template key or inline subject/body), send_in_app_notification, send_push, create_payment,
   log_activity, notify_admin, send_client_message, set_project_field, webhook_post.

2. Generalize workflow-settings.ts so stage automations key off business_stages.id rather than the
   fixed WorkflowStageKey union, while KEEPING backward compatibility: the existing stored
   settings JSON (keyed by WorkflowStageKey) must continue to load and behave identically.
   Migrate the 8 system stages' existing settings into equivalent business_automations rows OR
   keep reading them from settings and only use business_automations for NEW rules — choose the
   lower-risk option, implement it, and explain which you chose and why. Do not do both halfway.

3. Build the executor as a single evaluate-and-run function that status-automation.ts and the
   other trigger sites call. Requirements:
   - Idempotent: use automation_runs + the unique index; a given automation must fire at most
     once per project per trigger occurrence.
   - Loop-safe: an advance_to_stage action that re-triggers stage_entered must not cascade
     infinitely. Enforce a per-project-per-request execution depth cap and detect cycles.
   - Isolated failures: one failing action must not roll back the triggering business operation
     or block other actions. Record the failure in automation_runs.
   - Delayed actions (delay_minutes > 0, time_elapsed_in_stage) are enqueued as pending
     automation_runs and executed by the existing /api/cron/workflow-reminders sweep, which
     already iterates businesses after prompt 12.

4. Build the automations UI in /admin/settings: list, create, edit, activate/deactivate, delete,
   plus a run history view reading automation_runs. Reuse existing settings UI patterns.

5. Ship a "default automations" seed per business that reproduces exactly what the current
   workflow settings do, so a new business gets the same sensible behavior Swift has today.

VERIFICATION:
  1. Run the migration.
  2. npm run typecheck && npm run build.
  3. REGRESSION FIRST: with no new automations created, run the full project lifecycle
     (request -> delivered) and confirm every notification, email, status advance, activity log
     entry, and reminder fires exactly as it did before this prompt. Diff against a recorded run
     from prompt 12's verification. This is the acceptance criterion.
  4. Create a new automation: "when stage_entered = Delivered, wait 0 minutes, send_email to the
     client with a thank-you template". Move a project to Delivered; confirm one email, one
     automation_runs row with status succeeded, and NO duplicate on a second stage write.
  5. Create a delayed automation (delay_minutes = 60); confirm a pending automation_runs row is
     created and that the cron sweep executes it and marks it succeeded.
  6. Create a deliberately cyclic pair of advance_to_stage automations; confirm the depth cap
     stops it, the failure is recorded, and the app does not hang or crash.
  7. Create an automation with a failing action (webhook_post to an unreachable URL); confirm the
     triggering operation still completes, other actions still run, and the failure is recorded.
  8. Create automations in two businesses with the same trigger and confirm each fires only for
     its own projects.
  9. Re-run supabase/tests/tenant-isolation.sql with business_automations and automation_runs
     assertions.

Stop here.
```

---

### Prompt 22 — Final hardening and cross-tenant penetration pass

```
Final prompt of the Swift Portal multi-tenant migration. Prerequisites: prompts 1–21 complete
and verified.

Read docs/TENANT-AUDIT.md, docs/SERVICE-ROLE-MIGRATION.md, docs/TENANT-TESTING.md, and every
migration from v29 through v41.

GOAL: prove tenant isolation adversarially and close whatever is still open. Assume the previous
prompts missed something — they always do.

PART A — automated sweep. Write a script (scripts/tenant-lint.ts, runnable with npx tsx or node)
that scans src/ and FAILS with a non-zero exit code on:
  1. Any createServiceClient() call in a file not on an explicit allowlist.
  2. Any .from('<business-owned table>') where the same statement chain has no business_id
     filter and no createTenantServiceClient wrapper.
  3. Any module-scope `let`/`var` in src/lib/ not on an explicit allowlist.
  4. Any remaining literal "Swift Aerial Media" / "swiftaerialmedia.com" / "Jackson Bridges" /
     the phone number outside seed migrations and documented platform fallbacks.
  5. Any getAppSettings() call without a businessId argument.
Add it to package.json as `npm run tenant-lint`. Accept that static analysis is imperfect — make
it strict enough to catch real regressions and document its known blind spots.

PART B — SQL sweep. Add to supabase/tests/ a script that fails if:
  1. Any table with a business_id column has a policy mentioning is_admin() but not
     current_business_id().
  2. Any business-owned table has business_id nullable (except profiles).
  3. Any table with RLS disabled that holds business data.
  4. Any SECURITY DEFINER function or view readable by `authenticated` that lacks a business
     filter. Enumerate them and justify each.
  5. Any expected cross-tenant integrity trigger is missing.

PART C — adversarial testing. Set up three businesses (Swift + two test tenants) each with a
client and a project, then attempt every one of these as business A's admin and separately as
business A's client, asserting each FAILS. Use direct HTTP calls (curl/fetch), not the UI —
the UI hides buttons, it does not enforce authorization.
  1. GET/PATCH/DELETE every /api/* route that takes an id, using business B's ids: projects,
     clients, payments, quotes, media, media-folders, tours, revisions, shoot-proposals, leads,
     messages, notifications, asset-reviews, profile, client notes, client portal link.
  2. POST every creation route with business B's parent ids in the body.
  3. Request a signed media URL and a download for business B's asset.
  4. Request business B's project ZIP.
  5. Read business B's storage objects directly with the anon key.
  6. Read client_stats for business B's client.
  7. Call reorder_media_assets and every other SECURITY DEFINER RPC with business B's ids.
  8. Submit the public request form with a body-supplied business_id that contradicts the host.
  9. Replay a Stripe webhook for business B's payment with spoofed metadata.
 10. Replay a Resend webhook with a mismatched business_id tag.
 11. Set profiles.business_id on your own profile via any exposed write path.
 12. Forge the sa_business_context impersonation cookie.
 13. Register a OneSignal subscription with business B's tag and check whether B's push reaches
     you.
 14. Set your business's email senderEmail to business B's verified domain.
 15. Save a brand color / logo URL containing CSS or script injection payloads.
Record every attempt and its result in docs/TENANT-PENTEST.md. Any success is a P0 — fix it and
re-test before finishing.

PART D — cleanup and operations.
  1. Remove every LEGACY_DEFAULT_BUSINESS_ID usage that is no longer needed. List and justify
     any that must stay.
  2. Resolve or explicitly document every // TODO(tenant): and // TODO(stages): comment.
  3. Create supabase/migration-v42-cleanup.sql dropping the now-unused app_settings and
     google_calendar_connections singleton tables — ONLY after verifying their successors have
     been correct in production for a meaningful period. If that verification has not happened,
     do NOT write this migration; say so and leave them.
  4. Write docs/TENANT-ARCHITECTURE.md: the final model, tenant resolution rules, the rule that
     every new table needs business_id + RLS + integrity triggers, how to add a business, and
     the mandatory pre-merge checklist (tenant-lint, SQL sweep, isolation harness).
  5. Add the three checks to CI if a CI config exists; if not, document the commands to run
     before every merge.

VERIFICATION:
  1. npm run tenant-lint must exit 0.
  2. The SQL sweep must report zero findings.
  3. supabase/tests/tenant-isolation.sql must pass in full.
  4. Every Part C attempt must be recorded as blocked in docs/TENANT-PENTEST.md.
  5. npm run typecheck && npm run build && npm run lint.
  6. FULL final regression on the Swift Aerial Media tenant with REAL production-shaped data:
     public request -> preliminary estimate -> official proposal -> changes requested -> revised
     proposal -> approval -> shoot proposal -> counter -> confirm -> calendar sync -> shoot
     complete -> media upload (photo, large video, document, YouTube, 360 tour) -> folders and
     reorder -> send for review -> client approval -> payment link -> Stripe test payment ->
     webhook -> downloads unlock -> ZIP download -> delivered -> receipt. Plus messaging in both
     directions, notification bell, email delivery, and admin push. Report the result of every
     step.
  7. Confirm at least one PRE-EXISTING Swift project created before this entire migration still
     renders and functions completely: its media downloads (legacy storage paths), its legacy
     enum status, its historical quotes, and its historical payments.

Report anything still open as an explicit, prioritized list. Do not begin new feature work.
```

---

## 5. Summary of the sequence

| # | Phase | DB migration | Risk |
|---|---|---|---|
| 1 | Read-only audit | — | none |
| 2 | `businesses` + nullable `business_id` + backfill | v29 | low |
| 3 | `NOT NULL` + integrity triggers | v30 | medium |
| 4 | `super_admin` + SQL helpers | v31, v31b | medium |
| 5 | RLS business scoping | v32 | high |
| 6 | Isolation test harness | tests/ | none |
| 7 | Tenant context + cache-leak fixes | — | medium |
| 8 | `business_settings` | v33 | medium |
| 9 | Service role batch 1: clients/projects | — | high |
| 10 | Service role batch 2: media | — | **highest** |
| 11 | Service role batch 3: notify/email | — | high |
| 12 | Service role batch 4: money/lifecycle | v34 | **highest** |
| 13 | Storage path prefixing | v35 | **highest** |
| 14 | DB-driven branding | v36 | medium |
| 15 | Per-business email sender | — | medium |
| 16 | Editable services | v37 | medium |
| 17 | Editable stages | v38 | high |
| 18 | Stripe Connect | v39 | **highest** |
| 19 | Public tenant resolution | — | high |
| 20 | Super admin console | v40 | medium |
| 21 | Automations | v41 | medium |
| 22 | Hardening + pentest | v42 | none |

Ship prompts 1–8 before touching anything user-visible. Prompts 10, 12, 13, and 18 are the four
where a mistake reaches real clients — do those one at a time, with the full manual regression
each time, and deploy them separately so a rollback is unambiguous.
