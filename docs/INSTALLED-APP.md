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

## Status bar, safe areas and the top overlay

Root cause: the app originally asked iOS for `black-translucent`, so pages draw underneath the
status bar / Dynamic Island, where iOS paints a dark legibility gradient, and in landscape under
the notch. iOS keeps the status-bar style an app had **when it was installed**, so switching the
meta to `default` only helps new installs; existing installs keep drawing under the status bar
(which is why portrait hid the top of full-screen screens like the Marketing Kit while landscape,
which hides the status bar, showed it).

The fix is one shared system in `globals.css` that works for both kinds of install:

- `--sat` / `--sal` / `--sar` — top/left/right safe-area insets, non-zero only in the installed app
  (`display-mode: standalone`, plus `html[data-standalone]` as a fallback). In a browser or on
  desktop they are 0, so nothing changes there.
- `body` is padded by them, so normal-flow content always starts in the safe area.
- `body::before` is a dark strip exactly the status-bar height (0 on new installs), so content
  scrolling up never sits under the white status-bar text.
- `.app-sticky-top` — sticky headers stick just below the status bar.
  `.app-sticky-below-header` — secondary sticky bars stick below the app header.
- `--app-height` — `100dvh` minus the reserved top, for full-screen layouts (Marketing Kit,
  messages, calendar, setup notices).
- `.app-safe-x` — notch padding for normal-flow elements in a browser, never doubled in the app.
- Fixed overlays (photo editor, social preview, modals, lightboxes) pad with `env()` directly.

All of it is CSS `env()`, so rotating the phone updates it without a reload.

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
