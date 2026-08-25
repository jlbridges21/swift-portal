-- ShootPortal V68 — cross-origin auth session handoff
-- Single-use tokens (hashed at rest) to move a Supabase session between hosts.
-- Idempotent.

CREATE TABLE IF NOT EXISTS auth_session_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destination_host TEXT NOT NULL,
  destination_path TEXT NOT NULL DEFAULT '/',
  -- Encrypted refresh_token blob (aes-256-gcm); never store plaintext.
  session_ciphertext TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_session_handoffs_expires
  ON auth_session_handoffs (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE auth_session_handoffs ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated/anon — service_role only.
REVOKE ALL ON auth_session_handoffs FROM PUBLIC, anon, authenticated;
GRANT ALL ON auth_session_handoffs TO service_role;
