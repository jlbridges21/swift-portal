-- Swift Portal V14 — Phase 2 data model upgrade
-- Safe incremental migration: adds tables/columns, backfills, indexes, RLS.
-- Does not drop existing data or columns.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_address(addr TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(coalesce(addr, ''), '\s+', ' ', 'g')));
$$;

-- ---------------------------------------------------------------------------
-- 1. Clients — first-class entity fields
-- ---------------------------------------------------------------------------
ALTER TABLE clients ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS referral_source TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

UPDATE clients SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clients_last_activity_at ON clients(last_activity_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 2. Properties
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  address TEXT NOT NULL,
  normalized_address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  property_type TEXT NOT NULL DEFAULT 'Other',
  nickname TEXT,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT properties_type_check CHECK (
    property_type IN (
      'Residential', 'Waterfront', 'Land', 'Commercial', 'Construction Site',
      'Golf Course', 'Resort', 'Marina', 'HOA / Community', 'Roof / Inspection', 'Other'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_client_normalized
  ON properties(client_id, normalized_address)
  WHERE client_id IS NOT NULL AND normalized_address <> '';

CREATE INDEX IF NOT EXISTS idx_properties_client_id ON properties(client_id);
CREATE INDEX IF NOT EXISTS idx_properties_normalized_address ON properties(normalized_address);

DROP TRIGGER IF EXISTS properties_updated_at ON properties;
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Projects → properties
-- ---------------------------------------------------------------------------
ALTER TABLE projects ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_property_id ON projects(property_id);

-- Backfill properties from existing project addresses
INSERT INTO properties (client_id, address, normalized_address, nickname, property_type)
SELECT DISTINCT ON (p.client_id, public.normalize_address(p.property_address))
  p.client_id,
  p.property_address,
  public.normalize_address(p.property_address),
  NULLIF(trim(split_part(p.property_address, ',', 1)), ''),
  'Other'
FROM projects p
WHERE p.property_address IS NOT NULL
  AND trim(p.property_address) <> ''
  AND p.client_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM properties pr
    WHERE pr.client_id = p.client_id
      AND pr.normalized_address = public.normalize_address(p.property_address)
  )
ORDER BY p.client_id, public.normalize_address(p.property_address), p.created_at ASC;

-- Link projects to backfilled properties
UPDATE projects p
SET property_id = pr.id
FROM properties pr
WHERE p.property_id IS NULL
  AND p.client_id IS NOT NULL
  AND pr.client_id = p.client_id
  AND pr.normalized_address = public.normalize_address(p.property_address);

-- ---------------------------------------------------------------------------
-- 4. Media assets — richer asset metadata
-- ---------------------------------------------------------------------------
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS downloadable BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'client';
ALTER TABLE media_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE media_assets SET storage_path = file_path WHERE storage_path IS NULL AND file_path IS NOT NULL;
UPDATE media_assets SET title = file_name WHERE title IS NULL AND file_name IS NOT NULL;

UPDATE media_assets ma
SET
  property_id = p.property_id,
  client_id = p.client_id
FROM projects p
WHERE ma.project_id = p.id
  AND (ma.property_id IS NULL OR ma.client_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_media_assets_property_id ON media_assets(property_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_client_id ON media_assets(client_id);

DROP TRIGGER IF EXISTS media_assets_updated_at ON media_assets;
CREATE TRIGGER media_assets_updated_at BEFORE UPDATE ON media_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Payments / invoices
-- ---------------------------------------------------------------------------
ALTER TABLE payments ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES project_quotes(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_link_url TEXT;

UPDATE payments SET payment_link_url = stripe_payment_link_url
WHERE payment_link_url IS NULL AND stripe_payment_link_url IS NOT NULL;

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'sent';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'expired';

CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON payments(quote_id);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- ---------------------------------------------------------------------------
-- 6. Communications (first-class history)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  comm_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  title TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  provider TEXT NOT NULL DEFAULT 'internal',
  provider_event_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT communications_type_check CHECK (
    comm_type IN ('email', 'in_app', 'push', 'system', 'scheduling', 'proposal', 'revision', 'payment')
  ),
  CONSTRAINT communications_direction_check CHECK (
    direction IN ('outbound', 'inbound', 'system')
  ),
  CONSTRAINT communications_status_check CHECK (
    status IN ('created', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')
  ),
  CONSTRAINT communications_provider_check CHECK (
    provider IN ('resend', 'onesignal', 'internal', 'stripe', 'system')
  )
);

CREATE INDEX IF NOT EXISTS idx_communications_project_created ON communications(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communications_client_id ON communications(client_id);
CREATE INDEX IF NOT EXISTS idx_communications_provider_event ON communications(provider, provider_event_id);

-- Backfill from email_events
INSERT INTO communications (
  project_id, client_id, comm_type, direction, title, message, status, provider, provider_event_id, metadata, created_at
)
SELECT
  ee.project_id,
  p.client_id,
  'email',
  'outbound',
  ee.email_type,
  ee.recipient,
  CASE ee.event_type
    WHEN 'sent' THEN 'sent'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'opened' THEN 'opened'
    WHEN 'clicked' THEN 'clicked'
    WHEN 'bounced' THEN 'bounced'
    ELSE 'created'
  END,
  'resend',
  ee.resend_email_id,
  ee.metadata,
  ee.occurred_at
FROM email_events ee
LEFT JOIN projects p ON p.id = ee.project_id
WHERE NOT EXISTS (
  SELECT 1 FROM communications c
  WHERE c.provider = 'resend'
    AND c.provider_event_id = ee.resend_email_id
    AND c.status = CASE ee.event_type
      WHEN 'sent' THEN 'sent'
      WHEN 'delivered' THEN 'delivered'
      WHEN 'opened' THEN 'opened'
      WHEN 'clicked' THEN 'clicked'
      WHEN 'bounced' THEN 'bounced'
      ELSE 'created'
    END
);

-- ---------------------------------------------------------------------------
-- 7. Activity logs — audit trail fields
-- ---------------------------------------------------------------------------
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'both';

UPDATE activity_logs SET visibility = 'admin'
WHERE activity_type IN (
  'email_sent', 'email_delivered', 'email_opened', 'email_clicked', 'email_bounced', 'email_complained'
);

UPDATE activity_logs al
SET
  client_id = p.client_id,
  property_id = p.property_id
FROM projects p
WHERE al.project_id = p.id
  AND (al.client_id IS NULL OR al.property_id IS NULL);

CREATE INDEX IF NOT EXISTS idx_activity_logs_client_id ON activity_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_property_id ON activity_logs(property_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_created ON activity_logs(project_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 8. Client stats view (computed metrics)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW client_stats AS
WITH client_projects AS (
  SELECT c.id AS client_id, p.id AS project_id, p.status
  FROM clients c
  LEFT JOIN projects p ON p.client_id = c.id
  UNION
  SELECT pc.client_id, p.id, p.status
  FROM project_clients pc
  JOIN projects p ON p.id = pc.project_id
),
paid_totals AS (
  SELECT client_id, COALESCE(SUM(amount), 0)::bigint AS lifetime_revenue
  FROM payments
  WHERE status = 'paid'
  GROUP BY client_id
)
SELECT
  c.id AS client_id,
  COALESCE(pt.lifetime_revenue, 0) AS lifetime_revenue,
  COUNT(DISTINCT cp.project_id) FILTER (
    WHERE cp.status IS NOT NULL AND cp.status::text NOT IN ('delivered')
  ) AS active_project_count,
  COUNT(DISTINCT cp.project_id) FILTER (
    WHERE cp.status::text = 'delivered'
  ) AS delivered_project_count
FROM clients c
LEFT JOIN client_projects cp ON cp.client_id = c.id
LEFT JOIN paid_totals pt ON pt.client_id = c.id
GROUP BY c.id, pt.lifetime_revenue;

-- ---------------------------------------------------------------------------
-- 9. RLS — properties & communications
-- ---------------------------------------------------------------------------
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access properties" ON properties;
CREATE POLICY "Admins full access properties" ON properties
  FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Clients view own properties" ON properties;
CREATE POLICY "Clients view own properties" ON properties
  FOR SELECT USING (
    client_id = get_user_client_id()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.property_id = properties.id AND client_has_project_access(p.id)
    )
  );

DROP POLICY IF EXISTS "Admins full access communications" ON communications;
CREATE POLICY "Admins full access communications" ON communications
  FOR ALL USING (is_admin());

-- Communications are admin-only; clients use filtered activity timeline.

GRANT SELECT ON client_stats TO authenticated;
