# Security fix plan: profile privilege escalation (holes #1 and #2)

> **Status (2026-11-03):** built locally on `main`, not yet committed, deployed or run. Production confirmed both holes are live (S1 queries).
> **Built:**
> - `supabase/migration-v110-profile-privilege-guard.sql`: guard trigger, `WITH CHECK`, and a `handle_new_user()` that never trusts metadata.
> - `src/lib/platform-onboard.ts` and `src/lib/staff.ts`: the server-side role writes now fail loudly instead of silently.
> - Pentest attacks P1–P8 in `scripts/tenant-pentest.ts`, and a v110 assertion block in `supabase/tests/tenant-isolation.sql`.
> - Audit result: no invite path needed new code. `auth-resend-link.ts` only touches existing users, and the platform invite already writes the profile server-side.
> **Target:** commit to `main` (production deploys from `main`). Each push still gets your OK, because a push is a production deploy.
> Holes #3 (share-token sessions) and #4 (session-handoff destinations) are scheduled before the recipient access-link API work. They're not part of this fix.

## The two holes, in one line each
1. **#1:** any signed-in user can call Supabase's REST API directly and change their own `profiles.role` / `business_id`, e.g. to `super_admin`, or to `admin` of another business.
2. **#2:** public `signUp` can include `role: "admin"` and any `business_id`, and the `handle_new_user()` trigger copies them into the new profile.

## What the audit found (read-only, 2026-11-03)
- **Every app write to `profiles` goes through the service role** (`raw` / `db.raw` / `createServiceClient()`), never through a user's own login. Checked: `api/clients`, `api/request`, `api/profile`, `api/profile/avatar`, `platform-onboard`, `client-portal-link`, `client-portal-recovery`, `auth-login-resolve`, `staff`, `onesignal-push`, `auth.ts`.
  → Blocking privileged-column changes for anyone *except* the service role should break **no** app feature.
- **Public signup already fixes up the profile on the server.** `platform-onboard.ts:683` calls `signUp` with metadata, then `:710` sets `role: "admin"`, `business_id` and `client_id: null` with the service role.
  → The trigger can safely stop trusting metadata.
- **Server-only invite paths also pass metadata:** staff invites (`staff.ts:130`), admin invite resend (`auth-resend-link.ts:31`), client creation (`api/clients:106`), share viewers. Those run on the server, but the trigger can't tell them apart from a public signup. Each one must be confirmed to write its profile with the service role afterwards, and given that write where it's missing. Already confirmed: `staff.ts:346/409`, `api/clients:128`, `api/request:158`. Still to confirm: `auth-resend-link.ts` admin invite, and platform `createBusinessForPlatform`.

## The fix

### Part A: new migration `migration-v110-profile-privilege-guard.sql`
1. **Guard trigger on `profiles`** (`BEFORE INSERT OR UPDATE`).
   - If the caller is not the service role (or the database owner running SQL in the dashboard), reject any **change** to `role`, `business_id`, `client_id`, `email`, `staff_permissions` or `disabled_at`.
   - On INSERT, non-service callers can only create `role = 'client'` with `business_id`, `client_id` and `staff_permissions` all empty.
   - Name, phone, avatar and notification preferences stay editable by the user.
   - **Error message:** `profiles: privileged columns can only be changed by the server`.
2. **Add `WITH CHECK` to the update policy**, mirroring `USING`, as belt-and-braces.
3. **`handle_new_user()` stops trusting metadata.**
   - Every new auth user starts as `role = 'client'`, `business_id = NULL`.
   - Server code then promotes the user, as it already does for public signup and most invite paths.
   - Never `super_admin` (unchanged).

### Part B: app code, only if needed
- Add a service-role profile write after any invite path that turns out to rely on the trigger (`auth-resend-link.ts`, `createBusinessForPlatform`).
- No other app changes are expected.

### Part C: proof (tests)
- Extend `scripts/tenant-pentest.ts`. Using a throwaway pentest business and user, attempt, through the **REST API with the user's own token**:
  - `update({ role: 'super_admin' })`
  - `update({ role: 'admin', business_id: <other business> })`
  - `signUp` with `{ role: 'admin', business_id: <other business> }`

  All must be **blocked**, and all test data is torn down.
- Add a `tenant-isolation.sql` assertion for the guard.
- Regression run: a real signup creates a business and its owner is admin; a staff invite yields staff; `/request` yields a client; avatar and name edits still work.

## Deploy order (why it matters)
The app already sets roles server-side, so the order is forgiving. Still, the safe sequence is:
1. Deploy any Part B code first (harmless with the old trigger).
2. Run `migration-v110` in the Supabase SQL editor.
3. Run the pentest and the regression list against production immediately.

**Rollback:** `DROP TRIGGER`, then restore the previous `handle_new_user()` (both statements included at the bottom of the migration as comments).

## Before or after: check for past abuse
Run the read-only query from the chat (super_admins, plus admins who aren't a business owner) **before** the fix, and keep the output.
