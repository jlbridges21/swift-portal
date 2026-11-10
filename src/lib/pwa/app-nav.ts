/**
 * Logical parent screen for the installed app's back button (list → detail → sub-screen).
 * Primary tab screens (dashboard, projects, messages, media, calendar, settings…) have none.
 */
export function appParentPath(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, "") || "/";
  const seg = p.split("/").filter(Boolean);
  if (seg[0] === "admin") {
    if (seg[1] === "projects" && seg.length >= 4) return `/admin/projects/${seg[2]}`;
    if (seg[1] === "projects" && seg.length === 3) return "/admin/projects";
    if (seg[1] === "clients" && seg.length >= 3) return "/admin/clients";
    if (seg[1] === "photo-editor") return "/admin/media";
    return null;
  }
  if (seg[0] === "dashboard") {
    if (seg[1] === "projects" && seg.length >= 4) return `/dashboard/projects/${seg[2]}`;
    if (seg[1] === "projects" && seg.length === 3) return "/dashboard";
    return null;
  }
  if (seg[0] === "staff" && seg[1] === "settings") return "/staff";
  return null;
}
