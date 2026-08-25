/**
 * Derived identity capabilities — one authenticated identity, multiple surfaces.
 *
 * Two independent axes (do not conflate):
 *   - profiles.role (admin | client | super_admin) = position WITHIN one business
 *   - capabilities = which platform surfaces this identity may reach (DERIVED)
 *
 * Never store capabilities in a join table — each capability owns its source row.
 */

import { cache } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { lookupBusinessById } from "@/lib/host-resolution";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { createServiceClient } from "@/lib/supabase/server";
import type { PartnerRow } from "@/lib/partners";

export type Capabilities = {
  business: {
    active: boolean;
    businessId: string | null;
    role: "admin" | "client" | null;
  };
  partner: {
    active: boolean;
    suspended: boolean;
    partnerId: string | null;
  };
  client: {
    active: boolean;
    clientId: string | null;
  };
  platform: {
    active: boolean;
  };
};

const EMPTY_CAPABILITIES: Capabilities = {
  business: { active: false, businessId: null, role: null },
  partner: { active: false, suspended: false, partnerId: null },
  client: { active: false, clientId: null },
  platform: { active: false },
};

async function resolveCapabilities(): Promise<Capabilities> {
  const profile = await getProfile();
  if (!profile) return EMPTY_CAPABILITIES;

  const caps: Capabilities = {
    business: { active: false, businessId: null, role: null },
    partner: { active: false, suspended: false, partnerId: null },
    client: { active: false, clientId: null },
    platform: { active: profile.role === "super_admin" },
  };

  // Partner — single lookup via resolvePartnerAccess (do not duplicate).
  const partnerAccess = await resolvePartnerAccess(profile.id);
  if (partnerAccess.kind === "active") {
    caps.partner = {
      active: true,
      suspended: false,
      partnerId: partnerAccess.partner.id,
    };
  } else if (partnerAccess.kind === "suspended") {
    caps.partner = {
      active: false,
      suspended: true,
      partnerId: partnerAccess.partner.id,
    };
  }

  // Business — profiles.business_id → businesses active
  if (profile.business_id && (profile.role === "admin" || profile.role === "client")) {
    const biz = await lookupBusinessById(profile.business_id);
    const active = Boolean(biz && biz.status === "active" && !biz.deleted_at);
    caps.business = {
      active,
      businessId: active ? profile.business_id : profile.business_id,
      role: profile.role === "admin" ? "admin" : "client",
    };
    if (!active) {
      caps.business.active = false;
    }
  }

  // Client — profiles.client_id → clients active (not deleted)
  if (profile.client_id) {
    const raw = await createServiceClient();
    const { data: client } = await raw
      .from("clients")
      .select("id, deleted_at")
      .eq("id", profile.client_id)
      .maybeSingle();
    caps.client = {
      active: Boolean(client && !client.deleted_at),
      clientId: profile.client_id,
    };
  }

  return caps;
}

/** Per-request memoized capability resolver — sole source for capability decisions. */
export const getCapabilities: () => Promise<Capabilities> = cache(resolveCapabilities);

export type PartnerCapabilityResult =
  | { kind: "active"; partnerId: string; partner: PartnerRow }
  | { kind: "suspended"; partnerId: string; partner: PartnerRow };

/**
 * Partner surface guard. Missing capability → 404 (not 403).
 * Suspended partners get a distinct result so the UI can show a clear message.
 */
export async function requirePartnerCapability(): Promise<PartnerCapabilityResult> {
  const profile = await getProfile();
  if (!profile) notFound();

  const access = await resolvePartnerAccess(profile.id);
  if (access.kind === "none") notFound();
  if (access.kind === "suspended") {
    return {
      kind: "suspended",
      partnerId: access.partner.id,
      partner: access.partner,
    };
  }
  return {
    kind: "active",
    partnerId: access.partner.id,
    partner: access.partner,
  };
}

/**
 * Nav UX only — never a security boundary.
 * Business admins and partners see the item; client-only portal users do not.
 */
export function showPartnerNavItem(caps: Capabilities): boolean {
  const isBusinessAdmin = caps.business.active && caps.business.role === "admin";
  return isBusinessAdmin || caps.partner.active || caps.partner.suspended;
}

/** Desktop / mobile nav label — works for both partner and non-partner states. */
export function partnerNavLabel(caps: Capabilities): string {
  return caps.partner.active ? "Partner" : "Partner Program";
}

/** Active partners land on the guarded dashboard; everyone else on the entry pitch. */
export function partnerNavHref(caps: Capabilities): string {
  return caps.partner.active ? "/partner/dashboard" : "/partner";
}

/**
 * Who may view /partner entry (pitch, application states, suspended message).
 * Client-only users and platform-only super admins are excluded.
 */
export function canAccessPartnerEntry(caps: Capabilities): boolean {
  if (caps.client.active && caps.business.role === "client" && !caps.partner.active && !caps.partner.suspended) {
    return false;
  }
  if (caps.platform.active && !caps.business.active && !caps.partner.active && !caps.partner.suspended) {
    return false;
  }
  return showPartnerNavItem(caps);
}
