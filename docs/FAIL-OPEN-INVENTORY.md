# Fail-open inventory

> **From prompt 9b onward, any NEW authenticated code path must fail closed. Do not add
> `?? LEGACY_DEFAULT_BUSINESS_ID` to an authenticated route or component.**

When an authenticated admin or client has no resolvable tenant, that is an error. Silently
substituting Swift Aerial Media (`00000000-0000-0000-0000-000000000001`) would make a future
Tenant B user read and write Swift’s data while the UI looks healthy. A query scoped to the
wrong tenant returns plausible data — harder to detect than an empty result.

This cannot occur for current traffic: every admin and client profile already has
`business_id` set. The prompt 9b flip is therefore inert for Swift users.

Re-run the grep commands at the bottom after **every** tenant prompt.

---

## Prompt 9b classification (before edits)

`grep -rn "?? LEGACY_DEFAULT_BUSINESS_ID" src/` reported **42** sites:

| Category | Count | Disposition |
|---|---|---|
| **(A)** Authenticated API route | **32** | Fail-closed HTTP 400 via `missingTenantResponse(role)` |
| **(B)** Authenticated page or layout | **7** | `requireTenantContext()` throws; surfaces in `src/app/error.tsx` |
| **(C)** Context-free library helper | **1** | Unconditional `LEGACY_DEFAULT_BUSINESS_ID` + TODO |
| **(D)** Bootstrap (`getProfile`) | **2** | **Fixed in prompt 10 Step 0** — no remaining `?? LEGACY` sites |

---

## 1. DATABASE — v30 `business_id` DEFAULT (still open)

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

## 2. AUTHENTICATED PATHS — fail-closed (zero `??` sites)

There are **no** remaining `?? LEGACY_DEFAULT_BUSINESS_ID` sites on authenticated API routes,
pages, or layouts.

Pattern (API — matches `src/app/api/admin/settings/route.ts`):

```ts
const tenant = await getTenantContext();
if (!tenant) return missingTenantResponse(profile.role);
```

`missingTenantResponse` (`src/lib/tenant.ts`):

- `super_admin` → 400 `"No business context. Super admins must impersonate a business before reading or writing data."`
- anyone else → 400 `"No business context on this account. Tenant context could not be resolved."`

Pattern (pages/layouts behind `/admin` or `/dashboard`):

```ts
const tenant = await requireTenantContext();
await getAppSettings(tenant.businessId);
```

`requireTenantContext()` throws `Error("Unauthorized")`. That is caught by the root
`src/app/error.tsx` boundary (“Something went wrong” / “An unexpected error occurred”, Try again,
Back to dashboard) — not a blank page. Middleware already redirects unauthenticated users to
`/login` before these layouts run.

---

## 3. CATEGORY D — `src/lib/auth.ts` `getProfile()` (fixed in prompt 10 Step 0)

Both remaining `?? LEGACY_DEFAULT_BUSINESS_ID` sites were misclassified as unresolvable bootstrap cases. They did **not** need tenant context (no recursion into `getTenantContext()`).

- **`ensureClientPortalLink`:** the client lookup already selected `id, business_id`. The matched row's `business_id` is now captured on every path (`user_id` match, email match with profile business, and the unscoped single-match branch) and passed through. If it is missing, the portal-link call is skipped. `clients.business_id` is NOT NULL as of v30.
- **`touchClientLogin`:** if the `clients` row is missing or has no `business_id`, the call is skipped entirely. Guessing Swift's id would have attached a login timestamp to the wrong tenant.

`grep -rn "?? LEGACY_DEFAULT_BUSINESS_ID" src/` is **0**.

---

## 4. CATEGORY C — honest placeholders (unconditional `LEGACY_DEFAULT_BUSINESS_ID`)

No `??` fallback. Cron, webhooks, public signup, and library helpers reachable from those
paths. Each still needs a real source (usually `project.business_id` / `payment.business_id` /
`client.business_id`).

Find with:

```bash
grep -rn "LEGACY_DEFAULT_BUSINESS_ID" src/ | grep -v "?? LEGACY" | grep -v "export const" | grep -v "import "
```

| File | Resolving prompt |
|---|---|
| `src/app/api/cron/workflow-reminders/route.ts` | **12** — iterate active businesses / `project.business_id` |
| `src/lib/stripe-payments.ts` (5 sites) | **12** — Stripe webhook; `payment.business_id` from metadata |
| `src/app/api/request/route.ts` (2 sites) | **12** — public `/request` stamps a real `business_id` |
| `src/lib/status-automation.ts` (2 sites) | **12** |
| `src/lib/preliminary-estimates.ts` (3 sites) | **12** |
| `src/lib/workflow.ts` (2 sites) | **12** |
| `src/app/api/quotes/route.ts` activity logs (2 sites) | **12** |
| `src/app/api/shoot-proposals/route.ts` activity logs (3 sites) | **12** |
| `src/app/api/approvals/route.ts` | **12** |
| `src/app/api/revisions/route.ts` (2 sites) | **12** |

Prompt 11 removed Category C from `email.ts`, `notifications.ts`, `client-email-notifications.ts`, `email-analytics.ts`, and both message routes. `src/lib/onesignal-push.ts` compares the send-time `businessId` to `LEGACY_DEFAULT_BUSINESS_ID` so **untagged** subscriptions still match Swift admin push; that is send-filter policy, not a missing-context placeholder.

(`src/lib/tenant.ts` export of the constant is not a call site.)

---

## 5. SIGNUP — `handle_new_user()` NULL `profiles.business_id` (still open)

`src/app/api/request/route.ts` (`auth.admin.createUser`) passes

```ts
user_metadata: { full_name, role: "client" }
```

and does **not** pass `business_id`. `handle_new_user()` (v31b) therefore leaves
`profiles.business_id` NULL.

Currently masked by `current_business_id()` falling back to `clients.business_id` for
`user_id = auth.uid()` (non-deleted). Public `/request` still uses unconditional LEGACY for
property/activity stamps (Category C, prompt 12).

Admin-created portal users (`clients/route.ts` POST, `enableClientPortalAccess`) now pass
`business_id` in `user_metadata`.

**Removal gate:** prompt 12 (public `/request` must stamp a real business on signup).

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

| Check | After prompt 11 | Before 2nd business |
|---|---|---|
| `?? LEGACY_DEFAULT_BUSINESS_ID` on authenticated paths | **0** | **0** |
| `?? LEGACY_DEFAULT_BUSINESS_ID` in `getProfile()` (Category D) | **0** | **0** |
| Unconditional `LEGACY_DEFAULT_BUSINESS_ID` call sites | listed in §4 | **0** |
| `/api/request` `user_metadata` includes `business_id` | no (prompt 12) | **yes** |
| v30 `business_id` DEFAULT still on 25 tables | yes (prompt 12) | **dropped** |

Do not create a second production tenant until every row in the last column is satisfied.
