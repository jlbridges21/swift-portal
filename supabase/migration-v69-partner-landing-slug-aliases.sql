-- ShootPortal V69 — Partner landing slug aliases (preserve attribution on rename)
--
-- When a landing slug changes, the old slug is kept here so existing shared links
-- still set the referral cookie. Platform-scoped (no business_id).

CREATE TABLE IF NOT EXISTS partner_landing_slug_aliases (
  slug TEXT PRIMARY KEY,
  landing_id UUID NOT NULL REFERENCES partner_landing_pages (id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE partner_landing_slug_aliases IS
  'PLATFORM-SCOPED: Former partner landing slugs kept alive after rename so posted links keep working.';

CREATE INDEX IF NOT EXISTS idx_partner_landing_slug_aliases_landing
  ON partner_landing_slug_aliases (landing_id);

CREATE INDEX IF NOT EXISTS idx_partner_landing_slug_aliases_partner
  ON partner_landing_slug_aliases (partner_id);

ALTER TABLE partner_landing_slug_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage partner landing slug aliases" ON partner_landing_slug_aliases;
CREATE POLICY "Super admins manage partner landing slug aliases"
  ON partner_landing_slug_aliases
  FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON partner_landing_slug_aliases TO service_role;
