import type { AppSettings } from "@/lib/app-settings";
import { listBusinessServices } from "@/lib/business-services";
import { siteBusinessFromSettings, siteServicesFromRows } from "@/lib/website/server";
import type { SiteBusinessInput, SiteServiceInput } from "@/lib/website/view";
import type { WebsiteSettings } from "@/lib/website/settings";

export type OnboardingWebsitePayload = {
  website: WebsiteSettings;
  business: SiteBusinessInput;
  services: SiteServiceInput[];
};

/** What the onboarding "Your Business Website" step needs to render the generated site. */
export async function onboardingWebsitePayload(businessId: string, settings: AppSettings): Promise<OnboardingWebsitePayload> {
  const rows = await listBusinessServices(businessId, { activeOnly: true });
  return { website: settings.website, business: siteBusinessFromSettings(settings), services: siteServicesFromRows(rows) };
}
