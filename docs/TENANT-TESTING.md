# Tenant isolation testing

Repeatable SQL harness proving **cross-tenant READ isolation** via RLS (v32) and **cross-tenant WRITE blocking** via RLS plus v30 integrity triggers. This repo has no automated unit tests; run this script manually after every migration or refactor that touches RLS, triggers, tenant helpers, or service-role write paths.

## Prerequisites

- Migrations **v29–v35** applied on PostgreSQL 16.
- Supabase project with RLS enabled (production or staging).
- Two auth users created in **Supabase Dashboard → Authentication → Add user** (email + password, auto-confirm):
  - `tenant-b-admin@example.test`
  - `tenant-b-client@example.test`
- Paste their UUIDs into the variables block at the top of `supabase/tests/tenant-isolation.sql`.

Swift cross-tenant tests use an existing Swift admin profile (default: `jackson@swiftaerialmedia.com`). Change `v_swift_admin_user_id` if you prefer another admin.

## `business_id` on INSERTs (v35)

As of `migration-v35-drop-transitional-defaults.sql`, the v30 Swift DEFAULT is gone.
`business_id` is still `NOT NULL`. **Any INSERT that omits `business_id` now fails**
instead of attaching to Swift.

This harness still sets `business_id` explicitly on every INSERT. When extending the script, do the same — the database will no longer paper over a missing column.

## How to run

1. Create the two `example.test` auth users (if not already present).
2. Open **Supabase SQL Editor → New query**.
3. Paste **`supabase/tests/tenant-isolation.sql`**.
4. Edit the **VARIABLES** block: set `v_tenant_b_admin_user_id`, `v_tenant_b_client_user_id`, and optionally `v_swift_admin_user_id`.
5. Run the **main body** (everything above the `TEARDOWN` banner). Expect:
   - Step 0: `RLS context OK — auth.uid() = …`
   - Final row: `ALL TENANT ISOLATION TESTS PASSED` with an assertion count and a `write_blocks` JSON array (RLS vs v30 trigger vs RPC for each cross-tenant write).
6. Optionally run the **TEARDOWN** section in a separate query (or uncomment and run once). It removes only Tenant B (`00000000-0000-0000-0000-0000000000ff`) and resets the two test profiles **before** deleting the business (FK-safe). **Delete the two auth users manually** in the Auth dashboard afterward.

Do **not** run teardown on a shared environment until tests pass.

## What each group proves

| Section | Actor | Proves |
|--------|--------|--------|
| **0 — RLS context** | SQL editor | `SET LOCAL ROLE authenticated` + `request.jwt.claims` yields the expected `auth.uid()` on this project. Without this, all later assertions are meaningless. |
| **Setup** | Postgres (bypasses RLS) | Tenant B business + CRM graph with explicit `business_id`; v30 triggers accept parent/child within Tenant B. |
| **4 — Read (Swift admin)** | Swift admin JWT | Zero visibility of Tenant B rows in 24 business tables + `client_stats` + `business_settings`. |
| **5 — Write (Swift admin)** | Swift admin JWT | Cannot insert/update/delete across tenants (`payments`, `project_quotes`, projects, clients, media, `reorder_media_assets`). Reports **RLS** vs **trigger** per attempt. |
| **6 — Reverse read (Tenant B admin)** | Tenant B admin JWT | Zero visibility of Swift `business_id = …0001` rows, including Swift's `business_settings` row. |
| **7 — Client role** | Tenant B client JWT | Zero Swift rows; `client_stats` returns exactly one row (own client). |

## Known gaps (not covered)

- **Service role** (`createServiceClient()`): bypasses RLS entirely. Fifty-four application files use it; this script does **not** test those paths. v30 triggers still apply to service-role writes, but reads and RLS-only guards are invisible here.
- **Storage** policies: unchanged in v32; not exercised.
- **super_admin** impersonation GUC: not exercised (no platform console yet).
- **Anon/public** lead capture: `/request` uses service role; only the authenticated `leads` INSERT policy shape is indirectly relevant if you add anon-key tests later.

## When to re-run

**Must pass** after any change to:

- RLS policies (v32+ migrations)
- `enforce_same_business` / NOT NULL / tenant indexes (v30)
- `current_business_id`, `get_user_client_id`, `client_has_project_access`, `handle_new_user` (v31b)
- `client_stats` view or `reorder_media_assets` RPC
- Application code that alters auth, profiles, or tenant write paths

## Proving the harness works (sanity check)

1. Run the full script → must pass.
2. Temporarily weaken one policy, e.g. on `clients`:

   ```sql
   DROP POLICY IF EXISTS "Admins full access clients" ON clients;
   CREATE POLICY "Admins full access clients" ON clients
     FOR ALL USING (is_super_admin() OR is_admin())
     WITH CHECK (is_super_admin() OR is_admin());
   ```

3. Re-run the script → must **fail** with a message naming `clients`.
4. Restore v32 policy from `migration-v32-rls-tenant-scope.sql` and re-run → pass again.

A harness that cannot fail is not a harness.

## Teardown safety

Teardown aborts unless `v_teardown_business_id = '00000000-0000-0000-0000-0000000000ff'`. Every `DELETE` filters on that UUID or on IDs created for Tenant B. Swift production data (`…0001`) is never targeted.
