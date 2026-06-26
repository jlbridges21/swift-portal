-- Swift Portal V15 — Phase 3: CRM notes, activity idempotency, enhanced client stats

-- Activity idempotency (prevent duplicate logs for same action)
ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_logs_idempotency
  ON activity_logs(project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_activity_logs_client_idempotency
  ON activity_logs(client_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND client_id IS NOT NULL AND project_id IS NULL;

-- Admin-only client notes
CREATE TABLE IF NOT EXISTS client_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_notes_client ON client_notes(client_id, created_at DESC);

DROP TRIGGER IF EXISTS client_notes_updated_at ON client_notes;
CREATE TRIGGER client_notes_updated_at BEFORE UPDATE ON client_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access client_notes" ON client_notes;
CREATE POLICY "Admins full access client_notes" ON client_notes
  FOR ALL USING (is_admin());

-- Enhanced client stats view (DROP required — new columns cannot be inserted mid-view via REPLACE)
DROP VIEW IF EXISTS client_stats;

CREATE VIEW client_stats AS
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
  SELECT
    client_id,
    COALESCE(SUM(amount), 0)::bigint AS lifetime_revenue,
    MAX(paid_at) AS last_payment_at,
    COUNT(*) FILTER (WHERE status = 'paid') AS paid_payment_count
  FROM payments
  WHERE status = 'paid'
  GROUP BY client_id
),
outstanding AS (
  SELECT
    client_id,
    COALESCE(SUM(amount), 0)::bigint AS outstanding_balance
  FROM payments
  WHERE status IN ('pending', 'sent', 'draft')
  GROUP BY client_id
)
SELECT
  c.id AS client_id,
  COALESCE(pt.lifetime_revenue, 0) AS lifetime_revenue,
  COALESCE(o.outstanding_balance, 0) AS outstanding_balance,
  COUNT(DISTINCT cp.project_id) FILTER (
    WHERE cp.status IS NOT NULL AND cp.status::text NOT IN ('delivered')
  ) AS active_project_count,
  COUNT(DISTINCT cp.project_id) FILTER (
    WHERE cp.status::text = 'delivered'
  ) AS delivered_project_count,
  COUNT(DISTINCT cp.project_id) FILTER (WHERE cp.project_id IS NOT NULL) AS total_project_count,
  CASE
    WHEN COALESCE(pt.paid_payment_count, 0) > 0
    THEN (COALESCE(pt.lifetime_revenue, 0) / pt.paid_payment_count)::bigint
    ELSE 0
  END AS average_project_value,
  pt.last_payment_at
FROM clients c
LEFT JOIN client_projects cp ON cp.client_id = c.id
LEFT JOIN paid_totals pt ON pt.client_id = c.id
LEFT JOIN outstanding o ON o.client_id = c.id
GROUP BY c.id, pt.lifetime_revenue, pt.last_payment_at, pt.paid_payment_count, o.outstanding_balance;

GRANT SELECT ON client_stats TO authenticated;
