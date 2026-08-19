-- Swift Portal V39 — per-business email sender policy
-- Idempotent. Swift keeps its existing From address via custom_domain + verified.

UPDATE business_settings
SET
  settings = jsonb_set(
    settings,
    '{email}',
    COALESCE(settings->'email', '{}'::jsonb) || jsonb_build_object(
      'senderMode', 'custom_domain',
      'customDomain', 'swiftaerialmedia.com',
      'domainVerificationStatus', 'verified',
      'resendDomainId', COALESCE(settings->'email'->>'resendDomainId', '')
    )
  ),
  updated_at = now()
WHERE business_id = '00000000-0000-0000-0000-000000000001';
