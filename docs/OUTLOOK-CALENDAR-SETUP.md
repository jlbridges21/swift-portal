# Outlook Calendar — setup

Outlook / Microsoft 365 calendar support sits beside Google Calendar. Google Calendar code, tables
and routes are unchanged. A business can connect Google, Outlook, or both. Each one works on its own.

## What it does

- **Connect** (owner only): Settings → Integrations → **Outlook Calendar** → Connect. Works with
  personal accounts (Outlook.com, Hotmail, Live) and work or school accounts (Microsoft 365).
- **Shoots → Outlook**: proposed and confirmed shoots are created in the Outlook calendar the owner
  picks, then updated when they change and removed when they're cancelled or declined. This uses
  the same title, description, location and invite rules as the Google event (Settings → Instant
  Booking → calendar event).
- **Busy times → Instant Booking**: busy times on the Outlook calendars the owner checks under
  "Block my availability with" hide those times from Instant Booking. They block the owner, the
  same person the business-level Google "block" calendars apply to. If a checked calendar can't
  be read, the owner isn't offered for booking until it can be (fail closed, same as Google).
- **Upkeep**: a daily cron (`/api/cron/outlook-calendar`, 16:20 UTC) refreshes the Microsoft token
  (Microsoft refresh tokens lapse after about 90 days unused) and retries failed syncs. Failed
  syncs are also retried when the owner opens the Shoot Calendar.

Not in this version (Google has these): team members connecting their own Outlook calendars, and
showing Outlook events on the Shoot Calendar page.

## One-time setup

### 1. Register the app in Microsoft Entra (about 10 minutes)

1. Go to <https://entra.microsoft.com> and sign in.
   - If you have a Microsoft 365 business account, use it.
   - Otherwise create a free Azure account at <https://azure.microsoft.com/free>. App registrations
     are free. That creates the directory the app lives in.
2. Go to **Identity → Applications → App registrations → New registration**.
   - **Name:** `ShootPortal`. Users see this name on the Microsoft consent screen.
   - **Supported account types:** *Accounts in any organizational directory (Any Microsoft Entra
     ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)*.
   - **Redirect URI:** platform **Web**, value exactly:
     `https://www.shootportal.app/api/integrations/outlook-calendar/callback`
   - Click **Register**.
3. On the app's **Overview** page, copy **Application (client) ID**. This is
   `MICROSOFT_CALENDAR_CLIENT_ID`.
4. Go to **Certificates & secrets → Client secrets → New client secret**.
   - Description `ShootPortal production`, expires in **24 months**.
   - Click **Add**, then copy the **Value** column right away. It's shown only once. Don't copy
     the "Secret ID". The Value is `MICROSOFT_CALENDAR_CLIENT_SECRET`.
   - Add a reminder to make a new secret before it expires. When it expires, every Outlook
     connection stops syncing until the new secret is in Vercel.
5. Go to **API permissions → Add a permission → Microsoft Graph → Delegated permissions** and tick:
   `offline_access`, `openid`, `email`, `User.Read`, `Calendars.ReadWrite`. Click **Add
   permissions**. `User.Read` is usually already there. Don't add any *Application* permissions.
6. Go to **Branding & properties**.
   - **Home page URL:** `https://www.shootportal.app`
   - **Terms of service URL** and **Privacy statement URL:** your site's pages.
   - Upload the ShootPortal logo. Users see it on the consent screen.
7. Recommended: **Publisher verification** (same page). Many Microsoft 365 organizations block
   users from approving apps from unverified publishers. Verification needs a Microsoft AI Cloud
   Partner Program ID, which is free to join, and takes a few days. Until then:
   - Personal accounts can connect normally.
   - Some work accounts will see "Need admin approval". The card explains this, and their IT admin
     can approve ShootPortal for their organization.

### 2. Add the keys to Vercel

Go to Vercel → the ShootPortal project → **Settings → Environment Variables**:

| Name | Value | Environments |
|---|---|---|
| `MICROSOFT_CALENDAR_CLIENT_ID` | Application (client) ID from step 1.3 | Production (and Preview if you like) |
| `MICROSOFT_CALENDAR_CLIENT_SECRET` | Secret **Value** from step 1.4 (mark *Sensitive*) | Production (and Preview if you like) |

Already set, nothing to do: `PLATFORM_SESSION_SECRET` encrypts the stored Microsoft tokens, and
`CRON_SECRET` authorizes the daily cron.

Optional, normally not needed: `MICROSOFT_CALENDAR_TENANT` (default `common`) and
`MICROSOFT_CALENDAR_REDIRECT_URI` (overrides the redirect, e.g. for local testing).

Environment variables only apply to new deployments. Add them **before** merging, or click
Redeploy afterwards.

### 3. Run the database migration

In the Supabase SQL Editor, paste and run `supabase/migration-v137-outlook-calendar.sql`. It only
adds two new tables and can be run again safely. The app works in either order: until it's
applied, the Outlook card says "apply migration v137" and every Outlook step is skipped.

### 4. Try it

1. Sign in as the business owner, open **Settings → Integrations → Outlook Calendar**, and click
   **Connect Outlook Calendar**.
2. Sign in to Microsoft and approve. You come back to Settings with "Outlook Calendar connected".
3. Pick **Add shoots to** and check the calendars under **Block my availability with**. Click Save.
4. On a test project, propose or confirm a shoot time. It appears in Outlook within a few seconds.
   Decline or cancel it, and it disappears.
5. Add a busy event to a checked Outlook calendar. That time no longer shows in Instant Booking.

Connecting only works on production (`www.shootportal.app` is the registered callback), the same
as Google Calendar.

## Disconnecting

**Disconnect** in the card removes the connection and ShootPortal's links to Outlook events. Events
already on the Outlook calendar stay there. Microsoft has no revoke call for this sign-in flow. To
remove ShootPortal's access completely:

- Work or school account: remove it at <https://myapps.microsoft.com>.
- Personal account: remove it at <https://account.live.com/consent/Manage>.

## Code map

- `src/lib/outlook-calendar.ts`: OAuth, tokens, Graph calls, shoot sync, busy times, daily upkeep
- `src/app/api/integrations/outlook-calendar/{route,start/route,callback/route}.ts`
- `src/app/api/cron/outlook-calendar/route.ts` and its `vercel.json` entry
- `src/components/admin/outlook-calendar-settings-card.tsx` (Settings → Integrations)
- Hooks: an Outlook sync runs next to each Google sync in `shoot-proposals`, `projects`,
  `booking/actions` and `booking/offers`; busy times come in through `booking/server.ts` `prepare()`
- Checks: `npm run test:outlook-calendar` (mocked Microsoft responses, no network or database)
