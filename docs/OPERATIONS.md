# ShootPortal operations runbook

Written for the operator six months from now. Product code paths only — no feature requests.

## Retention policy (subscription cancel ≠ delete)

| Event | Admin | Clients | Data / media |
|-------|-------|---------|--------------|
| Trial expired / canceled (period ended) | Paywalled → `/billing` | **Read + download** existing projects; mutating APIs blocked | Retained indefinitely |
| `past_due` | Full access + banner | Full access | Retained; lifecycle emails fire |
| Suspend (platform) | Login blocked | Login blocked | Retained |
| Soft-delete (platform) | Login blocked | Login blocked | Retained; **Restore** from business detail |
| Hard-delete (platform) | N/A | N/A | DB rows + auth users removed; `{businessId}/` storage wiped; Stripe customer for **current mode** deleted. Legacy unprefixed storage and other-mode Stripe customers may remain — check hard-delete `orphans` in audit metadata |

Clients keep read access after trial/cancel by design (middleware). Access gates are live-computed from `trial_ends_at` / status — do not depend on cron for paywall.

---

## Onboard a new business

### Self-serve
1. Customer opens `/signup` on the platform host.
2. Creates account → trial from plan `trial_days` → onboarding wizard → `/admin`.
3. No SQL. If invite/email fails, use `/platform` → business → Resend invite.

### Via `/platform`
1. New business → name, slug, plan, admin email.
2. Admin receives invite → password → onboarding if incomplete.
3. Comp or extend trial from business detail if needed.

---

## Comp, trial, plan

- **Comp:** business detail → Complimentary access (permanent = empty end date). Swift is permanently protected.
- **Extend trial:** set `trial_ends_at` (and keep `trialing`) from Subscription card — or grant a short comp.
- **Change plan:** Plans dropdown on business detail; entitlements follow `plans` catalog. Stripe subscription plan changes: Customer Portal / Dashboard until in-app plan-change exists.

---

## Failed payment / cancel / refund

- **Failed payment:** Stripe retries; app sets `past_due`; access continues; lifecycle emails (`payment_failed`, follow-up). Business learns via email + admin banner. End state when Stripe cancels → paywall.
- **Cancel:** Customer Portal or Dashboard. Cancel-at-period-end keeps access until `subscription_current_period_end`.
- **Refund (SaaS):** Stripe Dashboard → payment → Refund. Does not auto-delete the business. For Connect/client refunds, use the connected account Dashboard / payment row tools.

---

## Password reset / invite

- Business detail → admin row → Resend invite / password reset / temp password (platform recovery APIs).
- Customer self-serve: `/login` → Supabase reset email (Resend must be configured).

---

## Suspend / reactivate / soft-delete / restore

- **Suspend / Reactivate:** Access card — flips `status` only; billing unchanged.
- **Soft-delete:** blocks login; data kept. **Restore soft-delete** clears `deleted_at` and sets `active`.
- **Hard-delete:** type `DELETE`; protected businesses (Swift, Test Pilot) blocked.

---

## Email not arriving

1. Resend dashboard → API logs for the recipient.
2. Tenant→client: admin Settings → Email (sender mode / domain verification). From should be business name + platform mailbox or verified custom domain.
3. Platform→business (lifecycle): From must be `ShootPortal <noreply@…>` — check `/platform/lifecycle-emails` and `platform_email_sends`.
4. Env: `RESEND_API_KEY`, `CRON_SECRET` (lifecycle cron), spam folder.
5. Comped / suppressed businesses never get lifecycle mail.

---

## Payments not working

1. Confirm mode: Production `sk_live_` vs Preview `sk_test_`.
2. Webhook secrets match the endpoint URL (billing vs platform vs Connect) — see `docs/STRIPE-GO-LIVE.md`.
3. Connect: business Integrations → Stripe connected + charges enabled.
4. SaaS checkout: `plan_stripe_prices` row for current mode; customer not comped.
5. Logs: `/api/stripe/webhook*` 400 = bad signature; 200 + `processed_stripe_events`.

---

## Crons

`vercel.json` schedules (UTC):

- `14:00` `/api/cron/workflow-reminders` (tenant→client)
- `14:30` `/api/cron/platform-lifecycle` (platform→business)

Auth: set `CRON_SECRET` in Vercel; scheduler sends `Authorization: Bearer <CRON_SECRET>`. Public GETs without it → 401.

**Before enabling workflow-reminders:** run dry-run (below). Unset `WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE` means **zero** reminder sends (safe). After dry-run, set it to a past UTC ISO (e.g. seven days ago) to enable.

```bash
curl -sH "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/workflow-reminders?dryRun=1" | jq .
curl -sH "Authorization: Bearer $CRON_SECRET" \
  "https://<host>/api/cron/platform-lifecycle?dryRun=1" | jq .
```

Idempotency: reminders → `activity_logs.idempotency_key`; lifecycle → `platform_email_sends` unique (business, template_key, event_date).

---

## Restore from backup

1. Supabase: restore project from a PITR / backup snapshot (Dashboard → Database → Backups) to a new project or in-place per Supabase docs.
2. Point `NEXT_PUBLIC_SUPABASE_URL` + keys at the restored project (or wait for in-place restore).
3. Storage: included in Supabase backups for the project; verify buckets `project-media`, `project-documents`, `avatars`.
4. Stripe is source of truth for subscriptions — after DB restore, reconcile `businesses.stripe_*` with Dashboard if clocks diverge.
5. Redeploy Vercel if env changed. Re-check cron + webhooks.

There is no in-app “restore business from backup” button.

---

## Full new-tenant acceptance (no SQL)

1. Sign up fresh business on Production (or Preview with test Stripe).
2. Complete onboarding wizard.
3. Subscribe with test card `4242…` (or live + refund).
4. Public landing → submit request as a “client”.
5. Admin: quote → approve → schedule → deliverables → payment → complete.
6. Confirm client can view/download.
7. Hard-delete the test tenant from `/platform`; confirm audit `orphans` and no leftover `businesses` row.

---

## Manual SQL still required?

| Task | SQL? |
|------|------|
| Create business, plan, trial, onboarding | No |
| Comp / suspend / delete | No (`/platform`) |
| Edit lifecycle email copy | No |
| Seed new plan Stripe prices | Script: `setup-stripe-billing.ts` |
| Apply migrations | Yes — Supabase SQL Editor / CLI (ops, not daily product) |
| Tenant isolation / teardown tests | Yes — `supabase/tests/*.sql` |

If you find yourself editing `businesses` in SQL for a customer, stop and use `/platform` or file a bug.
