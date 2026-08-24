# ShootPortal — Pre-Launch Checklist

Everything required before the first paying photography business is onboarded.
Nothing below is code. It is configuration, verification, and one legal dependency.

---

## Blocking — do not onboard a paying customer until these are done

### 1. Legal review
`/privacy` and `/terms` are **unreviewed drafts** and are marked as such in source.

ShootPortal stores third parties' client PII and media, and touches payment flows through Stripe
Connect. That makes you a data processor with real obligations. A lawyer needs to review both
before a customer agrees to them. The generated drafts are a structure to hand them, not a
substitute.

- [ ] Privacy Policy reviewed by counsel
- [ ] Terms of Service reviewed by counsel
- [ ] Remove the unreviewed-draft markers once reviewed

### 2. Live Stripe billing webhook
Live prices exist, but without the webhook a real subscription completes in Stripe while your
database never learns about it — you take money and do not activate the account.

- [ ] Stripe **Live mode** → Webhooks → add `https://www.shootportal.app/api/stripe/webhook/billing`
- [ ] Events from **Your account**: `customer.subscription.created/updated/deleted`,
      `invoice.paid`, `invoice.payment_failed`, `checkout.session.completed`
- [ ] Signing secret → Vercel `STRIPE_BILLING_WEBHOOK_SECRET`, **Production** scope
- [ ] Redeploy production
- [ ] Send a test webhook, confirm `200`

Follow `docs/STRIPE-GO-LIVE.md` for the full sequence.

### 3. Decide on the reminder backlog
`WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE` is unset, so tenant→client reminders send nothing. The dry
run found three real Swift projects that become due within ~25 hours of enabling it, emailing
actual clients.

- [ ] Decide whether those clients should receive a reminder
- [ ] Set the anchor to a deliberate past date, or leave unset and accept that reminders stay off

### 4. Clean up test tenants
`baxter`, `Acton`, and `testing` are sitting in the live business list alongside Swift and Test
Pilot, skewing platform metrics.

- [ ] Delete unused test tenants from `/platform`
- [ ] Confirm no orphan rows, storage objects, or auth users remain

---

## Partner Program — verify before any partner joins

### The gap that matters

Phases 3, 4, and 5 built the commission ledger, dashboards, and payouts. Every verification ran
against synthetic data that the smoke tests then deleted — `verify-partner-commissions` has
repeatedly reported **0 ledger rows**. The logic is proven; the wiring to real Stripe events is not.

The least-proven code is the refund path. `charge.invoice` is often absent in the current Stripe
API, so reversal uses a four-hop lookup through `stripe.invoicePayments.list()`. That can only be
validated by an actual refund. If it silently fails, refunds never reverse and partners get
overpaid.

### The end-to-end test (Stripe TEST mode)

- [ ] Add `charge.refunded` and `invoice.voided` to the billing webhook endpoint — **test and live**
- [ ] Create a partner; use their real referral link to sign up a new business
- [ ] Subscribe it — confirm one commission at the right rate with `payable_at` 30 days out
- [ ] Replay `invoice.paid` from the Stripe dashboard — confirm **no** second commission
- [ ] Issue a full refund — confirm a negative row appears (validates the four-hop lookup)
- [ ] Issue a partial refund on a second payment — confirm proportional reversal
- [ ] Compare the partner dashboard, `/platform/partners/[id]`, and `verify-partner-commissions` —
      all three must agree exactly
- [ ] Record a payout; confirm all three still agree
- [ ] Re-run `verify-partner-commissions` with real rows and paste the output

### Security checks not yet run

- [ ] **Cross-partner IDOR** — as partner A, call `/api/partner/referrals` and
      `/api/partner/commissions` with B's `partner_id` in the body and query string. Must be denied.
- [ ] Confirm a partner cannot reach a referred business's clients, projects, media, or messages
- [ ] Confirm a business admin and a client get 404 on `/partner` while authenticated

### Phase 6 browser checks

- [ ] Submit the application form on `/partners`; confirm it lands in `/platform/partners`
- [ ] Confirm the form is rejected on a tenant host
- [ ] Visit a partner landing slug on the apex, then on `test-pilot-drones.shootportal.app` and
      `portal.swiftaerialmedia.com` — must only resolve on the apex
- [ ] Deactivate a landing page; confirm 404 and no referral cookie
- [ ] Lighthouse on `/partners` against a production build

---

## Verification backlog

Cursor could not run these — they need a browser, a real inbox, or live hosts.

- [ ] **Invite flow end to end** — create a business via `/platform`, accept the invite, set a
      password, sign out, sign back in
- [ ] **Client invite link** — add a client with no portal account; GET the confirm URL twice,
      then click Continue. It must still work (proves prefetch cannot consume it)
- [ ] **Preliminary estimate email** — create a project, confirm the subject is the new wording,
      not "deliverables"
- [ ] **Email logo** — send a test email from a business with an uploaded logo; confirm the image
      renders in Gmail and one other client
- [ ] **Setup banner** — accept default logo and colors, confirm the banner clears permanently
      across sign-out and a different browser
- [ ] **Read receipts** — send as admin, read as client, confirm the admin view updates
- [ ] **Thumbnail caching** — scroll a photo grid down and back; confirm cache hits, not refetches
- [ ] **Lighthouse on production** (dev scored Performance 69, which is not meaningful)
- [ ] **Custom domain end to end** on a domain you control, including a password reset on it
- [ ] `tenant-isolation.sql` full run with the `@example.test` auth users, then teardown

---

## Operational gaps to know about

**Custom domains require a manual step.** When a tenant connects one, you must add
`https://{their-domain}/auth/confirm` to Supabase's redirect allowlist, or their clients cannot
confirm email. The wildcard does not cover it. `/platform` should show a pending indicator — verify
it does.

**Auth email templates are a shared dependency.** Five code paths are safe only because the
Supabase Dashboard templates use `{{ .TokenHash }}`. If anyone reverts one to
`{{ .ConfirmationURL }}`, they all regress at once with no code change. `docs/AUTH-EMAIL-TEMPLATES.md`
is the guard.

**Stripe prices are immutable.** Editing a plan price creates a new Stripe Price; existing
subscribers stay on the old one. Expected behavior, but know it before changing prices.

---

## Before every merge to `main`

```
npm run typecheck && npm run lint && npm run build && npm run tenant-lint
```

Then, after any migration:

- `supabase/tests/tenant-sql-audit.sql`
- `supabase/tests/tenant-isolation.sql` + `tenant-teardown.sql`

---

## Deferred by choice

Not blocking launch. Revisit once real customers tell you what they need.

- Configurable automations tied to project stages
- Custom pipeline stages per business
- Platform subscription billing beyond the current flow (proration, plan-change UX)
- Per-tenant PWA manifests and OG images
- Consolidating `client_messages` and `project_messages`

---

## Where the documentation lives

| Doc | Covers |
|---|---|
| `OPERATIONS.md` | Day-to-day: onboarding, comping, refunds, password resets, suspensions |
| `STRIPE-GO-LIVE.md` | Live billing activation sequence |
| `PRODUCTION-ENV.md` | Every environment variable and where it belongs |
| `TENANT-ARCHITECTURE.md` | The tenancy model and the rules for new tables |
| `TENANT-DOMAINS.md` | Host resolution and custom domain setup |
| `TENANT-PENTEST.md` | Cross-tenant attack matrix and results |
| `AUTH-EMAIL-TEMPLATES.md` | The Supabase templates the auth flow depends on |
