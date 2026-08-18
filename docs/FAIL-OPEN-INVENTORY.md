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

These sites use tenant context when present, otherwise **silently read/write Swift’s settings**. They must become fail-CLOSED (throw or HTTP 400) rather than fail-open.

| File:line | Status |
|---|---|
| `src/app/api/payments/route.ts:25` | OPEN |
| `src/app/api/shoot-proposals/route.ts:78` | OPEN |
| `src/app/api/shoot-proposals/route.ts:220` | OPEN |
| `src/app/api/shoot-proposals/route.ts:264` | OPEN |
| `src/app/api/asset-reviews/route.ts:182` | OPEN |
| `src/app/api/projects/[id]/messages/route.ts:145` | OPEN |
| `src/app/api/messages/route.ts:168` | OPEN |
| `src/app/api/quotes/route.ts:52` | OPEN |
| `src/app/api/quotes/route.ts:142` | OPEN |
| `src/app/api/quotes/route.ts:207` | OPEN |
| `src/app/api/admin/email/route.ts:93` | OPEN |
| `src/app/api/admin/settings/route.ts` GET | **CLOSED (prompt 8)** — 400 when tenant context is missing (including super_admin with no impersonation) |
| `src/app/api/admin/settings/route.ts` PATCH | **CLOSED (prompt 8)** — 400 when tenant context is missing |
| `src/app/dashboard/projects/[id]/page.tsx:67` | OPEN |
| `src/app/dashboard/page.tsx:39` | OPEN |
| `src/app/admin/settings/page.tsx:18` | OPEN |
| `src/app/dashboard/layout.tsx:9` | OPEN |
| `src/app/admin/layout.tsx:10` | OPEN |
| `src/lib/email.ts:43` | OPEN |

After prompt 8, `grep -rn "?? LEGACY_DEFAULT_BUSINESS_ID" src/` should report **17** remaining hits (the two settings-API sites no longer use the fallback).

**Removal gate:** before the second tenant is created. Every remaining hit must throw or 400.

---

## 3. SIGNUP — `handle_new_user()` NULL `profiles.business_id`

`src/app/api/request/route.ts` (`auth.admin.createUser`) passes

```ts
user_metadata: { full_name, role: "client" }
```

and does **not** pass `business_id`. `handle_new_user()` (v31b) therefore leaves `profiles.business_id` NULL.

Currently masked by `current_business_id()` falling back to `clients.business_id` for `user_id = auth.uid()` (non-deleted).

**Removal gate:** prompt 12 (public `/request` must stamp a real business on signup).

---

## 4. Honest placeholders (not fail-open)

Unconditional `LEGACY_DEFAULT_BUSINESS_ID` arguments — no `??` fallback. Cron, webhooks, and library helpers that have no request tenant. They still need a real source (usually `project.business_id` / `payment.business_id`) later.

Find with:

```bash
grep -rn "LEGACY_DEFAULT_BUSINESS_ID" src/ | grep -v "?? LEGACY" | grep -v "export const"
```

| File:line | Why |
|---|---|
| `src/app/api/cron/workflow-reminders/route.ts:22` | Cron has no user; must iterate `project.business_id` |
| `src/lib/stripe-payments.ts:34` | Stripe webhook; pass `payment.business_id` from metadata |
| `src/lib/stripe-payments.ts:298` | Same |
| `src/lib/notifications.ts:220` | Pass recipient/project `business_id` into `notifyUsers` |
| `src/lib/status-automation.ts:40` | Pass `project.business_id` from `setProjectStatus` callers |
| `src/lib/preliminary-estimates.ts:14` | Pass `project.business_id` |
| `src/lib/preliminary-estimates.ts:70` | Same |
| `src/lib/client-email-notifications.ts:270` | Pass client/project `business_id` |
| `src/lib/workflow.ts:15` | Pass `businessId` into `getWorkflowSettings` |

**9 sites.** (`src/lib/tenant.ts` export of the constant is not a call site.)

---

## MUST BE ZERO BEFORE ONBOARDING A SECOND BUSINESS

Re-verify after every subsequent prompt:

```bash
# Fail-open application sites (must be 0)
grep -rn "?? LEGACY_DEFAULT_BUSINESS_ID" src/

# Honest placeholders (must be 0, or each must resolve a real business_id)
grep -rn "LEGACY_DEFAULT_BUSINESS_ID" src/ | grep -v "?? LEGACY" | grep -v "export const"

# Signup still omitting business_id in user_metadata (must be gone)
grep -n "user_metadata" src/app/api/request/route.ts
```

| Check | After prompt 8 | Before 2nd business |
|---|---|---|
| `?? LEGACY_DEFAULT_BUSINESS_ID` | **17** | **0** |
| Unconditional `LEGACY_DEFAULT_BUSINESS_ID` call sites | **9** | **0** |
| `/api/request` `user_metadata` includes `business_id` | no (prompt 12) | **yes** |
| v30 `business_id` DEFAULT still on 25 tables | yes (prompt 12) | **dropped** |

Do not create a second production tenant until every row in the last column is satisfied.
