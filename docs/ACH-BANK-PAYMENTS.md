# Bank (ACH) payments and the optional card fee

Clients can pay a payment request by card or from their US bank account (Stripe ACH Direct
Debit). Bank payments are charged on the business's own Stripe account, like cards, and paid
out to the same bank account. Stripe charges 0.8% (max $5) per bank payment; the business
pays it.

## How a bank payment flows

1. The client picks **Bank account** on the project's Payments section and connects their bank
   through Stripe (instant bank login; microdeposits as a fallback).
2. Stripe starts the debit. ShootPortal marks the payment **Processing**, moves the project to
   Delivered (when Payment Automation's "move to Delivered on payment" is on) so downloads
   unlock, and tells both sides.
3. A few business days later Stripe confirms the funds. The payment becomes **Paid**, receipts
   go out, and the business is notified.
4. If the bank rejects the debit, the project stays delivered (business choice), the payment
   goes back to **due** so the client can pay again, and both sides are notified.

Processing payments count toward the quote balance and block a second checkout for the same
payment. Webhooks drive the states; reconcile (project page load and the daily
`/api/cron/payment-reconciliation` job) repairs any missed webhook.

## Card processing fee (optional)

Settings → Payments → "Clients pay the card processing fee" (off by default). Card checkouts
then add a "Card processing fee" line: Stripe's 2.9% + 30¢ grossed up, capped at 3% of the
amount. Bank payments never carry it. With the fee on, emailed Stripe payment links are
card-only with the fee line; clients choose bank payment from their project page. Card
networks don't allow surcharges on debit cards and some states restrict them; each business
decides whether to turn it on.

## Go-live checklist

1. **Run the migration** `supabase/migration-v106-ach-bank-payments.sql` in the Supabase SQL
   editor (additive, safe to run before deploying). Until it runs, card payments work as before
   and bank payments stay hidden.
2. **Subscribe the webhooks to the new events** in the Stripe Dashboard (test and live):
   - Connect endpoint `/api/stripe/webhook/connect`: add `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `payment_intent.processing`, and `account.updated`
     (keeps each business's ACH status current).
   - Platform endpoint `/api/stripe/webhook`: add `checkout.session.async_payment_succeeded`,
     `checkout.session.async_payment_failed`, `payment_intent.processing`.
3. **Deploy.**
4. **Each business turns on ACH Direct Debit** in its own Stripe Dashboard (Settings → Payments
   in ShootPortal links there), then clicks **Check again**. The Bank account option then
   appears for its clients.

## Testing in Stripe test mode

On a test project with a payment due, choose Bank account and use Stripe's test bank:
"Test (Non-OAuth)" → **Success** account clears; the **Insufficient funds** test account
fails after processing. For manually entered details use routing `110000000` with account
`000123456789` (succeeds) or `000222222227` (fails), verified with microdeposit amounts 32
and 45. `npm run test:ach-payments` covers the fee math, statuses, balances, and Stripe
helpers.
