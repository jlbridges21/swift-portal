export type SitesTab = "business" | "property";

/** Last Sites tab the owner opened; /admin/sites reopens it (Property Websites by default). */
export const SITES_TAB_COOKIE = "sp_sites_tab";

export function sitesTabHref(tab: string | undefined | null): string {
  return tab === "business" ? "/admin/sites/business" : "/admin/sites/property";
}
