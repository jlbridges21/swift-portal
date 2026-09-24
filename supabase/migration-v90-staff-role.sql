-- Swift Portal V90 — PART 1 of 2 (run this first, alone)
-- Adds user_role = 'staff'. Does NOT rename 'admin'.
-- PostgreSQL cannot use a new enum value in the same transaction that adds it.
-- Wait for success, THEN run migration-v90b-staff-accounts.sql.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';
