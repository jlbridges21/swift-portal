-- V92: business owner identity + Studio admin seats for co-admins
--
-- owner_user_id identifies the original business owner so co-admins cannot
-- demote/remove them. Backfill = earliest admin profile per business.
-- Studio plan admin_seats = 3 (counts role=admin only; staff remain unlimited).

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN businesses.owner_user_id IS
  'Original business owner (first admin). Co-admins cannot demote or remove this user.';

-- Backfill: earliest active admin by profiles.created_at (fallback: any admin).
UPDATE businesses b
SET owner_user_id = sub.owner_id
FROM (
  SELECT DISTINCT ON (p.business_id)
    p.business_id,
    p.id AS owner_id
  FROM profiles p
  WHERE p.role = 'admin'
    AND p.business_id IS NOT NULL
  ORDER BY p.business_id, p.created_at ASC NULLS LAST, p.id ASC
) sub
WHERE b.id = sub.business_id
  AND b.owner_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_owner_user_id
  ON businesses (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

-- Studio: 3 admin seats (staff unlimited / uncounted in app).
UPDATE plans
SET limits = COALESCE(limits, '{}'::jsonb) || jsonb_build_object('admin_seats', 3),
    updated_at = NOW()
WHERE key = 'studio';
