# Signup paths, early subscription & trial conversion

Two ways to start, a post-demo page, scheduling a plan during a trial, and in-app trial reminders.
Billing still runs on the existing platform Stripe account (`src/lib/stripe-billing.ts`), the
existing Checkout route and the existing billing webhook. Prices come from the `plans` table and
`plan_stripe_prices` — nothing here changes a price. Stripe Connect (businesses charging their own
clients), ACH and the partner-connect webhook are untouched.

## Paths

| Path | Entry | Account created as | Payment |
| --- | --- | --- | --- |
| **Start Free Trial** (unchanged) | `/signup` | `trialing`, `trial_ends_at = now + plans.trial_days` | none until they choose a plan |
| **Subscribe Now** | `/signup?plan=monthly\|annual` (`&source=…`) | `trial_expired` with `trial_ends_at = NULL` — no trial is assigned | Stripe Checkout right after sign-in; charged immediately |
| **Post-demo** | `/get-started` (`?source=demo` optional) | same as Subscribe Now (or trial via the secondary link) | same |
| **Plan during a trial** | `/billing`, trial modal, banner | stays `trialing` until Stripe confirms | card collected now, first charge on the **stored** `trial_ends_at` |

### Signup intent (how the choice survives)

- `src/lib/signup-intent.ts`. `plan` present ⇒ Subscribe Now. `source` is attribution only.
- The signup form sends the choice in the POST body and writes the `sp_signup_intent` cookie
  (`Domain=.<platform root>` in production, 7 days) so it survives Google sign-up
  (`/finish-setup`) and existing-user login.
- Once the business exists the choice lives on the account itself: a Subscribe Now account has no
  trial, so the existing paywall sends every sign-in (email confirmation link, refresh, another
  device, coming back days later) to `/billing`, which is the checkout. The preferred interval is
  kept in `business_billing_journey`.
- A signed-in admin who clicks Subscribe Now (`/signup?plan=…`) is redirected to their own
  `/billing?plan=…` by middleware. A trialing admin who logs in with the intent cookie is sent to
  `/billing` once; the cookie is then cleared.
- Abandoned checkout: nothing is charged, the account stays at `/billing` with both plans. A
  never-trialed account can switch once to the free trial ("Start Free Trial — no credit card
  required", `POST /api/billing/start-trial`, conditional on `trial_ends_at IS NULL`, so a trial can
  never be restarted or extended).

## Early subscription during a trial

`POST /api/billing/checkout` (`trialHandoffMode` in `src/lib/billing-subscriptions.ts`):

- **≥ 48 hours left**: Checkout `mode=subscription` with `subscription_data.trial_end` = the
  stored `trial_ends_at` (to the second). This path existed before; it is unchanged.
- **< 48 hours left** (Stripe Checkout rejects `trial_end` that close): Checkout `mode=setup`
  collects the card, then the webhook / success page creates the subscription with the same
  stored `trial_end` and `default_payment_method` (Stripe idempotency key per session). Before,
  these users were charged immediately and lost the rest of their trial.
- No trial left / Subscribe Now: normal Checkout, charged now.

Stripe reports a scheduled plan as `trialing`, which the existing sync maps to
`subscription_status = 'active'` (full access, no trial paywall while waiting for Stripe).
"Scheduled" in the UI = `active` with `trial_ends_at` still in the future
(`getScheduledPlan`). The interval / amount come from `business_billing_journey`; the billing
page asks Stripe for the exact first charge (discounts included).

### States

| State | businesses | UI |
| --- | --- | --- |
| Trialing without a plan | `trialing`, future `trial_ends_at` | banner "Free Trial — X Days Remaining · Choose a Plan", modals |
| Trialing with a scheduled plan | `active`, future `trial_ends_at` (Stripe `trialing`) | "Your Annual Plan Starts November 15", no modals |
| Awaiting first payment (Subscribe Now) | `trial_expired`, `trial_ends_at` NULL | `/billing` "Complete your subscription" |
| Active paid | `active` | existing UI |
| Payment failed | `past_due` | existing banner + emails; access continues while Stripe retries |
| Canceled | `canceled` | existing paywall |
| Expired trial | `trialing` past end / `trial_expired` | existing paywall with both plans |

### Lifecycle rules added to the billing sync

- **Fresh state**: the webhook re-reads the subscription from Stripe before applying it, so late
  or out-of-order events apply Stripe's current state.
- **Stale subscriptions**: a canceled / incomplete subscription never overwrites a business that
  now tracks a different subscription.
- **Cancel before billing** (Scenario N): a scheduled plan canceled while the original trial is
  still running stores `trialing` (same `trial_ends_at`), so the normal trial expiry applies.
- **Duplicates** (Scenario K/L): checkout returns `409 already_subscribed` when the business has a
  live subscription (tracked id or any live ShootPortal subscription on its Stripe customer);
  creating a new Checkout expires the business's previous open session; if two sessions still
  complete, the newer subscription is canceled and refunded automatically and an ALERT is logged.
- **Success page**: `/billing?checkout=success&session_id=…` verifies the session with Stripe
  (session must belong to the signed-in business) and syncs immediately, so a delayed webhook
  cannot leave a payer on the paywall. Browser-supplied status is never trusted.
