import { parseAddress } from "@/lib/address";
import { getServiceTemplate } from "@/lib/service-templates";
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
}

function formatEstimatedValue(serviceRequested: string): string {
  const template = getServiceTemplate(serviceRequested);
  const totalCents = template.lineItems.reduce((sum, item) => sum + item.amount_cents, 0);
  if (totalCents > 0) {
    return `$${(totalCents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  return template.startingLabel || "";
}

export function buildPortalLeadPayload(input: PortalLeadPayloadInput): GhlPortalLeadPayload {
  const parsed = parseAddress(input.propertyAddress);
  const city = input.city?.trim() || parsed.city || "";
  const state = input.state?.trim() || parsed.state || "";
  const postalCode = input.postalCode?.trim() || parsed.zip || "";
  const projectAddress = input.streetAddress?.trim() || parsed.address || input.propertyAddress;
  const urls = buildPortalUrls({ clientId: input.clientId, projectId: input.projectId });
  const template = getServiceTemplate(input.serviceRequested);

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
    estimatedProposalValue: formatEstimatedValue(input.serviceRequested),
    projectNotes: input.projectNotes?.trim() || "",
    portalClientUrl: urls.portalClientUrl,
    portalProjectUrl: urls.portalProjectUrl,
    source: "Swift Portal",
    tags: ["Swift Portal Lead", "Instant Quote"],
    referralSource: input.referralSource?.trim() || undefined,
    preferredDate: input.preferredDate || undefined,
    propertyType: input.propertyType?.trim() || undefined,
    quoteRange: template.startingLabel || undefined,
  };
}
