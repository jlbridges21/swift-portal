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
| `src/lib/status-automation.ts` | pending — **12b** |
| `src/lib/workflow.ts` | pending — **12b** |
| `src/lib/stripe-payments.ts` | **done** (prompt 12). Global Stripe-ID lookups stay on `createServiceClient()` (webhook has no tenant). After resolution, `checkPaymentBusinessAttribution` derives business from `payment.business_id`, cross-checks metadata when present, and refuses the write on mismatch/missing. Status writes and settings use the tenant wrapper / `getAppSettings(payment.business_id)`. |
| `src/lib/stripe-webhook-events.ts` | **done** (prompt 12). `processed_stripe_events` is platform-scoped — stays `.raw` / unscoped service client. Idempotency unchanged. |
| `src/lib/stripe-metadata.ts` | N/A — metadata helpers. `buildStripePaymentMetadata` now requires `businessId` (`businessId` + `business_id` keys). `sanitizeMetadataForLog` allowlists those keys (UUIDs, not secrets). |
| `src/lib/pricing-workflow.ts` | N/A — no queries. |
| `src/lib/payment-quote.ts` | N/A — no queries. |
| `src/lib/payment-status.ts` | N/A — status helpers only. |
| `src/lib/deliverables.ts` | N/A — `canDownloadDeliverables` is status-only. Callers already tenant-scope the project. |
| `src/lib/google-calendar.ts` | pending — **12b** |
| `src/lib/ghl/sync-portal-lead.ts` | pending — **12b** |
| `src/lib/preliminary-estimates.ts` | **done** (prompt 12). Resolves `project.business_id` (optional `options.businessId`); logs and returns null if missing — no LEGACY. Inserts via tenant wrapper. |
| `src/lib/quote-archive.ts` | **done** (prompt 12). Signature is `(businessId, projectId, keepQuoteId)`. |
| `src/lib/communication-records.ts` | **done** (prompt 11). `businessId` required; tenant `insert` stamps `communications.business_id`. |
| `src/lib/email-analytics.ts` | **done** (prompt 11). `recordEmailEvent` / `getProjectEmailEvents` require `businessId`. Activity + communications use that id (no LEGACY). |
| `src/lib/message-templates.ts` | **done** (prompt 11). `buildProjectMessageVariables` reads `project.business_id` then tenant-scopes the client lookup. Callers (workflow, prompt 12) unchanged. |
| `src/lib/client-email-notifications.ts` | **done** (prompt 11). `businessId` required; settings and branded send use it. |
| `src/lib/client-messaging.ts` | **done** (prompt 11). Every export takes `businessId`. `listAdminConversations` is tenant-scoped (was an unfiltered `limit(500)` inbox leak). |
| `src/lib/media-library.ts` | **done** (prompt 10). `businessId` required on every export. Unassigned `media_assets` (`project_id` NULL) stay visible to their own business and invisible to others. Filter options (clients, properties, projects, services, tags) are all tenant-scoped. |
| `src/lib/media-upload.ts` | N/A — no service-role queries. `// TODO(tenant): prefix storage paths — prompt 13` left on `buildMediaStoragePath`. |
| `src/lib/project-zip-download.ts` | **done** (prompt 10). `authorizeProjectZipDownload` takes tenant-scoped `.from()`; `buildProjectZipBuffer` still needs `.storage` and is called with `db.raw`. |
| `src/app/admin/calendar/page.tsx` | pending — **12b** |
| `src/app/admin/media/page.tsx` | **done** (prompt 10) — `requireTenantContext()` then library helpers |
| `src/app/api/admin/email/route.ts` | **done** (prompt 11). Fail-closed tenant before prefs lookup. Clients via tenant `from()`; profiles via `.raw` + `business_id`. Test send passes `tenant.businessId`. |
| `src/app/api/admin/push/route.ts` | **done** (prompt 11). Fail-closed tenant. Profiles via `.raw`. Test push / subscribe pass `businessId`. |
| `src/app/api/notifications/route.ts` | **done** (prompt 11). Stays cookie `createClient()` + RLS (`user_id = auth.uid()`). Optional extra `.eq("business_id")` when `profile.business_id` is set. No status-code change (GET still `[]` / 401). |
| `src/app/api/asset-reviews/route.ts` | **done** (prompt 10 + 12). GET stays cookie `createClient()` + RLS, with extra `.eq("business_id")` when `profile.business_id` is set. POST/PATCH and `checkAllApproved` use the tenant wrapper. `notifyAdmins` receives `businessId`. |
| `src/app/api/cron/workflow-reminders/route.ts` | pending — **12b** |
| `src/app/api/leads/route.ts` | pending — **12b** |
| `src/app/api/leads/[id]/route.ts` | pending — **12b** |
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
| `src/app/api/payments/route.ts` | **done** (prompt 12). Fail-closed tenant. Insert/update via tenant wrapper (stamps `payments.business_id`). Stripe payment-link metadata includes `business_id`. |
| `src/app/api/payments/[id]/route.ts` | **done** (prompt 12). Fail-closed tenant. Mark-paid / delete scoped to caller business. |
| `src/app/api/payments/[id]/checkout/route.ts` | **done** (prompt 12). Cookie RLS load + extra `business_id` when tenant is known; Checkout Session metadata includes `business_id`. HTTP codes (404/403/409/redirect) unchanged. |
| `src/app/api/payments/[id]/receipt/route.ts` | **done** (prompt 12). Cookie RLS + `business_id`. HTML receipt uses `getAppSettings(businessId).business.businessName` (escaped). Full branding is prompt 15. |
| `src/app/api/stripe/webhook/route.ts` | **done** (prompt 12). Highest-risk route: no auth, excluded from proxy matcher. Global Stripe-ID lookup unchanged. After resolve: attribute from `payment.business_id`, reject metadata mismatch without writing, log `businessId` on events. Idempotency / signature / success-failure HTTP unchanged. Stripe Connect is prompt 14. |
| `src/app/api/approvals/route.ts` | **done** (prompt 12). Fail-closed tenant. Project update extra `.eq("business_id")`. Activity + `notifyAdmins` use `businessId`. |
| `src/app/api/revisions/route.ts` | **done** (prompt 12). GET cookie RLS + extra `business_id`. POST/PATCH fail-closed tenant wrapper (insert stamps `revisions.business_id`). |
| `src/app/api/quotes/route.ts` | **done** (prompt 12). GET cookie RLS + extra `business_id`. POST/PATCH fail-closed tenant wrapper. `archivePreviousOfficialQuotes(businessId, …)`. |
| `src/app/api/profile/route.ts` | pending |
| `src/app/api/profile/avatar/route.ts` | pending |
| `src/app/api/request/route.ts` | pending — **12b** |
| `src/app/api/request/logged-in/route.ts` | pending — **12b** |
| `src/app/api/shoot-proposals/route.ts` | pending — **12b** |
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

Isolation harness after prompt 11: **65** assertions (was 63). A Tenant B project notification produces zero rows for the Swift admin profile; a Tenant B `client_messages` row is invisible to the Swift admin inbox-shaped query.

## Quotes, payments, Stripe webhook (prompt 12)

Money paths stamp and filter `business_id` on `project_quotes`, `payments`, `revisions`, and `asset_reviews`. Do not rely on the v30 DEFAULT.

**Stripe webhook:** lookups by `stripe_payment_intent_id` / `stripe_checkout_session_id` / `stripe_payment_link_id` remain **global** (no tenant on the webhook). After a row is found, business comes from `payment.business_id`. Metadata `businessId`/`business_id`, when present, must match; mismatch logs both ids and writes nothing. Missing metadata (legacy events) is allowed — the payment row wins. `getAppSettings` uses the payment’s business. The platform Stripe account is still shared (Connect is prompt 14).

Do **not** convert the request flow, shoot proposals, scheduling, cron, Google Calendar, or GoHighLevel until prompt **12b**. `status-automation.ts` and `workflow.ts` still contain Category C LEGACY for those callers.

Isolation harness after prompt 12: **66** assertions (was 65). A Swift admin cannot read or update Tenant B `payments` / `project_quotes`.
