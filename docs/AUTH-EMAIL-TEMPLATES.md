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
| `{{ .RedirectTo }}` | Value of `redirectTo` / `emailRedirectTo` from the API (we set the **canonical** `https://www.shootportal.app/auth/confirm`) |
| `{{ .SiteURL }}` | Project Site URL (apex www). Prefer `RedirectTo` for the confirm interstitial. |
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
| `properties.hashed_token` | **Required for custom emails** — build canonical `/auth/confirm?token_hash=…&type=…&return_to=…` |
| `properties.action_link` | **Forbidden in emails** — `GET /auth/v1/verify?token=…` (prefetch-consumable) |

`tenant-lint` rejects `action_link`, `/auth/v1/verify`, and `inviteUserByEmail` under `src/`.
Never call `inviteUserByEmail` — it sends Supabase's default invite email with a GET-consumable
`action_link`. Use `generateLink({ type: "invite" })` + `hashed_token` → `/auth/confirm` + branded email.

App code sets `redirectTo` / `emailRedirectTo` to **`https://www.shootportal.app/auth/confirm`**
(`authConfirmUrl()` / `getCanonicalAuthConfirmUrl()`). Custom branded CTAs add `return_to` for the
tenant origin; after POST verify, v68 handoffs establish the session on that host.

Redirect URL allow list must include:

- `https://www.shootportal.app/auth/confirm` (and `/auth/callback`, `/auth/oauth/start`)
- `https://*.shootportal.app/**` for on-host OAuth on tenant subdomains

**Do not** add each custom domain to the allow-list — handoff covers them.

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

Prefer the RedirectTo forms above for app-triggered mail. RedirectTo is always the canonical
www confirm URL; after Continue, the session handoff returns the user to their studio portal.
