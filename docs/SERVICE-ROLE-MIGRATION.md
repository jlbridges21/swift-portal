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
| `src/lib/notifications.ts` | pending |
| `src/lib/onesignal-push.ts` | pending |
| `src/lib/status-automation.ts` | pending |
| `src/lib/stripe-payments.ts` | pending |
| `src/lib/stripe-webhook-events.ts` | pending |
| `src/lib/google-calendar.ts` | pending |
| `src/lib/ghl/sync-portal-lead.ts` | pending |
| `src/lib/preliminary-estimates.ts` | pending |
| `src/lib/communication-records.ts` | pending |
| `src/lib/email-analytics.ts` | pending |
| `src/lib/message-templates.ts` | pending |
| `src/lib/client-email-notifications.ts` | pending |
| `src/lib/client-messaging.ts` | pending |
| `src/lib/media-library.ts` | pending |
| `src/app/admin/calendar/page.tsx` | pending |
| `src/app/api/admin/email/route.ts` | pending |
| `src/app/api/admin/push/route.ts` | pending |
| `src/app/api/asset-reviews/route.ts` | pending |
| `src/app/api/cron/workflow-reminders/route.ts` | pending |
| `src/app/api/leads/route.ts` | pending |
| `src/app/api/leads/[id]/route.ts` | pending |
| `src/app/api/media/[id]/route.ts` | pending |
| `src/app/api/media/[id]/property-line/route.ts` | pending |
| `src/app/api/media/bulk/route.ts` | pending |
| `src/app/api/media/download/[id]/route.ts` | pending |
| `src/app/api/media/move-to-folder/route.ts` | pending |
| `src/app/api/media/reorder/route.ts` | pending |
| `src/app/api/media/upload/complete/route.ts` | pending |
| `src/app/api/media/upload/route.ts` | pending |
| `src/app/api/media/upload/sign/route.ts` | pending |
| `src/app/api/media/youtube/route.ts` | pending |
| `src/app/api/media-folders/route.ts` | pending |
| `src/app/api/messages/route.ts` | pending |
| `src/app/api/projects/[id]/messages/route.ts` | pending |
| `src/app/api/projects/[id]/download-zip/route.ts` | pending |
| `src/app/api/payments/[id]/route.ts` | pending |
| `src/app/api/profile/route.ts` | pending |
| `src/app/api/profile/avatar/route.ts` | pending |
| `src/app/api/quotes/route.ts` | pending |
| `src/app/api/request/route.ts` | pending |
| `src/app/api/request/logged-in/route.ts` | pending |
| `src/app/api/shoot-proposals/route.ts` | pending |
| `src/app/api/tours/route.ts` | pending |

Do **not** start media, notification, email, payment, quote, scheduling, or messaging files until the next dedicated prompt.
