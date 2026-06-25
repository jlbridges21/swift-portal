-- Swift Portal V8: OneSignal admin push notification preferences
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onesignal_subscription_id TEXT;
