-- Soft delete for CRM records (hide from admin dashboard without hard delete)

ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE properties ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE client_notes ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON clients (deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects (deleted_at);

-- Clients cannot see soft-deleted projects
DROP POLICY IF EXISTS "Clients view own projects" ON projects;
CREATE POLICY "Clients view own projects" ON projects
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      client_id = get_user_client_id()
      OR client_has_project_access(id)
    )
  );

-- Exclude deleted records from client stats
DROP VIEW IF EXISTS client_stats;

CREATE VIEW client_stats AS
WITH client_projects AS (
  SELECT c.id AS client_id, p.id AS project_id, p.status
  FROM clients c
  LEFT JOIN projects p ON p.client_id = c.id AND p.deleted_at IS NULL
  WHERE c.deleted_at IS NULL
  UNION
  SELECT pc.client_id, p.id, p.status
  FROM project_clients pc
  JOIN projects p ON p.id = pc.project_id AND p.deleted_at IS NULL
  JOIN clients c ON c.id = pc.client_id AND c.deleted_at IS NULL
),
paid_totals AS (
  SELECT
    pay.client_id,
    COALESCE(SUM(pay.amount), 0)::bigint AS lifetime_revenue,
    MAX(pay.paid_at) AS last_payment_at,
    COUNT(*) FILTER (WHERE pay.status = 'paid') AS paid_payment_count
  FROM payments pay
  JOIN projects pr ON pr.id = pay.project_id AND pr.deleted_at IS NULL
  JOIN clients c ON c.id = pay.client_id AND c.deleted_at IS NULL
  WHERE pay.status = 'paid'
  GROUP BY pay.client_id
),
outstanding AS (
  SELECT
    pay.client_id,
    COALESCE(SUM(pay.amount), 0)::bigint AS outstanding_balance
  FROM payments pay
  JOIN projects pr ON pr.id = pay.project_id AND pr.deleted_at IS NULL
  JOIN clients c ON c.id = pay.client_id AND c.deleted_at IS NULL
  WHERE pay.status IN ('pending', 'sent', 'draft')
  GROUP BY pay.client_id
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
WHERE c.deleted_at IS NULL
GROUP BY c.id, pt.lifetime_revenue, pt.last_payment_at, pt.paid_payment_count, o.outstanding_balance;

GRANT SELECT ON client_stats TO authenticated;
