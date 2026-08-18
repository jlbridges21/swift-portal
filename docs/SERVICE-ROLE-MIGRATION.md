# Service-role migration

`createServiceClient()` uses `SUPABASE_SERVICE_ROLE_KEY` and **bypasses RLS**. Tenant isolation for those paths is application-level: `createTenantServiceClient(businessId)` in `src/lib/supabase/tenant-service.ts`.

**Wrapper approach:** a thin `from()` facade (not a Proxy over the query builder). `select` / `update` / `delete` immediately append `.eq("business_id", businessId)` and return the native supabase-js builder. `insert` / `upsert` inject `business_id` into every row (throw if an explicit value differs). Auth, Storage, RPC, and unscoped tables use `.raw`.

Shape tests (see `scripts/verify-tenant-service-shapes.ts`):
- **a)** `select` + extra `.eq`/`.is` + `.order` + `.range` + `.maybeSingle()` — pass
- **b)** `insert` of an array of rows followed by `.select()` — pass

Resume later prompts from the **pending** list. Do not mark a file done unless its service-role `.from()` calls were converted (or justified as `.raw`).

Status key: **done** = converted this batch; **pending** = still raw service role; **N/A** = not a query surface, or barrel only.

| File | Status |
|---|---|
| `src/lib/supabase/server.ts` | N/A — definition of `createServiceClient()` |
| `src/lib/supabase/tenant-service.ts` | N/A — the wrapper (uses service role internally) |
| `src/lib/activity.ts` | **done** (prompt 9) |
| `src/lib/clients-crm.ts` | **done** (prompt 9). Cookie `createClient()` remains for RLS list/detail reads, each filtered by `business_id`. Service-role is the tenant wrapper for `auth.admin.getUserById` and activity/login touches. `listUsers` removed. |
| `src/lib/clients-data.ts` | **done** (prompt 9) — barrel re-export of `clients-crm` |
| `src/lib/client-portal-link.ts` | **done** (prompt 9). `.raw` for `profiles` and `auth.admin.*` |
| `src/lib/properties.ts` | **done** (prompt 9) |
| `src/lib/soft-delete.ts` | **done** (prompt 9) |
| `src/app/api/clients/route.ts` | **done** (prompt 9) |
| `src/app/api/clients/[id]/route.ts` | **done** (prompt 9) — no direct service client; passes `businessId` into `soft-delete` |
| `src/app/api/clients/[id]/notes/route.ts` | **done** (prompt 9) |
| `src/app/api/clients/[id]/portal/route.ts` | **done** (prompt 9) — no direct service client; passes `businessId` into portal-link |
| `src/app/api/projects/route.ts` | **done** (prompt 9). Cookie client still used for the admin RLS insert/patch path; `business_id` is set explicitly. Shoot-proposal insert uses the tenant wrapper. |
| `src/app/api/projects/[id]/route.ts` | **done** (prompt 9) — no direct service client; passes `businessId` into `soft-delete` |
| `src/app/api/project-clients/route.ts` | **done** (prompt 9) |
| `src/lib/auth.ts` | pending |
| `src/lib/tenant.ts` | pending |
| `src/lib/app-settings.ts` | pending |
| `src/lib/notifications.ts` | **done** (prompt 11). Admin recipients are `role = 'admin' AND business_id = <id>` — `super_admin` is excluded. `notify*` resolve `businessId` from the arg, else `projects.business_id` / `clients.business_id`; if unresolvable they log and return (no LEGACY). Profiles via `.raw`. |
| `src/lib/onesignal-push.ts` | **done** (prompt 11). One OneSignal app. Every admin send includes a `business_id` tag filter. Untagged subscriptions are treated as Swift on **send filters only**. Push-enabled admin ids are scoped `role = admin` AND `business_id`. Profiles via `.raw`. |
| `src/lib/onesignal-client.ts` | **done** (prompt 11). `enableAdminPushNotifications(userId, businessId)` tags `business_id` at registration (backfill on next Enable). |
| `src/lib/email.ts` | **done** (prompt 11). `businessId` required on `sendBrandedEmail` / `sendTestEmail`. Category C `emailBusinessId()` placeholder removed. Shared Resend API key; per-business from-name, reply-to, logo, colors, footer from `getAppSettings(businessId)`. Platform verified sender. `// TODO(tenant): per-business sending domain — prompt 16`. Sends a `business_id` Resend tag. |
| `src/lib/email-templates.ts` | N/A — HTML builder; branding is passed in from `sendBrandedEmail`. |
| `src/lib/communications.ts` | N/A — filters/types only; no queries. |
| `src/lib/notification-settings.ts` | N/A — event-key mapping only; no queries. |
| `src/lib/client-messages.ts` | N/A — client-facing copy only; no queries. |
| `src/lib/status-automation.ts` | pending |
| `src/lib/stripe-payments.ts` | pending |
| `src/lib/stripe-webhook-events.ts` | pending |
| `src/lib/google-calendar.ts` | pending |
| `src/lib/ghl/sync-portal-lead.ts` | pending |
| `src/lib/preliminary-estimates.ts` | pending |
| `src/lib/communication-records.ts` | **done** (prompt 11). `businessId` required; tenant `insert` stamps `communications.business_id`. |
| `src/lib/email-analytics.ts` | **done** (prompt 11). `recordEmailEvent` / `getProjectEmailEvents` require `businessId`. Activity + communications use that id (no LEGACY). |
| `src/lib/message-templates.ts` | **done** (prompt 11). `buildProjectMessageVariables` reads `project.business_id` then tenant-scopes the client lookup. Callers (workflow, prompt 12) unchanged. |
| `src/lib/client-email-notifications.ts` | **done** (prompt 11). `businessId` required; settings and branded send use it. |
| `src/lib/client-messaging.ts` | **done** (prompt 11). Every export takes `businessId`. `listAdminConversations` is tenant-scoped (was an unfiltered `limit(500)` inbox leak). |
| `src/lib/media-library.ts` | **done** (prompt 10). `businessId` required on every export. Unassigned `media_assets` (`project_id` NULL) stay visible to their own business and invisible to others. Filter options (clients, properties, projects, services, tags) are all tenant-scoped. |
| `src/lib/media-upload.ts` | N/A — no service-role queries. `// TODO(tenant): prefix storage paths — prompt 13` left on `buildMediaStoragePath`. |
| `src/lib/project-zip-download.ts` | **done** (prompt 10). `authorizeProjectZipDownload` takes tenant-scoped `.from()`; `buildProjectZipBuffer` still needs `.storage` and is called with `db.raw`. |
| `src/app/admin/calendar/page.tsx` | pending |
| `src/app/admin/media/page.tsx` | **done** (prompt 10) — `requireTenantContext()` then library helpers |
| `src/app/api/admin/email/route.ts` | **done** (prompt 11). Fail-closed tenant before prefs lookup. Clients via tenant `from()`; profiles via `.raw` + `business_id`. Test send passes `tenant.businessId`. |
| `src/app/api/admin/push/route.ts` | **done** (prompt 11). Fail-closed tenant. Profiles via `.raw`. Test push / subscribe pass `businessId`. |
| `src/app/api/notifications/route.ts` | **done** (prompt 11). Stays cookie `createClient()` + RLS (`user_id = auth.uid()`). Optional extra `.eq("business_id")` when `profile.business_id` is set. No status-code change (GET still `[]` / 401). |
| `src/app/api/asset-reviews/route.ts` | **done** (prompt 10). GET stays cookie `createClient()` + RLS. POST/PATCH and `checkAllApproved` use the tenant wrapper. |
| `src/app/api/cron/workflow-reminders/route.ts` | pending |
| `src/app/api/leads/route.ts` | pending |
| `src/app/api/leads/[id]/route.ts` | pending |
| `src/app/api/media/[id]/route.ts` | **done** (prompt 10) |
| `src/app/api/media/[id]/property-line/route.ts` | **done** (prompt 10). Storage via `.raw`. |
| `src/app/api/media/bulk/route.ts` | **done** (prompt 10). `download_urls` verifies `asset.business_id === tenant.businessId` before minting. |
| `src/app/api/media/download/[id]/route.ts` | **done** (prompt 10). Tenant-scoped asset load + explicit `business_id` check before any signed URL or file download. Admin storage via `db.raw`; client storage still uses the cookie client after that check. |
| `src/app/api/media/library/route.ts` | **done** (prompt 10) |
| `src/app/api/media/library/[id]/route.ts` | **done** (prompt 10) |
| `src/app/api/media/move-to-folder/route.ts` | **done** (prompt 10) |
| `src/app/api/media/reorder/route.ts` | **done** (prompt 10). Photo lookup is tenant-scoped; `reorder_media_assets` still goes through `db.raw.rpc` (v32 allows `service_role` without the JWT business check). |
| `src/app/api/media/upload/complete/route.ts` | **done** (prompt 10). `file_path` lookups use tenant `from()` (adds `business_id`) plus `.eq("file_path")` — composite index `idx_media_assets_business_file_path`. |
| `src/app/api/media/upload/route.ts` | **done** (prompt 10). Storage via `.raw`. |
| `src/app/api/media/upload/sign/route.ts` | **done** (prompt 10). Project must exist in the caller's business before `createSignedUploadUrl`; unassigned uploads rely on tenant context. |
| `src/app/api/media/youtube/route.ts` | **done** (prompt 10) |
| `src/app/api/media-folders/route.ts` | **done** (prompt 10). GET still allows admin or client with `canAccessProject`; folder/photo queries are tenant-scoped. |
| `src/app/api/messages/route.ts` | **done** (prompt 11). Fail-closed tenant on GET/POST/PATCH. Inbox, inserts, and `ensureClientPortalLink` are tenant-scoped. |
| `src/app/api/projects/[id]/messages/route.ts` | **done** (prompt 11). Proxies to `client_messages` (do not consolidate with `project_messages`). Tenant wrapper on insert/read. Admin GET remains 410. |
| `src/app/api/projects/[id]/email-events/route.ts` | **done** (prompt 11). Fail-closed tenant; `getProjectEmailEvents(id, businessId)`. |
| `src/app/api/resend/webhook/route.ts` | **done** (prompt 11). No auth (excluded from the proxy matcher). Resolves `business_id` from the send tag, cross-checks `projects.business_id` when `project_id` is present, writes nothing on mismatch/missing tag. Test emails (no project) use the tag alone. |
| `src/app/api/projects/[id]/download-zip/route.ts` | **done** (prompt 10). Project + media via tenant `from()`; ZIP bytes via `db.raw.storage`. |
| `src/app/api/payments/[id]/route.ts` | pending |
| `src/app/api/profile/route.ts` | pending |
| `src/app/api/profile/avatar/route.ts` | pending |
| `src/app/api/quotes/route.ts` | pending |
| `src/app/api/request/route.ts` | pending |
| `src/app/api/request/logged-in/route.ts` | pending |
| `src/app/api/shoot-proposals/route.ts` | pending |
| `src/app/api/tours/route.ts` | **done** (prompt 10). Storage delete via `.raw`. |