- **Failed first payment** (Scenario J): Stripe marks the subscription `past_due`; the existing
  dunning policy applies (banner, `payment_failed` emails, retries). Access ends when Stripe
  cancels after its last retry. **Stripe setting to confirm (live):** Billing → Revenue recovery →
  "If all retries for a payment fail" = **Cancel the subscription**. ("Mark as unpaid" keeps the
  existing `past_due` access indefinitely — that is the pre-existing policy for all subscribers.)

## Trial modals

`decideTrialModal` / `trialModalCopy` in `src/lib/trial-conversion.ts`,
`src/components/admin/trial-conversion-modal.tsx`, state in `trial_modal_events`.

Windows use elapsed time since the trial started (server timestamps; `trial_started_at`, or
`businesses.created_at` for accounts created before this shipped):

| Milestone | Elapsed | Content |
| --- | --- | --- |
| Day 1 | 0 – 24h | Welcome (Start Exploring / View Plans) |
| Day 2 | 1 – 4 days | Finding your groove — choose a plan, not charged until trial ends |
| Day 5 | 4 – 9 days | Lock in your plan |
| Day 10 | 9 – 12 days | "Your Free Trial Ends in N Days." (actual remaining time) |
| Day 13 | 12 days – trial end | "Ends Tomorrow" / "Ends in N Hours" (actual remaining time) |

- Owner admins only; never staff, never during support impersonation.
- Only the current window's milestone can show, so skipped days never replay old modals. Viewing
  a milestone records it server-side (refresh / other devices won't repeat it). One modal per
  browser session. Not shown when trial expired, a plan is scheduled, the account is paid, or
  before migration v107 (no persistent state ⇒ no modal).
- Only on calm pages (`/admin`, `/admin/projects`, `/admin/clients`, `/admin/calendar`,
  `/admin/leads`), 1.5s after load, never over another dialog. Project pages (uploads, delivery),
  media, messages, settings, onboarding and billing are never interrupted.
- Day 2/5/10/13 show Monthly / Annual inside the modal; the primary button goes straight to Stripe.
- Existing lifecycle emails (`trial_ending_7d/3d/1d`, `trial_ended`) are unchanged. They stop
  once a plan is scheduled (status becomes `active`), so scheduled users get no "trial ending" mail.

## Conversion events

`billing_conversion_events` (one row per `dedupe_key`; webhook retries, redirects and refreshes
cannot double-count). No payment details are stored.

| Event | Recorded when | Dedupe |
| --- | --- | --- |
| `signup_path_selected` | self-serve account created (`signup_path`, `interval`, `source`) | business |
| `free_trial_started` | trial path account created, or deferred trial started | business |
| `immediate_checkout_started` | Checkout that charges now (Subscribe Now or expired trial; see `signup_path`) | session |
| `trial_plan_selected` | trial user opened Checkout (`trial_day`, `context`) | session |
| `demo_checkout_started` | Checkout by an account whose source is `demo` / `get_started` | session |
| `immediate_subscription_activated` | never-trialed account's subscription became active | business |
| `trial_subscription_scheduled` | Stripe subscription created as `trialing` | subscription |
| `trial_converted_to_paid` | first paid invoice for an account that had a trial | business |
| `subscription_payment_succeeded` / `_failed` | `invoice.paid` (amount > 0) / `invoice.payment_failed` | invoice |
| `trial_modal_viewed` / `_dismissed` | modal API (`milestone`, `trial_day`) | user + milestone |

Marketing-side choices are the existing first-party `cta_click` events (`data-sp-cta`, e.g.
`get_started:subscribe_annual`, `home:pricing_subscribe_monthly`), and `/get-started` pageviews
are the existing `pageview` events. Summary: `/platform/analytics/conversions`.

## Database (migration v107, additive)

`supabase/migration-v107-signup-paths-trial-conversion.sql` — three service-role-only tables
(`business_billing_journey`, `trial_modal_events`, `billing_conversion_events`). No existing
column, trial date or subscription is modified. Before it runs: signup paths, checkout,
scheduling and billing all work; modals stay off; the plan picker doesn't remember the interval;
no conversion events are stored.

## Deployment

1. Run `supabase/migration-v107-signup-paths-trial-conversion.sql` in the Supabase SQL editor.
2. Deploy the branch as usual (push to `main`).
3. Stripe: no new webhook events are needed — the billing endpoint already receives
   `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`,
   `invoice.payment_failed`. Confirm in live mode: Customer Portal allows cancel + payment-method
   update (test mode does), and Revenue recovery ends in "Cancel the subscription".
4. No new environment variables.

## Rollback

Revert the code. Subscriptions created through any path are ordinary Stripe subscriptions with
the same metadata the old code reads, so they keep syncing. Subscribe Now accounts that never paid
remain paywalled at `/billing` (the old page still offers checkout). The v107 tables can stay or
be dropped (`DROP TABLE billing_conversion_events, trial_modal_events, business_billing_journey;`)
without affecting access or billing.

## Tests

`npx tsx scripts/verify-signup-conversion.ts` (pure rules) and
`npx tsx scripts/verify-signup-conversion.ts --stripe` (Stripe **test mode** with test clocks:
immediate monthly/annual charges, $288 / $29 charged exactly at a scheduled trial end, setup-mode
path, idempotent replays, failed first payment → `past_due`, cancel-before-billing, duplicate
detection, Checkout parameter shapes). Refuses to run with a live key; writes nothing to the DB.
