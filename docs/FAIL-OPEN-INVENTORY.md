# Fail-open inventory

Transitional behavior that **silently attributes data or settings to Swift Aerial Media** (`00000000-0000-0000-0000-000000000001`) when the real business cannot be determined.

Re-run the grep commands at the bottom after **every** tenant prompt. Counts must reach the checklist targets before onboarding a second business.

---

## 1. DATABASE — v30 `business_id` DEFAULT

Migration `supabase/migration-v30-tenant-integrity.sql` set

```sql
DEFAULT '00000000-0000-0000-0000-000000000001'
```

on **25 tables** (not `profiles`):

`clients`, `leads`, `properties`, `projects`, `project_clients`, `project_quotes`, `asset_reviews`, `revisions`, `media_assets`, `media_folders`, `media_asset_tags`, `media_downloads`, `media_asset_events`, `tours`, `payments`, `shoot_proposals`, `client_messages`, `client_message_reads`, `project_messages`, `project_message_reads`, `notifications`, `communications`, `email_events`, `activity_logs`, `client_notes`.

Any `INSERT` that **omits** `business_id` becomes Swift’s row.

`enforce_same_business()` (v30) only fires when a parent FK is present and non-null. It does **not** catch omitted `business_id` on:

- `clients` (no parent)
- `leads` (optional `project_id`)
- `properties` (optional `client_id`)
- unassigned `media_assets` (`project_id` nullable)
- parentless `activity_logs`, `communications`, `notifications`

**Removal gate:** after prompt 12, once every write path sets `business_id` explicitly. Then `DROP DEFAULT` on those 25 columns.

---

## 2. APPLICATION — fail-open `?? LEGACY_DEFAULT_BUSINESS_ID`

Find with:

```bash
grep -rn "?? LEGACY_DEFAULT_BUSINESS_ID" src/
```

These sites use tenant context when present, otherwise **silently read/write Swift’s** data. They must become fail-CLOSED (throw or HTTP 400) rather than fail-open.

Prompt 9 added `businessId` parameters across CRM/project libraries. Admin APIs in that batch still fall open so HTTP statuses stay unchanged.

