-- Swift Portal V42 — repair senderEmail on domains the business does not own.
-- Idempotent. EXCLUDES Swift (00000000-0000-0000-0000-000000000001).
-- Ownership = this row's settings.email.customDomain (normalized, www. stripped).
-- Rows with an empty senderEmail are skipped.

UPDATE business_settings AS s
SET
  settings = jsonb_set(
    COALESCE(s.settings, '{}'::jsonb),
    '{email}',
    COALESCE(s.settings->'email', '{}'::jsonb) || jsonb_build_object(
      'senderMode', 'platform',
      'senderEmail', '',
      'domainVerificationStatus', 'unverified'
    )
  ),
  updated_at = now()
WHERE s.business_id <> '00000000-0000-0000-0000-000000000001'
  AND NULLIF(btrim(s.settings#>>'{email,senderEmail}'), '') IS NOT NULL
  AND regexp_replace(
        lower(btrim(split_part(s.settings#>>'{email,senderEmail}', '@', 2))),
        '^www\.',
        ''
      )
      IS DISTINCT FROM
      regexp_replace(
        lower(btrim(COALESCE(s.settings#>>'{email,customDomain}', ''))),
        '^www\.',
        ''
      );