## Signed URLs (prompt 10 — bearer capabilities)

Each of the four minting paths verifies the caller's business **before** a URL or file bytes are produced:

1. **`upload/sign`** — fail-closed tenant. If `projectId` is set, `db.from("projects")` must return that row (other-tenant projects 404). Unassigned library uploads have no project; tenant context is the check. Then `db.raw.storage.createSignedUploadUrl`.
2. **`download/[id]`** — fail-closed tenant. Asset is loaded through the tenant client (other-tenant id → 404). Explicit `asset.business_id === tenant.businessId` before `createSignedUrl` / `download`. Unassigned rows remain admin-only; clients still pass `canAccessProject` + visibility.
3. **`bulk` `download_urls`** — each id is loaded through the tenant client; missing or other-business rows are skipped; `db.raw.storage.createSignedUrl` only after `asset.business_id === tenant.businessId`.
4. **`project-zip-download`** — fail-closed tenant. `authorizeProjectZipDownload` and the media query use tenant `from()`. Storage downloads / signed-URL fallbacks in `buildProjectZipBuffer` use `db.raw` only after that project+media set is already tenant-scoped.

## Notifications, messaging, email (prompt 11)

Two confirmed cross-tenant leaks, both fixed:

1. **`getAdminRecipients`** queried every `role = 'admin'` profile. It is now `role = 'admin' AND business_id = <businessId>`. `super_admin` does not receive business notifications.
2. **`listAdminConversations`** selected `client_messages` with no filter. It now uses the tenant client (automatic `business_id`).

**OneSignal:** one app. Subscriptions are tagged `business_id` at Enable (backfill on next login/Enable). Untagged existing devices are treated as Swift on **send filters only** (`business_id = Swift OR business_id not_exists`, still requiring `swift_portal_role = admin`). Other businesses never match untagged devices.

**`project_messages`:** no application read/write in `src/`. Isolation SQL already covers the table. Do not consolidate with `client_messages`.

Isolation harness: **65** assertions (was 63). A Tenant B project notification produces zero rows for the Swift admin profile; a Tenant B `client_messages` row is invisible to the Swift admin inbox-shaped query.

Do **not** start payment, quote, scheduling, request-flow, or cron-sweep files until the next dedicated prompt.
