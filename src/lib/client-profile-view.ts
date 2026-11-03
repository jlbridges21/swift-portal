import { getClientCrmProfile, type ClientCrmProfile } from "@/lib/clients-crm";
import { canAccessClient, isOwnerAdmin, staffCan, visibleProjectIdsFor } from "@/lib/staff-access";
import { w9CountryDecision } from "@/lib/w9-country";
import { getAppSettings } from "@/lib/app-settings";
import { isTaxInformationReady } from "@/lib/w9-generate";
import { getProjectHeroPosterUrlMap } from "@/lib/cover";
import type { Profile } from "@/lib/types";

/** Everything `<ClientCrmProfile>` needs — shared by the client page and the Projects modal. */
export interface ClientProfileView {
  data: ClientCrmProfile;
  canViewMoney: boolean;
  w9: { taxReady: boolean } | null;
  projectCovers: Record<string, string | null>;
}

/**
 * Loads a client profile scoped to what this viewer may see.
 * Returns null when the client doesn't exist or isn't visible to them.
 */
export async function loadClientProfileView({
  businessId,
  profile,
  clientId,
}: {
  businessId: string;
  profile: Profile;
  clientId: string;
}): Promise<ClientProfileView | null> {
  if (!(await canAccessClient(businessId, profile, clientId))) return null;

  const projectIds = isOwnerAdmin(profile)
    ? ("all" as const)
    : await visibleProjectIdsFor(businessId, profile);

  const data = await getClientCrmProfile(clientId, businessId, {
    includeDeleted: true,
    projectIds,
  });
  if (!data) return null;

  // Projects here are already scoped to what this viewer may see.
  const projectCovers = await getProjectHeroPosterUrlMap(data.projects, businessId);

  const canViewMoney = staffCan(profile, "money.view");
  const country = isOwnerAdmin(profile) ? await w9CountryDecision(businessId) : null;
  const taxReady =
    country?.us === true ? isTaxInformationReady((await getAppSettings(businessId)).tax) : false;

  return {
    data,
    canViewMoney,
    w9: country?.us ? { taxReady } : null,
    projectCovers,
  };
}
