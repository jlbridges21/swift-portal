import { notFound } from "next/navigation";
import { getPublicHostContext } from "@/lib/host-resolution";

/** Marketing pages are platform-apex only — never on tenant hosts. */
export async function requirePlatformMarketingHost() {
  const host = await getPublicHostContext();
  if (host.kind === "tenant") notFound();
  return host;
}
