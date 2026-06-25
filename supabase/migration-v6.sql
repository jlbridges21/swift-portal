-- Swift Portal V6 — profile avatars
-- Run after migration-v5b.sql

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
