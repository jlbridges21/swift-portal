/**
 * Partner program entry state — pitch / application / redirect decisions for /partner.
 * Not a security boundary; partner DATA stays behind requirePartnerCapability + loaders.
 */

import { cache } from "react";
import { getProfile } from "@/lib/auth";
import { lookupBusinessById } from "@/lib/host-resolution";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { normalizePartnerEmail } from "@/lib/partners";
import { createServiceClient } from "@/lib/supabase/server";
import type { PartnerRow } from "@/lib/partners";

export type PartnerApplicationStatus = "pending" | "approved" | "declined" | "withdrawn";

export type PartnerApplicationRow = {
  id: string;
  status: PartnerApplicationStatus;
  created_at: string;
  brand_name: string;
};

export type PartnerEntryState =
  | { kind: "active"; partner: PartnerRow }
  | { kind: "suspended"; partner: PartnerRow }
  | { kind: "application_pending"; application: PartnerApplicationRow }
  | { kind: "application_declined"; application: PartnerApplicationRow }
  | { kind: "application_withdrawn" }
  | { kind: "pitch" };

export type PartnerApplyPrefill = {
  name: string;
  email: string;
  brandName: string;
};

/**
 * Resolve entry UI from partners.status and partner_applications.status.
 *
 * Application precedence (same email):
 *   1. Any pending row → pending (legacy queue only; new apps auto-approve).
 *      A later pending after an earlier declined wins.
 *   2. Else most recent terminal row (declined / withdrawn / approved-without-partner).
 *   3. Else pitch (no application).
 *
 * Partner row always beats applications when status is active or suspended.
 */
async function resolvePartnerEntryStateInner(): Promise<PartnerEntryState | null> {
  const profile = await getProfile();
  if (!profile?.email) return null;

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "active") {
    return { kind: "active", partner: access.partner };
  }
  if (access.kind === "suspended") {
    return { kind: "suspended", partner: access.partner };
  }

  const email = normalizePartnerEmail(profile.email);
  const raw = await createServiceClient();

  const { data: pendingRows } = await raw
    .from("partner_applications")
    .select("id, status, created_at, brand_name")
    .eq("email", email)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  const pending = pendingRows?.[0] as PartnerApplicationRow | undefined;
  if (pending) {
    return { kind: "application_pending", application: pending };
  }

  const { data: recentRows } = await raw
    .from("partner_applications")
    .select("id, status, created_at, brand_name")
    .eq("email", email)
    .in("status", ["declined", "withdrawn", "approved"])
    .order("created_at", { ascending: false })
    .limit(1);

  const recent = recentRows?.[0] as PartnerApplicationRow | undefined;
  if (recent?.status === "declined") {
    return { kind: "application_declined", application: recent };
  }
  if (recent?.status === "withdrawn") {
    return { kind: "application_withdrawn" };
  }

  return { kind: "pitch" };
}

export const resolvePartnerEntryState: () => Promise<PartnerEntryState | null> = cache(
  resolvePartnerEntryStateInner
);

export async function loadPartnerApplyPrefill(): Promise<PartnerApplyPrefill | null> {
  const profile = await getProfile();
  if (!profile?.email) return null;

  let brandName = "";
  if (profile.business_id) {
    const biz = await lookupBusinessById(profile.business_id);
    brandName = biz?.name?.trim() ?? "";
  }

  return {
    name: profile.full_name?.trim() ?? "",
    email: normalizePartnerEmail(profile.email),
    brandName,
  };
}
