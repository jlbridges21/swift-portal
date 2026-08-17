-- Swift Portal V31 — PART 1 of 2 (run this first, alone)
-- Run after migration-v30-tenant-integrity.sql
--
-- PostgreSQL cannot use a new enum value in the same transaction that adds it.
-- Run this entire file in the Supabase SQL Editor, wait for success,
-- THEN run migration-v31b-tenant-helpers.sql in a separate query.
--
-- Adds user_role = 'super_admin'. Does NOT rename 'admin'.
-- 'admin' continues to mean business admin (scoped by business_id).

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';
