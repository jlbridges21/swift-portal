/**
 * Self-serve custom domain: validation, Vercel registration, status, cleanup.
 * Host resolution still uses businesses.custom_domain only — do not change that path.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { invalidateHostLookupCache } from "@/lib/host-resolution";
import { requireEntitlement, EntitlementError } from "@/lib/entitlements";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  isVercelDomainApiConfigured,
  vercelAddProjectDomain,
  vercelGetDomainConfig,
  vercelGetProjectDomain,
  vercelRemoveProjectDomain,
  vercelVerifyProjectDomain,
  VERCEL_DEFAULT_A,
  VERCEL_DEFAULT_CNAME,
  type VercelDomainVerification,
  type VercelProjectDomain,
} from "@/lib/vercel-domains";

export type CustomDomainStatus =
  | "pending"
  | "verifying"
  | "connected"
  | "error"
  | "manual"
  | null;

export type DnsRecordInstruction = {
  type: "CNAME" | "A" | "TXT";
  host: string;
  value: string;
  purpose: "routing" | "ownership";
};

export type CustomDomainPublicState = {
  domain: string | null;
  status: CustomDomainStatus;
  vercelVerified: boolean;
  misconfigured: boolean | null;
  lastCheckedAt: string | null;
  error: string | null;
  dnsRecords: DnsRecordInstruction[];
  verification: VercelDomainVerification[];
  portalUrl: string | null;
  vercelApiConfigured: boolean;
  isApex: boolean;
  fallbackSubdomain: string;
};

const DOMAIN_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeCustomDomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let v = raw.trim().toLowerCase();
  v = v.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
  v = v.split(":")[0] ?? v;
  if (!v || !DOMAIN_RE.test(v)) return null;
  return v;
}

export function isApexDomain(domain: string): boolean {
  return domain.split(".").length === 2;
}

export function dnsHostLabel(domain: string): string {
  if (isApexDomain(domain)) return "@";
  const parts = domain.split(".");
  return parts.slice(0, -2).join(".") || parts[0];
}

export type DomainValidationResult =
  | { ok: true; domain: string; isApex: boolean }
  | { ok: false; error: string };

export function validateCustomDomainCandidate(raw: unknown): DomainValidationResult {
  const domain = normalizeCustomDomain(raw);
  if (!domain) {
    return {
      ok: false,
      error: "Enter a valid domain like portal.yourstudio.com (letters, numbers, hyphens).",
    };
  }

  const root = getPlatformRootDomain();
  if (domain === root || domain.endsWith(`.${root}`)) {
    return {
      ok: false,
      error: `Domains under ${root} are reserved for ShootPortal. Use your own domain (e.g. portal.yourstudio.com).`,
    };
  }

  // Block obvious platform / mail hosts even on other registrars' typos
  const first = domain.split(".")[0];
  if (["www", "mail", "smtp", "ftp", "api"].includes(first) && isApexDomain(domain) === false) {
    // www.example.com is fine for advanced; only warn via UI. Allow.
  }

  return { ok: true, domain, isApex: isApexDomain(domain) };
}

function buildDnsRecords(
  domain: string,
  verification: VercelDomainVerification[] = [],
  recommendedCname?: string,
  recommendedA?: string
): DnsRecordInstruction[] {
  const records: DnsRecordInstruction[] = [];
  const host = dnsHostLabel(domain);

  if (isApexDomain(domain)) {
    records.push({
      type: "A",
      host: "@",
      value: recommendedA || VERCEL_DEFAULT_A,
      purpose: "routing",
    });
  } else {
    records.push({
      type: "CNAME",
      host,
      value: recommendedCname || VERCEL_DEFAULT_CNAME,
      purpose: "routing",
    });
  }

  for (const challenge of verification) {
    if (challenge.type?.toUpperCase() === "TXT") {
      records.push({
        type: "TXT",
        host: challenge.domain || "_vercel",
        value: challenge.value,
        purpose: "ownership",
      });
    }
  }

  return records;
}

export type BusinessDomainRow = {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  custom_domain_status: CustomDomainStatus;
  custom_domain_vercel_verified: boolean;
  custom_domain_misconfigured: boolean | null;
  custom_domain_last_checked_at: string | null;
  custom_domain_error: string | null;
  custom_domain_verification: Record<string, unknown> | null;
};

const DOMAIN_SELECT =
  "id, slug, name, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured, custom_domain_last_checked_at, custom_domain_error, custom_domain_verification";

export async function loadBusinessDomainState(
  businessId: string
): Promise<BusinessDomainRow | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select(DOMAIN_SELECT)
    .eq("id", businessId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as BusinessDomainRow | null) ?? null;
}

function verificationFromRow(
  row: BusinessDomainRow
): VercelDomainVerification[] {
  const raw = row.custom_domain_verification as { challenges?: VercelDomainVerification[] } | null;
  return Array.isArray(raw?.challenges) ? raw!.challenges! : [];
}

export function toPublicDomainState(
  row: BusinessDomainRow,
  opts?: { recommendedCname?: string; recommendedA?: string }
): CustomDomainPublicState {
  const domain = row.custom_domain?.trim().toLowerCase() || null;
  const challenges = verificationFromRow(row);
  const status = (row.custom_domain_status as CustomDomainStatus) ?? (domain ? "connected" : null);
  return {
    domain,
    status,
    vercelVerified: row.custom_domain_vercel_verified === true,
    misconfigured: row.custom_domain_misconfigured,
    lastCheckedAt: row.custom_domain_last_checked_at,
    error: row.custom_domain_error,
    dnsRecords: domain
      ? buildDnsRecords(domain, challenges, opts?.recommendedCname, opts?.recommendedA)
      : [],
    verification: challenges,
    portalUrl: domain ? `https://${domain}` : null,
    vercelApiConfigured: isVercelDomainApiConfigured(),
    isApex: domain ? isApexDomain(domain) : false,
    fallbackSubdomain: `${row.slug}.${getPlatformRootDomain()}`,
  };
}

async function assertDomainAvailable(domain: string, businessId: string) {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("custom_domain", domain)
    .neq("id", businessId)
    .maybeSingle();
  if (data) {
    throw new Error("That domain is already connected to another business.");
  }
}

export async function claimCustomDomain(options: {
  businessId: string;
  domainRaw: unknown;
  actorUserId: string;
  actorEmail: string | null;
  skipEntitlement?: boolean;
}): Promise<CustomDomainPublicState> {
  if (!options.skipEntitlement) {
    await requireEntitlement(options.businessId, "custom_domain");
  }

  const validated = validateCustomDomainCandidate(options.domainRaw);
  if (!validated.ok) throw new Error(validated.error);

  const { domain } = validated;
  await assertDomainAvailable(domain, options.businessId);

  const row = await loadBusinessDomainState(options.businessId);
  if (!row) throw new Error("Business not found.");

  if (row.custom_domain && row.custom_domain !== domain) {
    throw new Error(
      "Remove your current custom domain before connecting a different one."
    );
  }

  let challenges: VercelDomainVerification[] = [];
  let vercelVerified = false;
  let status: CustomDomainStatus = "pending";
  let error: string | null = null;
  let mode: "api" | "manual" = "api";

  if (isVercelDomainApiConfigured()) {
    const existing = await vercelGetProjectDomain(domain);
    if (existing.ok) {
      challenges = existing.data.verification ?? [];
      vercelVerified = existing.data.verified === true;
    } else {
      const added = await vercelAddProjectDomain(domain);
      if (!added.ok) {
        if (added.error.status === 409) {
          throw new Error(
            "This domain is already assigned to another Vercel project. Remove it there first, or contact support."
          );
        }
        throw new Error(added.error.message || "Could not register the domain with Vercel.");
      }
      challenges = added.data.verification ?? [];
      vercelVerified = added.data.verified === true;
    }

    status = vercelVerified ? "verifying" : "pending";
  } else {
    mode = "manual";
    status = "manual";
    error =
      "Automatic domain registration is not configured. Follow the DNS steps, then contact support to finish connecting.";
  }

  const verificationPayload = {
    challenges,
    mode,
    recommendedCname: VERCEL_DEFAULT_CNAME,
    recommendedA: VERCEL_DEFAULT_A,
  };

  const supabase = await createServiceClient();
  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      custom_domain: domain,
      custom_domain_status: status,
      custom_domain_vercel_verified: vercelVerified,
      custom_domain_misconfigured: null,
      custom_domain_last_checked_at: new Date().toISOString(),
      custom_domain_error: error,
      custom_domain_verification: verificationPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.businessId);

  if (updateError) {
    if (updateError.code === "23505" || /unique/i.test(updateError.message)) {
      throw new Error("That domain is already connected to another business.");
    }
    throw new Error(updateError.message);
  }

  invalidateHostLookupCache();

  await writePlatformAudit({
    actorUserId: options.actorUserId,
    actorEmail: options.actorEmail,
    action: "domain.add",
    targetBusinessId: options.businessId,
    targetType: "business",
    targetId: options.businessId,
    metadata: { domain, status, mode },
  });

  const next = await loadBusinessDomainState(options.businessId);
  if (!next) throw new Error("Failed to reload domain state.");
  return toPublicDomainState(next);
}

export async function checkCustomDomainStatus(options: {
  businessId: string;
  actorUserId: string;
  actorEmail: string | null;
  skipEntitlement?: boolean;
}): Promise<CustomDomainPublicState> {
  if (!options.skipEntitlement) {
    await requireEntitlement(options.businessId, "custom_domain");
  }

  const row = await loadBusinessDomainState(options.businessId);
  if (!row?.custom_domain) {
    throw new Error("No custom domain is set up yet.");
  }
  const domain = row.custom_domain;

  let challenges = verificationFromRow(row);
  let vercelVerified = row.custom_domain_vercel_verified;
  let misconfigured: boolean | null = row.custom_domain_misconfigured;
  let status: CustomDomainStatus = row.custom_domain_status ?? "pending";
  let error: string | null = null;
  let recommendedCname = VERCEL_DEFAULT_CNAME;
  let recommendedA = VERCEL_DEFAULT_A;

  if (!isVercelDomainApiConfigured()) {
    status = "manual";
    error =
      "Automatic checks are unavailable. Contact support after you add the DNS records — they will confirm the connection.";
  } else {
    const config = await vercelGetDomainConfig(domain);
    if (config.ok) {
      misconfigured = config.data.misconfigured === true;
      const cname = config.data.recommendedCNAME?.find((r) => r.rank === 1)?.value
        || config.data.recommendedCNAME?.[0]?.value;
      const a = config.data.recommendedIPv4?.find((r) => r.rank === 1)?.value?.[0]
        || config.data.recommendedIPv4?.[0]?.value?.[0];
      if (cname) recommendedCname = cname;
      if (a) recommendedA = a;
    }

    let projectDomain: VercelProjectDomain | null = null;
    const got = await vercelGetProjectDomain(domain);
    if (got.ok) {
      projectDomain = got.data;
      challenges = got.data.verification ?? challenges;
      vercelVerified = got.data.verified === true;
    }

    if (projectDomain && !projectDomain.verified) {
      const verified = await vercelVerifyProjectDomain(domain);
      if (verified.ok) {
        projectDomain = verified.data;
        vercelVerified = verified.data.verified === true;
        challenges = verified.data.verification ?? challenges;
      } else if (verified.error.status === 400) {
        // TXT missing or mismatched — expected while DNS propagates
        error = verified.error.message;
        status = "pending";
      }
    }

    if (vercelVerified && misconfigured === false) {
      status = "connected";
      error = null;
    } else if (vercelVerified && misconfigured === true) {
      status = "verifying";
      error =
        "Domain ownership looks good, but DNS is not pointing at ShootPortal yet (or Cloudflare proxy is on). Keep the CNAME/A record as shown, DNS-only.";
    } else if (!vercelVerified) {
      status = "pending";
      if (!error) {
        error =
          "Waiting for DNS. This often takes a few minutes and can take up to 48 hours — that is normal, not a failure.";
      }
    }
  }

  const supabase = await createServiceClient();
  await supabase
    .from("businesses")
    .update({
      custom_domain_status: status,
      custom_domain_vercel_verified: vercelVerified,
      custom_domain_misconfigured: misconfigured,
      custom_domain_last_checked_at: new Date().toISOString(),
      custom_domain_error: error,
      custom_domain_verification: {
        challenges,
        recommendedCname,
        recommendedA,
        mode: isVercelDomainApiConfigured() ? "api" : "manual",
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.businessId);

  await writePlatformAudit({
    actorUserId: options.actorUserId,
    actorEmail: options.actorEmail,
    action: "domain.verify",
    targetBusinessId: options.businessId,
    targetType: "business",
    targetId: options.businessId,
    metadata: { domain, status, vercelVerified, misconfigured },
  });

  const next = await loadBusinessDomainState(options.businessId);
  if (!next) throw new Error("Failed to reload domain state.");
  return toPublicDomainState(next, { recommendedCname, recommendedA });
}

export async function removeCustomDomain(options: {
  businessId: string;
  actorUserId: string;
  actorEmail: string | null;
  skipEntitlement?: boolean;
}): Promise<CustomDomainPublicState> {
  if (!options.skipEntitlement) {
    await requireEntitlement(options.businessId, "custom_domain");
  }

  const row = await loadBusinessDomainState(options.businessId);
  if (!row) throw new Error("Business not found.");
  const domain = row.custom_domain;

  if (domain && isVercelDomainApiConfigured()) {
    const removed = await vercelRemoveProjectDomain(domain);
    if (!removed.ok && removed.error.status !== 404) {
      console.warn("[custom-domain] Vercel remove failed:", removed.error.message);
      // Still clear DB so tenant falls back; operator can clean Vercel manually.
    }
  }

  const supabase = await createServiceClient();
  await supabase
    .from("businesses")
    .update({
      custom_domain: null,
      custom_domain_status: null,
      custom_domain_vercel_verified: false,
      custom_domain_misconfigured: null,
      custom_domain_last_checked_at: new Date().toISOString(),
      custom_domain_error: null,
      custom_domain_verification: {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.businessId);

  invalidateHostLookupCache();

  await writePlatformAudit({
    actorUserId: options.actorUserId,
    actorEmail: options.actorEmail,
    action: "domain.remove",
    targetBusinessId: options.businessId,
    targetType: "business",
    targetId: options.businessId,
    metadata: { domain },
  });

  const next = await loadBusinessDomainState(options.businessId);
  if (!next) throw new Error("Failed to reload domain state.");
  return toPublicDomainState(next);
}

export { EntitlementError };
