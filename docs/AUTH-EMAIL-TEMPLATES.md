# Auth email templates (paste into Supabase Dashboard)

**Do not use `{{ .ConfirmationURL }}`** — that hits `GET /auth/v1/verify` and is consumed by
prefetchers/scanners.

Use `{{ .TokenHash }}` links that open **our** `/auth/confirm` interstitial. The token is only
spent when the user clicks **Continue** (POST → `verifyOtp`).

## What we verified (current Supabase docs)

From [Auth email templates](https://supabase.com/docs/guides/auth/auth-email-templates):

| Variable | Use |
|----------|-----|
| `{{ .TokenHash }}` | Hashed OTP for custom links + `verifyOtp({ token_hash, type })` |
| `{{ .RedirectTo }}` | Value of `redirectTo` / `emailRedirectTo` from the API (we set `{portal}/auth/confirm`) |
| `{{ .SiteURL }}` | Project Site URL (apex). Prefer `RedirectTo` so tenants stay on their own origin. |
| `{{ .ConfirmationURL }}` | **Avoid** — GET verify, scanner-vulnerable |

There is **no** documented `{{ .EmailActionType }}` template variable. Each template hardcodes its
`type` (`email` for signup confirmation, `invite`, `recovery`) as in the official examples.

`verifyOtp` signature: `{ token_hash: string, type: EmailOtpType }` where types include
`email` | `invite` | `recovery` | `signup` | `magiclink` | `email_change`.

generateLink (auth-js `GenerateLinkProperties`, verified against
[@supabase/auth-js GenerateLinkProperties](https://supabase.github.io/auth-js/v2/types/GenerateLinkProperties.html)
and installed `node_modules/@supabase/auth-js`):

| Property | Use |
|----------|-----|
| `properties.hashed_token` | **Required for custom emails** — build `{portal}/auth/confirm?token_hash=…&type=…` |
| `properties.action_link` | **Forbidden in emails** — `GET /auth/v1/verify?token=…` (prefetch-consumable) |

`tenant-lint` rejects `action_link` and `/auth/v1/verify` under `src/`.

App code sets `redirectTo` / `emailRedirectTo` to `{tenantOrigin}/auth/confirm` (see
`authConfirmUrl()`). Templates append `?token_hash=…&type=…`.

Redirect URL allow list must include `https://*.shootportal.app/auth/confirm` (and custom domains
if used).

---

## 1. Confirm sign up

**Subject:** Confirm your ShootPortal email

```html
<h2>Confirm your email address</h2>
<p>Follow the link below, then click Continue to finish signing up for ShootPortal.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email"
    >Confirm email address</a
  >
</p>
<p>If the button does not work, copy and paste this URL into your browser:</p>
<p>{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email</p>
```

---

## 2. Invite user

**Subject:** You've been invited to ShootPortal

```html
<h2>You've been invited</h2>
<p>You've been invited to administer a ShootPortal studio. Open the link, then click Continue to set your password.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite"
    >Accept invitation</a
  >
</p>
<p>If the button does not work, copy and paste this URL into your browser:</p>
<p>{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite</p>
```

---

## 3. Reset password

**Subject:** Reset your ShootPortal password

```html
<h2>Reset your password</h2>
<p>We received a request to reset your password. Open the link, then click Continue to choose a new one.</p>
<p>
  <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery"
    >Reset password</a
  >
</p>
<p>If you did not request this, you can safely ignore this email.</p>
<p>If the button does not work, copy and paste this URL into your browser:</p>
<p>{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery</p>
```

---

## Fallback when RedirectTo is empty (Dashboard-triggered mail)

Dashboard “send recovery” may omit RedirectTo. Use Site URL + type; apex
`AuthFragmentHandler` / `/auth/confirm` still apply:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery"
  >Reset password</a
>
```

Prefer the RedirectTo forms above for app-triggered mail so users land on `{slug}.shootportal.app`.
