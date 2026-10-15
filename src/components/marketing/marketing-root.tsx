import type { ReactNode } from "react";
// Loaded with this component so PlatformLanding on `/` gets the sheet even
// though that branch is outside (marketing)/layout. Layout also imports it.
import "@/app/(marketing)/marketing.css";

/**
 * Isolation wrapper for ShootPortal platform marketing surfaces.
 *
 * Styles that target descendants of `.marketing-root` (see
 * `src/app/(marketing)/marketing.css`) cannot reach the admin app, client
 * portal, or a tenant's public LandingPage — those trees never mount this
 * wrapper. Do not put chrome (nav/footer) here; that stays in MarketingShell
 * from marketing-chrome.tsx.
 *
 * Named MarketingRoot because MarketingShell already means the chrome
 * (header/footer) wrapper in marketing-chrome.tsx.
 */
export function MarketingRoot({ children }: { children: ReactNode }) {
  return <div className="marketing-root">{children}</div>;
}
