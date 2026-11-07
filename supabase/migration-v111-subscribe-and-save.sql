-- ShootPortal V111 — Subscribe & Save introductory offer.
--
-- Additive only. No business, trial date, price, subscription, referral or commission is changed,
-- and nothing here touches Stripe. Deploying the code before (or without) this migration is safe:
-- eligibility still requires "never paid a ShootPortal invoice" (platform ledger + Stripe), so the
-- offer cannot be claimed twice; this column only adds a durable redemption marker.
--
-- 1. business_billing_journey.intro_offer_* — when the $15 intro offer was redeemed, on which
--    subscription, which terms (e.g. monthly_v1). Written once (conditional on NULL).
-- 2. billing_conversion_events: two new event types.
--      intro_offer_redeemed           a subscription with the intro discount went live
--      scheduled_plan_started_early   a pre-existing plan (scheduled for trial end) was started
--                                     early by the customer's explicit confirmation
--
-- Rollback: ALTER TABLE business_billing_journey DROP COLUMN intro_offer_redeemed_at,
--   DROP COLUMN intro_offer_subscription_id, DROP COLUMN intro_offer_code; and restore the V107
--   event_type CHECK. Subscriptions keep working (the discount lives on Stripe).

ALTER TABLE business_billing_journey
  ADD COLUMN IF NOT EXISTS intro_offer_redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS intro_offer_subscription_id TEXT
    CHECK (intro_offer_subscription_id IS NULL OR char_length(intro_offer_subscription_id) <= 255),
  ADD COLUMN IF NOT EXISTS intro_offer_code TEXT
    CHECK (intro_offer_code IS NULL OR char_length(intro_offer_code) <= 40);

COMMENT ON COLUMN business_billing_journey.intro_offer_redeemed_at IS
  'Subscribe & Save intro offer redeemed (subscription went live with the intro coupon). Never cleared — the offer is once per business.';

ALTER TABLE billing_conversion_events
  DROP CONSTRAINT IF EXISTS billing_conversion_events_event_type_check;

ALTER TABLE billing_conversion_events
  ADD CONSTRAINT billing_conversion_events_event_type_check CHECK (event_type IN (
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
    'subscription_payment_failed',
    'intro_offer_redeemed',
    'scheduled_plan_started_early'
  ));