| File:line | Status |
|---|---|
| `src/app/api/clients/route.ts:10` | OPEN (prompt 9) |
| `src/app/api/clients/route.ts:34` | OPEN (prompt 9) |
| `src/app/api/clients/route.ts:108` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/route.ts:15` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/route.ts:35` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/notes/route.ts:14` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/notes/route.ts:43` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/notes/route.ts:76` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/notes/route.ts:108` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/portal/route.ts:20` | OPEN (prompt 9) |
| `src/app/api/clients/[id]/portal/route.ts:49` | OPEN (prompt 9) |
| `src/app/api/projects/route.ts:37` | OPEN (prompt 9) |
| `src/app/api/projects/route.ts:134` | OPEN (prompt 9) |
| `src/app/api/projects/[id]/route.ts:15` | OPEN (prompt 9) |
| `src/app/api/projects/[id]/route.ts:35` | OPEN (prompt 9) |
| `src/app/api/project-clients/route.ts:15` | OPEN (prompt 9) |
| `src/app/api/project-clients/route.ts:48` | OPEN (prompt 9) |
| `src/app/api/project-clients/route.ts:111` | OPEN (prompt 9) |
| `src/app/admin/clients/page.tsx:20` | OPEN (prompt 9) |
| `src/app/admin/clients/[id]/page.tsx:21` | OPEN (prompt 9) |
| `src/lib/auth.ts:89` | OPEN (prompt 9) |
| `src/lib/auth.ts:102` | OPEN (prompt 9) |
| `src/app/api/request/logged-in/route.ts:73` | OPEN (prompt 9) |
| `src/app/api/request/logged-in/route.ts:77` | OPEN (prompt 9) |
| `src/app/api/request/logged-in/route.ts:101` | OPEN (prompt 9) |
| `src/app/api/payments/route.ts:24` | OPEN |
| `src/app/api/shoot-proposals/route.ts:77` | OPEN |
| `src/app/api/shoot-proposals/route.ts:220` | OPEN |
| `src/app/api/shoot-proposals/route.ts:263` | OPEN |
| `src/app/api/asset-reviews/route.ts:183` | OPEN |
| `src/app/api/projects/[id]/messages/route.ts:148` | OPEN |
| `src/app/api/messages/route.ts:171` | OPEN |
| `src/app/api/quotes/route.ts:51` | OPEN |
| `src/app/api/quotes/route.ts:141` | OPEN |
| `src/app/api/quotes/route.ts:206` | OPEN |
| `src/app/api/admin/email/route.ts:93` | OPEN |
| `src/app/api/admin/settings/route.ts` GET | **CLOSED (prompt 8)** — 400 when tenant context is missing (including super_admin with no impersonation) |
| `src/app/api/admin/settings/route.ts` PATCH | **CLOSED (prompt 8)** — 400 when tenant context is missing |
| `src/app/dashboard/projects/[id]/page.tsx:67` | OPEN |
| `src/app/dashboard/page.tsx:39` | OPEN |
| `src/app/admin/settings/page.tsx:18` | OPEN |
| `src/app/dashboard/layout.tsx:9` | OPEN |
| `src/app/admin/layout.tsx:10` | OPEN |
| `src/lib/email.ts:43` | OPEN |

After prompt 9, `grep -rn "?? LEGACY_DEFAULT_BUSINESS_ID" src/` reports **42** remaining hits.

**Removal gate:** before the second tenant is created. Every remaining hit must throw or 400.

---

## 3. SIGNUP — `handle_new_user()` NULL `profiles.business_id`

`src/app/api/request/route.ts` (`auth.admin.createUser`) passes

```ts
user_metadata: { full_name, role: "client" }
```

and does **not** pass `business_id`. `handle_new_user()` (v31b) therefore leaves `profiles.business_id` NULL.

Currently masked by `current_business_id()` falling back to `clients.business_id` for `user_id = auth.uid()` (non-deleted).

Admin-created portal users (`clients/route.ts` POST, `enableClientPortalAccess`) now pass `business_id` in `user_metadata`. Public `/request` still does not.

**Removal gate:** prompt 12 (public `/request` must stamp a real business on signup).

---

## 4. Honest placeholders (not fail-open)

Unconditional `LEGACY_DEFAULT_BUSINESS_ID` arguments — no `??` fallback. Cron, webhooks, library helpers, and out-of-batch callers of newly-required `businessId` parameters. They still need a real source (usually `project.business_id` / `payment.business_id` / `client.business_id`).

Find with:

```bash
grep -rn "LEGACY_DEFAULT_BUSINESS_ID" src/ | grep -v "?? LEGACY" | grep -v "export const" | grep -v "import "
```

| File:line | Why |
|---|---|
| `src/app/api/cron/workflow-reminders/route.ts:22` | Cron has no user; must iterate `project.business_id` |
| `src/lib/stripe-payments.ts:34` | Stripe webhook; pass `payment.business_id` from metadata |
| `src/lib/stripe-payments.ts:98` | Same (activity log) |
| `src/lib/stripe-payments.ts:299` | Same |
| `src/lib/stripe-payments.ts:303` | Same (activity log) |
| `src/lib/stripe-payments.ts:328` | Same (activity log) |
| `src/lib/notifications.ts:95` | `ensureClientPortalLink` until notify paths are converted |
| `src/lib/notifications.ts:223` | Pass recipient/project `business_id` into `notifyUsers` |
| `src/lib/status-automation.ts:40` | Pass `project.business_id` from `setProjectStatus` callers |
| `src/lib/status-automation.ts:119` | Same (activity log) |
| `src/lib/preliminary-estimates.ts:14` | Pass `project.business_id` |
| `src/lib/preliminary-estimates.ts:70` | Same |
| `src/lib/preliminary-estimates.ts:121` | Same (activity log) |
| `src/lib/client-email-notifications.ts:270` | Pass client/project `business_id` |
| `src/lib/workflow.ts:15` | Pass `businessId` into `getWorkflowSettings` |
| `src/lib/workflow.ts:102` | Pass `project.business_id` into `logWorkflowAudit` |
| `src/lib/email-analytics.ts:115` | Pass `project.business_id` |
| `src/app/api/request/route.ts:133` | Public signup; prompt 12 |
| `src/app/api/request/route.ts:137` | Same |
| `src/app/api/messages/route.ts:154` | `ensureClientPortalLink` until messaging is converted |
| `src/app/api/projects/[id]/messages/route.ts:133` | Same |
| `src/app/api/quotes/route.ts:360` | Activity log; quotes batch later |
| `src/app/api/quotes/route.ts:442` | Same |
| `src/app/api/asset-reviews/route.ts:105` | Activity log |
| `src/app/api/approvals/route.ts:45` | Activity log |
| `src/app/api/revisions/route.ts:79` | Activity log |
| `src/app/api/revisions/route.ts:126` | Same |
| `src/app/api/tours/route.ts:62` | Activity log |
| `src/app/api/media/upload/route.ts:141` | Activity log |
| `src/app/api/media/upload/complete/route.ts:242` | Activity log |
| `src/app/api/shoot-proposals/route.ts:349` | Activity log |
| `src/app/api/shoot-proposals/route.ts:396` | Same |
| `src/app/api/shoot-proposals/route.ts:442` | Same |

**33 sites.** (`src/lib/tenant.ts` export of the constant is not a call site.)

---

## MUST BE ZERO BEFORE ONBOARDING A SECOND BUSINESS

Re-verify after every subsequent prompt:

```bash
# Fail-open application sites (must be 0)
grep -rn "?? LEGACY_DEFAULT_BUSINESS_ID" src/

# Honest placeholders (must be 0, or each must resolve a real business_id)
grep -rn "LEGACY_DEFAULT_BUSINESS_ID" src/ | grep -v "?? LEGACY" | grep -v "export const" | grep -v "import "

# Signup still omitting business_id in user_metadata (must be gone)
grep -n "user_metadata" src/app/api/request/route.ts
```

| Check | After prompt 9 | Before 2nd business |
|---|---|---|
| `?? LEGACY_DEFAULT_BUSINESS_ID` | **42** | **0** |
| Unconditional `LEGACY_DEFAULT_BUSINESS_ID` call sites | **33** | **0** |
| `/api/request` `user_metadata` includes `business_id` | no (prompt 12) | **yes** |
| v30 `business_id` DEFAULT still on 25 tables | yes (prompt 12) | **dropped** |

Do not create a second production tenant until every row in the last column is satisfied.
