/**
 * Which Academy lesson teaches the page you are on. Drives the "Watch how" pill and the
 * "On this page" section of the help menu. Pure: works from the path, ?tab= and #hash.
 */

export type PageLessons = { primary: string | null; related: string[] };

const NONE: PageLessons = { primary: null, related: [] };

/** Settings sections are addressed by #settings-* hashes (src/lib/settings-nav.ts). */
function settingsLesson(hash: string): PageLessons {
  const h = hash.replace(/^#/, "");
  const is = (...prefixes: string[]) => prefixes.some((p) => h === p || h.startsWith(`${p}-`));
  if (is("settings-custom-domain", "settings-website-domain", "settings-listing-domain")) return { primary: "V02", related: ["V13"] };
  if (is("settings-services", "settings-instant-preliminary", "settings-service-catalog", "settings-travel-fees")) return { primary: "V03", related: [] };
  if (is("settings-payments", "settings-bank-payments", "settings-card-fee", "settings-download-gate")) return { primary: "V04", related: ["V09"] };
  if (is("settings-marketing-kit")) return { primary: "V12", related: [] };
  if (is("settings-website", "settings-landing")) return { primary: "V13", related: ["V02"] };
  if (is("settings-automated-emails", "settings-workflow")) return { primary: "V14", related: [] };
  if (is("settings-notifications")) return { primary: "V15", related: [] };
  // Team: Staff & Permissions, Team & Availability and Team pay all lead with the team video.
  if (is("settings-team-pay", "settings-team", "settings-staff", "settings-staff-permissions")) return { primary: "V21", related: ["V16", "V08"] };
  if (is("settings-tax", "settings-integrations")) return { primary: "V16", related: ["V08"] };
  if (is("settings-media-section-defaults", "settings-new-project-setup")) return { primary: "V06", related: [] };
  return { primary: "V01", related: ["V02", "V03", "V04"] };
}

/** Project workspace tabs live in ?tab= (media is the default). */
function projectLesson(tab: string | null): PageLessons {
  switch (tab) {
    case "estimates":
      return { primary: "V07", related: ["V08", "V09"] };
    case "payments":
      return { primary: "V09", related: ["V07", "V11"] };
    case "marketing":
      return { primary: "V12", related: ["V11"] };
    case "details":
      return { primary: "V08", related: ["V21", "V16"] };
    default:
      // Media is the default tab: the project page's own lesson (upload → share → paid →
      // Download All). Uploading/organizing media stays one click away under "related".
      return { primary: "V20", related: ["V10", "V11", "V09"] };
  }
}

export function lessonsForLocation(pathname: string, search: string, hash: string): PageLessons {
  const p = pathname.replace(/\/+$/, "") || "/";
  const tab = new URLSearchParams(search).get("tab");
  if (p.startsWith("/admin/academy")) return NONE;
  if (p === "/admin") return { primary: "V00", related: ["V01"] };
  if (p.startsWith("/admin/settings")) return settingsLesson(hash);
  if (p === "/admin/projects/new") return { primary: "V06", related: ["V07"] };
  if (/^\/admin\/projects\/[^/]+\/marketing(\/|$)/.test(p)) return { primary: "V12", related: [] };
  if (/^\/admin\/projects\/[^/]+/.test(p)) return projectLesson(tab);
  if (p.startsWith("/admin/projects")) return { primary: "V06", related: ["V00"] };
  if (p.startsWith("/admin/clients")) return { primary: "V05", related: [] };
  if (p.startsWith("/admin/calendar")) return { primary: "V08", related: ["V21"] };
  if (p.startsWith("/admin/team-pay") || p.startsWith("/admin/my-pay")) return { primary: "V21", related: ["V16"] };
  if (p.startsWith("/admin/media")) return { primary: "V10", related: [] };
  if (p.startsWith("/admin/messages")) return { primary: "V14", related: [] };
  if (p.startsWith("/admin/sites/property")) return { primary: "V12", related: [] };
  if (p.startsWith("/admin/sites")) return { primary: "V13", related: ["V02", "V12"] };
  if (p === "/billing" || p.startsWith("/billing/")) return { primary: "V18", related: [] };
  if (p.startsWith("/partner")) return { primary: "V19", related: [] };
  if (p.startsWith("/staff/settings") || p.startsWith("/admin/account")) return { primary: "V15", related: [] };
  return NONE;
}
