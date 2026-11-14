-- V129 — Clients page: portal login facts for every client in one round trip
--
-- WHY
--   The new Clients page shows a Portal Status badge (Active / Invite Sent / Not Invited) on
--   every row. "Active" means the client's linked Supabase Auth login has a confirmed email
--   (same rule as derivePortalAccessState in src/lib/portal-activation.ts). Auth users are not
--   reachable through PostgREST, so without this function the page calls
--   auth.admin.getUserById once per linked client.
--
-- WHAT
--   client_portal_auth_facts(p_business_id) returns, for each client of that business that has
--   a linked login: the login's email_confirmed_at and last_sign_in_at, plus the linked
--   profile's role / business_id (so the app can refuse logins that belong to another business).
--   Read-only. EXECUTE is revoked from PUBLIC / anon / authenticated — only the service role
--   (server code via createTenantServiceClient().raw) can call it, because it reads auth.users.
--
-- The app works without this migration: it falls back to per-client Auth lookups.
--
-- HOW TO RUN: SQL Editor → paste → Run. Re-runnable.
-- Rollback: DROP FUNCTION IF EXISTS client_portal_auth_facts(UUID);

CREATE OR REPLACE FUNCTION client_portal_auth_facts(p_business_id UUID)
RETURNS TABLE (
  client_id UUID,
  user_id UUID,
  email_confirmed_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  profile_role TEXT,
  profile_business_id UUID
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    c.id,
    c.user_id,
    u.email_confirmed_at,
    u.last_sign_in_at,
    p.role::TEXT,
    p.business_id
  FROM public.clients c
  JOIN auth.users u ON u.id = c.user_id
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.business_id = p_business_id
    AND c.user_id IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION client_portal_auth_facts(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION client_portal_auth_facts(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION client_portal_auth_facts(UUID) TO service_role;
