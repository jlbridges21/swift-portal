-- Swift Portal V9: Client notification preferences
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS in_app_notifications_enabled BOOLEAN NOT NULL DEFAULT true;
