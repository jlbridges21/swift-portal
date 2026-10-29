-- ShootPortal V107 — two signup paths, early subscription during trial, trial conversion modals,
-- conversion event tracking.
--
-- Additive only. No existing column, row, trial date, price, or subscription is changed.
-- The app runs without this migration: every read falls back to "no data" (no modals shown,
-- plan picker without a remembered interval) and every write is best-effort.
--
-- Platform-level tables (service role only — RLS on with NO policies, privileges revoked from
-- anon/authenticated, same pattern as V103):
--   business_billing_journey   one row per business: chosen signup path, preferred interval,
--                              attribution source, last checkout session, scheduled plan snapshot
--   trial_modal_events         one row per (business, user, milestone): viewed / dismissed / CTA
--   billing_conversion_events  append-only conversion events, deduped by dedupe_key
--
-- Rollback: these tables can be dropped at any time without affecting billing or access.
-- Subscription state of record stays on businesses (+ Stripe).

CREATE TABLE IF NOT EXISTS business_billing_journey (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  signup_path TEXT CHECK (signup_path IN ('trial', 'subscribe')),
  preferred_interval TEXT CHECK (preferred_interval IN ('monthly', 'annual')),
  signup_source TEXT CHECK (char_length(signup_source) <= 40),
  -- When the trial actually began (signup, or a "start free trial instead" fallback).
  trial_started_at TIMESTAMPTZ,
  last_checkout_session_id TEXT CHECK (char_length(last_checkout_session_id) <= 255),
  last_checkout_at TIMESTAMPTZ,
  -- Snapshot of the Stripe subscription the billing webhook last synced (display only;
  -- access is still decided from businesses.subscription_status).
  stripe_subscription_status TEXT CHECK (char_length(stripe_subscription_status) <= 40),
  subscription_interval TEXT CHECK (subscription_interval IN ('monthly', 'annual')),
  subscription_amount_cents INTEGER,
  scheduled_first_payment_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trial_modal_events (
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  milestone TEXT NOT NULL CHECK (milestone IN ('day1', 'day2', 'day5', 'day10', 'day13')),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  cta_at TIMESTAMPTZ,
  PRIMARY KEY (business_id, user_id, milestone)
);

CREATE TABLE IF NOT EXISTS billing_conversion_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'signup_path_selected',
    'free_trial_started',
    'immediate_checkout_started',
    'immediate_subscription_activated',
    'demo_checkout_started',
    'trial_modal_viewed',
    'trial_modal_dismissed',
    'trial_plan_selected',
    'trial_subscription_scheduled',
    'trial_converted_to_paid',
    'subscription_payment_succeeded',
    'subscription_payment_failed'
  )),
  dedupe_key TEXT NOT NULL CHECK (char_length(dedupe_key) <= 200),
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_mode TEXT CHECK (stripe_mode IN ('test', 'live')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_conversion_events_dedupe_unique UNIQUE (dedupe_key)
);

CREATE INDEX IF NOT EXISTS billing_conversion_events_occurred_idx
  ON billing_conversion_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS billing_conversion_events_business_idx
  ON billing_conversion_events (business_id, occurred_at DESC);

ALTER TABLE business_billing_journey ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_modal_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_conversion_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON business_billing_journey FROM anon, authenticated;
REVOKE ALL ON trial_modal_events FROM anon, authenticated;
REVOKE ALL ON billing_conversion_events FROM anon, authenticated;

COMMENT ON TABLE business_billing_journey IS 'Signup path + scheduled plan snapshot per business (service role only). See docs/SIGNUP-CONVERSION.md.';
COMMENT ON TABLE trial_modal_events IS 'Trial conversion modal view/dismiss state per admin user (service role only).';
COMMENT ON TABLE billing_conversion_events IS 'Signup / trial / subscription conversion events, deduped by dedupe_key (service role only).';
