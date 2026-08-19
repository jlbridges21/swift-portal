-- Swift Portal V38 — DB-driven branding (generic platform defaults + Swift seed)
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Public business-logos bucket (business-scoped writes, public reads)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'business-logos',
  'business-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Business logos select" ON storage.objects;
CREATE POLICY "Business logos select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'business-logos');

DROP POLICY IF EXISTS "Business logos insert" ON storage.objects;
CREATE POLICY "Business logos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'business-logos'
    AND (is_super_admin() OR is_admin())
    AND current_business_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_business_id()::text
  );

DROP POLICY IF EXISTS "Business logos update" ON storage.objects;
CREATE POLICY "Business logos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND (is_super_admin() OR is_admin())
    AND current_business_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_business_id()::text
  )
  WITH CHECK (
    bucket_id = 'business-logos'
    AND (is_super_admin() OR is_admin())
    AND current_business_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_business_id()::text
  );

DROP POLICY IF EXISTS "Business logos delete" ON storage.objects;
CREATE POLICY "Business logos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'business-logos'
    AND (is_super_admin() OR is_admin())
    AND current_business_id() IS NOT NULL
    AND (storage.foldername(name))[1] = current_business_id()::text
  );

-- ---------------------------------------------------------------------------
-- 2. Seed Swift (…0001) with identity fields that used to live in code.
--    Existing business/email keys win. New keys fill from the seed object.
-- ---------------------------------------------------------------------------
UPDATE business_settings
SET
  settings = jsonb_set(
    jsonb_set(
      jsonb_set(
        settings,
        '{business}',
        '{
          "supportEmail": "jackson@swiftaerialmedia.com",
          "addressLine1": "",
          "addressLine2": "",
          "city": "",
          "state": "",
          "postalCode": "",
          "country": "US",
          "legalName": "Swift Aerial Media",
          "tagline": "Request. Estimate. Track. Download.",
          "faviconUrl": "/icons/icon-192.png",
          "emailLogoUrl": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a42cba90c7afddf1484c118.png",
          "termsUrl": "https://swiftaerialmedia.com",
          "privacyUrl": "https://swiftaerialmedia.com"
        }'::jsonb || COALESCE(settings->'business', '{}'::jsonb)
      ),
      '{landing}',
      CASE
        WHEN settings->'landing' IS NULL OR settings->'landing' = '{}'::jsonb THEN
          '{
            "heroVideoId": "OdLRhe5nNmw",
            "logoNavy": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a358e501c5d711b3592f718.png",
            "logoWhite": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a358e50f2131051b8eefbec.png",
            "logoStackedWhite": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a42cba90c7afddf1484c118.png",
            "logoHeader": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a42b49721adde19f4c00193.png",
            "logoFooter": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a42ade13a7f0c54688aaa09.png",
            "favicon": "/icons/icon-192.png",
            "ownerHeadshot": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3496ab04386d4d76546ec3.png",
            "luxuryHome": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a359649f2131051b8f0b999.png",
            "golfCourse": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a342547162c3e3e340a341c.png",
            "construction": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a371512f2131051b819002b.jpg",
            "screenshots": {
              "request": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d9b856507a7960180b2b7.png",
              "dashboard": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d975a4ac4f65406c4e8d9.png",
              "quote": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d93076507a796017fa2e2.png",
              "microsite": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d975a4ac4f65406c4e8d9.png",
              "review": "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a3d9d8cd4f4031f97bddccf.png"
            }
          }'::jsonb
        ELSE COALESCE(settings->'landing', '{}'::jsonb)
      END
    ),
    '{integrations}',
    '{
      "ghlWebhookUrl": "",
      "ghlLeadSource": "Swift Portal"
    }'::jsonb || COALESCE(settings->'integrations', '{}'::jsonb)
  ),
  updated_at = now()
WHERE business_id = '00000000-0000-0000-0000-000000000001';

-- ---------------------------------------------------------------------------
-- 3. Test Pilot Drones — identity from businesses.name so {} no longer
--    fills Swift defaults after code defaults become generic.
-- ---------------------------------------------------------------------------
INSERT INTO business_settings (business_id, settings, updated_at)
SELECT '00000000-0000-0000-0000-0000000000aa', '{}'::jsonb, now()
WHERE NOT EXISTS (
  SELECT 1 FROM business_settings
  WHERE business_id = '00000000-0000-0000-0000-0000000000aa'
);

UPDATE business_settings bs
SET
  settings = jsonb_set(
    COALESCE(bs.settings, '{}'::jsonb),
    '{business}',
    jsonb_build_object(
      'businessName', b.name,
      'portalName', b.name,
      'legalName', b.name,
      'adminDisplayName', 'Admin'
    ) || COALESCE(bs.settings->'business', '{}'::jsonb)
  ),
  updated_at = now()
FROM businesses b
WHERE bs.business_id = b.id
  AND bs.business_id = '00000000-0000-0000-0000-0000000000aa';
