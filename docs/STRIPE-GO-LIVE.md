# Stripe go-live checklist

Complete **in order** before the first paying ShootPortal customer. Do not mix test and live keys on the Production Vercel project.

## 0. Preconditions

- [ ] Production Vercel env uses **only** `sk_live_…` / `pk_live_…`
- [ ] Preview/Dev use **only** `sk_test_…` / `pk_test_…`
- [ ] Three webhook secrets are distinct and match three Dashboard endpoints (platform payments, Connect, billing)

## 1. Live products and prices

```bash
# With Production STRIPE_SECRET_KEY (sk_live_) in the shell env:
npx tsx scripts/setup-stripe-billing.ts --confirm-live
```

**Verify:** Stripe Dashboard → Products shows ShootPortal plans (not founding). Supabase `plan_stripe_prices` has `mode = 'live'` rows with `stripe_price_id` starting with `price_`.

## 2. Live billing webhook

1. Stripe Dashboard → Developers → Webhooks → Add endpoint  
   URL: `https://<production-host>/api/stripe/webhook/billing`
2. Events: `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed`
3. Copy signing secret → Vercel Production `STRIPE_BILLING_WEBHOOK_SECRET`

**Verify:** Stripe “Send test webhook” → function logs 200; `processed_stripe_events` gains a row. Unsigned request → 400.

## 3. Live platform + Connect webhooks

| Endpoint | Env secret | Events from |
|----------|------------|-------------|
| `/api/stripe/webhook` | `STRIPE_WEBHOOK_SECRET` | Your account (tenant checkout / PaymentIntents) |
| `/api/stripe/webhook/connect` | `STRIPE_CONNECT_WEBHOOK_SECRET` | Connected accounts |

**Verify:** each endpoint’s “Signing secret” matches the Production env; a forged body returns 400.

## 4. Mode-aware price lookup

Checkout uses `getStripeMode()` from `STRIPE_SECRET_KEY` and loads `plan_stripe_prices` for that mode (`src/lib/stripe-billing.ts`).

**Verify in Production logs / SQL:** a Studio checkout session’s `line_items.price` equals the `live` row for that plan — not a `test` price id.

## 5. End-to-end tests (live mode — use a real card you can refund)

| Scenario | How | Success |
|----------|-----|---------|
| Subscribe | New throwaway business → `/billing` → Checkout | `subscription_status=active`; billing webhook processed |
| Failed payment | Stripe test clock / fail next invoice (or Dashboard “Pay” fail) | `past_due`; lifecycle `payment_failed` eligible; admin banner; **access remains** |
| Cancel | Customer Portal cancel at period end | `subscription_cancel_at_period_end`; access until period end; then paywall; clients stay read-only |

Refund any live charges immediately after the test. Hard-delete the throwaway business from `/platform`.

## 6. Do not go live until

- [ ] `docs/PRODUCTION-ENV.md` Production column filled in Vercel
- [ ] Cron `CRON_SECRET` set; both crons listed under Vercel → Settings → Cron Jobs
- [ ] `WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE` reviewed (see OPERATIONS.md)
- [ ] Full new-tenant acceptance path in OPERATIONS.md completed once on Production with test card (or live + refund)
