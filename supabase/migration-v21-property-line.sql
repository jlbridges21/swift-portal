-- Editable property line annotations (coordinates stored separately from rendered preview)
ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS property_line_base_media_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS property_line_data JSONB;

CREATE INDEX IF NOT EXISTS idx_media_assets_property_line_base
  ON media_assets (property_line_base_media_id)
  WHERE property_line_base_media_id IS NOT NULL;
