import { parseAddress } from "@/lib/address";
import { getServiceTemplate } from "@/lib/business-services";
import type { ServiceTemplate } from "@/lib/service-templates";
import type { GhlPortalLeadPayload } from "./types";
import { buildPortalUrls } from "./sync-portal-lead";

export interface PortalLeadPayloadInput {
  clientId: string;
  projectId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  serviceRequested: string;
  propertyAddress: string;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  projectNotes?: string | null;
  referralSource?: string | null;
  preferredDate?: string | null;
  propertyType?: string | null;
  source?: string | null;
}

function formatEstimatedValue(template: ServiceTemplate): string {
  const totalCents = template.lineItems.reduce((sum, item) => sum + item.amount_cents, 0);
  if (totalCents > 0) {
    return `$${(totalCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return template.startingLabel || "";
}

export async function buildPortalLeadPayload(
  input: PortalLeadPayloadInput & { businessId: string }
): Promise<GhlPortalLeadPayload> {
  const parsed = parseAddress(input.propertyAddress);
  const city = input.city?.trim() || parsed.city || "";
  const state = input.state?.trim() || parsed.state || "";
  const postalCode = input.postalCode?.trim() || parsed.zip || "";
  const projectAddress = input.streetAddress?.trim() || parsed.address || input.propertyAddress;
  const urls = await buildPortalUrls({
    clientId: input.clientId,
    projectId: input.projectId,
    businessId: input.businessId,
  });
  const template = await getServiceTemplate(input.serviceRequested, input.businessId);

  const source = input.source?.trim() || "ShootPortal";

  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone?.trim() || "",
    company: input.company?.trim() || "",
    serviceRequested: input.serviceRequested,
    projectAddress,
    city,
    state,
    postalCode,
    estimatedProposalValue: formatEstimatedValue(template),
    projectNotes: input.projectNotes?.trim() || "",
    portalClientUrl: urls.portalClientUrl,
    portalProjectUrl: urls.portalProjectUrl,
    source,
    tags: [`${source} Lead`, "Instant Quote"],
    referralSource: input.referralSource?.trim() || undefined,
    preferredDate: input.preferredDate || undefined,
    propertyType: input.propertyType?.trim() || undefined,
    quoteRange: template.startingLabel || undefined,
  };
}
