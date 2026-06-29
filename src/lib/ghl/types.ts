export type GhlSyncStatus = "pending" | "success" | "failed";

export interface GhlPortalLeadPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  serviceRequested: string;
  projectAddress: string;
  city: string;
  state: string;
  postalCode: string;
  estimatedProposalValue: string;
  projectNotes: string;
  portalClientUrl: string;
  portalProjectUrl: string;
  source: "Swift Portal";
  tags: string[];
  referralSource?: string;
  preferredDate?: string;
  propertyType?: string;
  quoteRange?: string;
}

export interface GhlSyncAttemptResult {
  ok: boolean;
  statusCode: number | null;
  responseBody: string | null;
  error?: string;
}
