-- V114 — Default documents for new projects (Settings → New Project Setup)
-- A business uploads standard documents (client agreement, checklist, …) once.
-- On project creation the app copies each file into that project's Documents
-- section as an ordinary media_assets row with its OWN storage object, so
-- editing or deleting a project copy never touches other projects or the default.
-- Changing defaults only affects projects created afterwards.
-- Files live in the existing project-documents bucket under
-- {business_id}/default-documents/… (same tenant-prefixed path rules as v36).

CREATE TABLE IF NOT EXISTS default_project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_default_project_documents_business
  ON default_project_documents (business_id, display_order);

DROP TRIGGER IF EXISTS default_project_documents_updated_at ON default_project_documents;
CREATE TRIGGER default_project_documents_updated_at
  BEFORE UPDATE ON default_project_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Admin-only. Clients never read defaults; they see their project's own copies.
ALTER TABLE default_project_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins full access default_project_documents" ON default_project_documents;
CREATE POLICY "Admins full access default_project_documents" ON default_project_documents
  FOR ALL
  USING (is_super_admin() OR (is_admin() AND business_id = current_business_id()))
  WITH CHECK (is_super_admin() OR (is_admin() AND business_id = current_business_id()));

-- Allow Word documents in the documents bucket (additive; PDF/ZIP unchanged).
UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    allowed_mime_types || ARRAY[
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  ) AS t
)
WHERE id = 'project-documents' AND allowed_mime_types IS NOT NULL;
