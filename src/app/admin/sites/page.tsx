import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITES_TAB_COOKIE, sitesTabHref } from "@/lib/sites-tabs";

/** Sites opens on Property Websites the first time, then on whichever tab was used last. */
export default async function AdminSitesIndex() {
  const jar = await cookies();
  redirect(sitesTabHref(jar.get(SITES_TAB_COOKIE)?.value));
}
