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

## 1. DATABASE — v30 `business_id` DEFAULT (closed in v35)

Migration `supabase/migration-v35-drop-transitional-defaults.sql` dropped the v30
`DEFAULT '00000000-0000-0000-0000-000000000001'` from all **25** tables. `NOT NULL`
remains. An INSERT that omits `business_id` now fails at the database instead of
silently attaching to Swift.

`profiles` never had this DEFAULT and was not touched.

The 25 tables (from v30 lines 106–130):

`clients`, `leads`, `properties`, `projects`, `project_clients`, `project_quotes`, `asset_reviews`, `revisions`, `media_assets`, `media_folders`, `media_asset_tags`, `media_downloads`, `media_asset_events`, `tours`, `payments`, `shoot_proposals`, `client_messages`, `client_message_reads`, `project_messages`, `project_message_reads`, `notifications`, `communications`, `email_events`, `activity_logs`, `client_notes`.

Every `src/` INSERT against those tables stamps `business_id` either as an explicit
column (cookie-client writes) or via `createTenantServiceClient` `injectBusinessId`.
`project_messages` / `project_message_reads` have no application writes; dropping
their DEFAULT still fail-closes any future INSERT that forgets the column.

With v35 applied, the checklist below is **fully satisfied**. Do not onboard a
second production business until a post-deploy day of logs has been watched for
`business_id` NOT NULL violations (any unconverted write path will now fail loudly).

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

## 4. CATEGORY C — honest placeholders (cleared in prompt 12b)

The ten Category C sites from cron, public `/request`, `status-automation.ts`, `workflow.ts`, and `shoot-proposals` are gone. Each of those paths now stamps or loads a real `business_id`.

Find remaining identifiers with:

```bash
grep -rn "LEGACY_DEFAULT_BUSINESS_ID" src/ | grep -v "?? LEGACY" | grep -v "export const" | grep -v "import "
```

After prompt 18 that grep reports **2** lines (plus GHL’s aliased import), none of which is a missing-context placeholder:

| File | Why it is not Category C | Count |
|---|---|---|
| `src/lib/onesignal-push.ts` | Send-filter policy: untagged subscriptions still match **Swift** admin push. | 1 |
| `src/lib/stripe-connect.ts` `isPlatformStripeBusiness` | Which Stripe **account** Swift uses (platform vs Connect), not a data-access fallback. | 1 |

`resolvePublicSignupBusinessId` no longer uses Swift when the host is missing. Public `/api/request` and `/api/leads` require an active host-resolved tenant; the body `business_id` / `business_slug` must match that host or the request is 400.

GHL’s Swift env-var fallback aliases the constant on import (`SWIFT_AERIAL_MEDIA_ID`) so it does not appear in the identifier grep. Tenant B with an empty webhook URL skips sync; only Swift inherits `GHL_PORTAL_LEAD_WEBHOOK_URL`.

(`src/lib/tenant.ts` export of the constant is not a call site.)

Fail-open grep after prompt 18:

- `?? LEGACY_DEFAULT_BUSINESS_ID` → **0**
- Identifier grep (excluding export/import) → **2** (OneSignal filter + Stripe platform-account check)
- Public signup Swift default → **removed**

---

## 5. SIGNUP — `handle_new_user()` `profiles.business_id` (closed in prompt 12b)

`src/app/api/request/route.ts` now passes `business_id` in `auth.admin.createUser` `user_metadata` and stamps `profiles.business_id` on the follow-up update. `handle_new_user()` (v31b) writes the same id when present.

Optional `business_id` / `business_slug` on the public body must **match the host-resolved business** and refer to an active, non-deleted row (400 otherwise). There is no Swift fallback when the host is the platform or unmatched.

One person cannot be a client of two businesses: if the email already exists as a client of a **different** business, the route returns 409 `email_other_business` rather than creating a second client.

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

| Check | After v35 | Before 2nd business |
|---|---|---|
| `?? LEGACY_DEFAULT_BUSINESS_ID` on authenticated paths | **0** | **0** |
| `?? LEGACY_DEFAULT_BUSINESS_ID` in `getProfile()` (Category D) | **0** | **0** |
| Category C missing-context placeholders | **0** (OneSignal Swift **push filter** + Stripe `isPlatformStripeBusiness` remain; public-form Swift default **removed** in prompt 18) | **0** placeholders |
| `/api/request` `user_metadata` includes `business_id` | **yes** | **yes** |
| v30 `business_id` DEFAULT on 25 tables | **dropped** | **dropped** |

**This checklist is fully satisfied.** New authenticated code paths must still fail closed (standing rule at the top of this file). Do not create a second production tenant until post-deploy logs have been watched for `business_id` NOT NULL violations.
