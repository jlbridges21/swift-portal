import type { ReactNode } from "react";
import { MarketingRoot } from "@/components/marketing/marketing-root";
import "./marketing.css";

/**
 * Platform marketing route group. URLs stay /pricing, /how-it-works, etc.
 * Tenant hosts still hit requirePlatformMarketingHost() → notFound() on each page.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return <MarketingRoot>{children}</MarketingRoot>;
}
