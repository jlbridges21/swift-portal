# Installed app (Home Screen PWA)

How ShootPortal behaves when a business portal is added to an iPhone or Android Home Screen.

## Launch

- Business portal hosts (`{slug}.shootportal.app`, portal custom domains) serve their own
  manifest (`src/app/manifest.ts`): business name, business icon, `start_url: "/app"`,
  `id: "/"`.
- `/app` (`src/app/app/page.tsx`):
  - signed in → the proxy redirects to the role's home using the same logic as a signed-in
    `/login` visit (owner dashboard / onboarding / billing, staff area, client projects, shared
    viewer's project). No login flash, no public website.
  - signed out / expired / revoked → branded sign-in screen (business logo + name).
- Installs made before this change were saved with start URL `/`. An inline script on the
  business homepage (`StandaloneLaunchRedirect`) moves the first page of each installed-app
  launch to `/app`. It only runs in standalone display mode, so normal browsers always see the
  website. No reinstall needed for the launch behavior.
- Business Website domains (`www.yourstudio.com`) are the public site, not the portal; their
  manifest keeps `start_url: "/"`. Install the app from the portal address.

## Sessions

Existing Supabase cookie sessions (refresh tokens, 400-day cookies). Nothing new is stored;
passwords are never saved. Each installed app has its own cookie jar (iOS keeps Home Screen apps
separate from Safari), so signing in once inside the app keeps it signed in until sign-out,
expiry or revocation.

## Status bar / top overlay

The root layout used `apple-mobile-web-app-status-bar-style: black-translucent` with
`viewport-fit=cover`, so every page rendered underneath the status bar and Dynamic Island and
iOS painted its dark legibility gradient over headers, the website hamburger and Marketing Kit
controls. It is now `default` (opaque status bar; the page starts below it). This meta is read
when the app launches, so existing installs pick it up on next launch.

## Icons

`/pwa/icon?size=180|192|512[&maskable=1]` (`src/app/pwa/icon/route.tsx`) builds the icon from the
business logo (tile-shaped logos fill the icon; others sit on white or the brand color), or a
monogram on the brand color when there is no logo. Platform hosts redirect to the ShootPortal
icons.

**Icons and the Home Screen name are captured at install time.** Existing installs keep their old
icon/name until removed and re-added (iOS always; Android Chrome may refresh the icon on its own
within days because the manifest `id` is unchanged). Push subscriptions are tied to the origin,
not the install, but on iOS deleting the Home Screen app removes its notification permission —
after re-adding, open Settings → Notifications in the app and enable again.

### Reinstall steps (only needed for the new icon/name)

- iPhone: press and hold the old icon → Remove App → Delete from Home Screen. Open the portal
  address in Safari → Share → Add to Home Screen.
- Android: press and hold → Uninstall (or drag to Remove). Open the portal address in Chrome →
  ⋮ → Install app / Add to Home screen.

## Service worker

`public/push-sw.js` (same worker as push). The installed app now also registers it, unless the
device is still on the legacy OneSignal worker. Additions: notification taps default to `/app`,
and failed page loads while offline show a reconnect screen. No caching; every request still
goes to the network.

## App-only CSS

`StandaloneAppBoot` sets `html[data-standalone]` and `html[data-keyboard="open"]`; all installed-app
styling hangs off those attributes (no overscroll bounce, tab bar hidden while the keyboard is
open). Browsers and desktop never match them.
