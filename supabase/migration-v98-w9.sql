-- W-9 templates (platform-wide) and per-business send events.
-- The taxpayer identification number is NOT a column. Sent PDFs are AES-256-GCM
-- ciphertext in w9_send_files and are deleted on download, revoke, or expiry.

CREATE TABLE IF NOT EXISTS w9_form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_label TEXT NOT NULL,
  pdf_base64 TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS w9_form_templates_one_active
  ON w9_form_templates (active)
  WHERE active;

CREATE TABLE IF NOT EXISTS w9_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  sender_user_id UUID NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  downloaded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS w9_sends_business_created
  ON w9_sends (business_id, created_at DESC);

COMMENT ON TABLE w9_sends IS
  'W-9 send events: recipient, sender, expiry, download, revoke. No TIN and no PDF.';

CREATE TABLE IF NOT EXISTS w9_send_files (
  send_id UUID PRIMARY KEY REFERENCES w9_sends(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL
);

COMMENT ON TABLE w9_send_files IS
  'AES-256-GCM ciphertext of a filled W-9. Hard-deleted on first download, revoke, or expiry. Not a TIN column.';

ALTER TABLE w9_form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE w9_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE w9_send_files ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON w9_form_templates FROM PUBLIC, anon, authenticated;
REVOKE ALL ON w9_sends FROM PUBLIC, anon, authenticated;
REVOKE ALL ON w9_send_files FROM PUBLIC, anon, authenticated;
GRANT ALL ON w9_form_templates TO service_role;
GRANT ALL ON w9_sends TO service_role;
GRANT ALL ON w9_send_files TO service_role;
