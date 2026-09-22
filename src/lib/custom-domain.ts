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
  /**
   * Documented Vercel public fallbacks only — never show these as if they were
   * this project's required target. Prefer GET /v6/domains/{domain}/config.
   * @see https://vercel.com/docs/projects/domains/add-a-domain
   */
  VERCEL_DEFAULT_A,
  VERCEL_DEFAULT_CNAME,
  type VercelDomainConfig,
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
  /** True when value is Vercel's generic public fallback, not this project's config. */
  isGenericFallback?: boolean;
};

export type DnsTargetSource = "vercel" | "missing" | "manual" | "fallback";

export type DnsTargetChange = {
  record: "CNAME" | "A";
  from: string;
  to: string;
  message: string;
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
  /** Where the routing DNS value came from. */
  dnsTargetSource: DnsTargetSource;
  /** Human message when the real Vercel target could not be loaded. */
  dnsConfigMessage: string | null;
  /** Set when Check status discovers a different required target than we showed before. */
  dnsTargetChanged: DnsTargetChange | null;
  recommendedCname: string | null;
  recommendedA: string | null;
};

import {
  normalizeCustomDomain,
  isApexDomain,
  dnsHostLabel,
  validateCustomDomainCandidate,
} from "@/lib/custom-domain-input";

export {
  stripPastedHost,
  composePortalDomainInput,
  type DomainValidationResult,
  type ComposePortalDomainResult,
} from "@/lib/custom-domain-input";

export {
  normalizeCustomDomain,
  isApexDomain,
  dnsHostLabel,
  validateCustomDomainCandidate,
};

type StoredDnsVerification = {
  challenges?: VercelDomainVerification[];
  mode?: string;
  recommendedCname?: string | null;
  recommendedA?: string | null;
  dnsTargetSource?: DnsTargetSource;
};

function buildDnsRecords(
  domain: string,
  verification: VercelDomainVerification[] = [],
  opts: {
    recommendedCname?: string | null;
    recommendedA?: string | null;
    dnsTargetSource?: DnsTargetSource;
  } = {}
): DnsRecordInstruction[] {
  const records: DnsRecordInstruction[] = [];
  const host = dnsHostLabel(domain);
  const source = opts.dnsTargetSource ?? "missing";

  if (isApexDomain(domain)) {
    if (opts.recommendedA) {
      records.push({
        type: "A",
        host: "@",
        value: opts.recommendedA,
        purpose: "routing",
        isGenericFallback: source === "fallback",
      });
    }
  } else if (opts.recommendedCname) {
    records.push({
      type: "CNAME",
      host,
      value: opts.recommendedCname,
      purpose: "routing",
      isGenericFallback: source === "fallback",
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

function storedVerification(row: BusinessDomainRow): StoredDnsVerification {
  const raw = row.custom_domain_verification as StoredDnsVerification | null;
  return raw && typeof raw === "object" ? raw : {};
}

function verificationFromRow(row: BusinessDomainRow): VercelDomainVerification[] {
  const raw = storedVerification(row);
  return Array.isArray(raw.challenges) ? raw.challenges! : [];
}

function extractRecommendedFromConfig(config: VercelDomainConfig): {
  cname: string | null;
  a: string | null;
} {
  const cname =
    config.recommendedCNAME?.find((r) => r.rank === 1)?.value ||
    config.recommendedCNAME?.[0]?.value ||
    null;
  const a =
    config.recommendedIPv4?.find((r) => r.rank === 1)?.value?.[0] ||
    config.recommendedIPv4?.[0]?.value?.[0] ||
    null;
  return { cname, a };
}

/**
 * Fetch the ACTUAL DNS targets Vercel requires for this domain on this project.
 * Does not substitute hardcoded defaults.
 */
export async function fetchVercelDnsTargets(domain: string): Promise<{
  ok: true;
  cname: string | null;
  a: string | null;
  misconfigured: boolean | null;
  source: DnsTargetSource;
} | {
  ok: false;
  error: string;
  misconfigured: boolean | null;
}> {
  const config = await vercelGetDomainConfig(domain);
  if (!config.ok) {
    return {
      ok: false,
      error:
        config.error.message ||
        "Could not load the required DNS record from our host. Tap Retry DNS lookup.",
      misconfigured: null,
    };
  }
  const { cname, a } = extractRecommendedFromConfig(config.data);
  const needsA = isApexDomain(domain);
  if (needsA && !a) {
    return {
      ok: false,
      error:
        "Our host did not return the A-record target for this domain yet. Wait a moment and tap Retry DNS lookup.",
      misconfigured: config.data.misconfigured === true,
    };
  }
  if (!needsA && !cname) {
    return {
      ok: false,
      error:
        "Our host did not return the CNAME target for this domain yet. Wait a moment and tap Retry DNS lookup.",
      misconfigured: config.data.misconfigured === true,
    };
  }
  return {
    ok: true,
    cname,
    a,
    misconfigured: config.data.misconfigured === true,
    source: "vercel",
  };
}

function dnsConfigMessageFor(
  source: DnsTargetSource,
  domain: string | null
): string | null {
  if (!domain) return null;
  if (source === "missing") {
    return "We could not load the exact DNS target from our host yet. Tap Retry DNS lookup — do not guess a value.";
  }
  if (source === "fallback") {
    return `Showing Vercel’s public documented fallback (${isApexDomain(domain) ? VERCEL_DEFAULT_A : VERCEL_DEFAULT_CNAME}). Prefer Retry DNS lookup so we can show the project-specific target.`;
  }
  if (source === "manual") {
    return "Automatic DNS lookup is unavailable. Contact support for the exact record, or ask a platform admin to finish connecting.";
  }
  return null;
}

export function emptyPublicDomainState(fallbackSubdomain: string): CustomDomainPublicState {
  return {
    domain: null,
    status: null,
    vercelVerified: false,
    misconfigured: null,
    lastCheckedAt: null,
    error: null,
    dnsRecords: [],
    verification: [],
    portalUrl: null,
    vercelApiConfigured: isVercelDomainApiConfigured(),
    isApex: false,
    fallbackSubdomain,
    dnsTargetSource: "missing",
    dnsConfigMessage: null,
    dnsTargetChanged: null,
    recommendedCname: null,
    recommendedA: null,
  };
}

export function toPublicDomainState(
  row: BusinessDomainRow,
  opts?: {
    recommendedCname?: string | null;
    recommendedA?: string | null;
    dnsTargetSource?: DnsTargetSource;
    dnsTargetChanged?: DnsTargetChange | null;
  }
): CustomDomainPublicState {
  const domain = row.custom_domain?.trim().toLowerCase() || null;
  const challenges = verificationFromRow(row);
  const stored = storedVerification(row);
  const status = (row.custom_domain_status as CustomDomainStatus) ?? (domain ? "connected" : null);

  const recommendedCname =
    opts?.recommendedCname !== undefined
      ? opts.recommendedCname
      : typeof stored.recommendedCname === "string"
        ? stored.recommendedCname
        : null;
  const recommendedA =
    opts?.recommendedA !== undefined
      ? opts.recommendedA
      : typeof stored.recommendedA === "string"
        ? stored.recommendedA
        : null;
  const dnsTargetSource: DnsTargetSource =
    opts?.dnsTargetSource ??
    stored.dnsTargetSource ??
    (recommendedCname || recommendedA ? "vercel" : domain ? "missing" : "missing");

  return {
    domain,
    status,
    vercelVerified: row.custom_domain_vercel_verified === true,
    misconfigured: row.custom_domain_misconfigured,
    lastCheckedAt: row.custom_domain_last_checked_at,
    error: row.custom_domain_error,
    dnsRecords: domain
      ? buildDnsRecords(domain, challenges, {
          recommendedCname,
          recommendedA,
          dnsTargetSource,
        })
      : [],
    verification: challenges,
    portalUrl: domain ? `https://${domain}` : null,
    vercelApiConfigured: isVercelDomainApiConfigured(),
    isApex: domain ? isApexDomain(domain) : false,
    fallbackSubdomain: `${row.slug}.${getPlatformRootDomain()}`,
    dnsTargetSource,
    dnsConfigMessage: dnsConfigMessageFor(dnsTargetSource, domain),
    dnsTargetChanged: opts?.dnsTargetChanged ?? null,
    recommendedCname,
    recommendedA,
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
  let recommendedCname: string | null = null;
  let recommendedA: string | null = null;
  let dnsTargetSource: DnsTargetSource = "missing";
  let misconfigured: boolean | null = null;

  if (isVercelDomainApiConfigured()) {
    const existing = await vercelGetProjectDomain(domain);
    if (existing.ok) {
      challenges = existing.data.verification ?? [];
      vercelVerified = existing.data.verified === true;
    } else {
      const added = await vercelAddProjectDomain(domain);
      if (!added.ok) {
        if (added.error.status === 409 || /already|conflict|taken/i.test(added.error.message)) {
          const again = await vercelGetProjectDomain(domain);
          if (again.ok) {
            challenges = again.data.verification ?? [];
            vercelVerified = again.data.verified === true;
          } else {
            throw new Error(
              again.error.status === 404
                ? "This domain is already assigned to another Vercel project. Remove it there first, or contact support."
                : again.error.message ||
                    "This domain could not be reconnected. Try Remove domain, then Continue again."
            );
          }
        } else {
          throw new Error(added.error.message || "Could not register the domain with Vercel.");
        }
      } else {
        challenges = added.data.verification ?? [];
        vercelVerified = added.data.verified === true;
      }
    }

    // Fetch the real per-domain DNS target immediately — never show a hardcoded guess first.
    const targets = await fetchVercelDnsTargets(domain);
    if (targets.ok) {
      recommendedCname = targets.cname;
      recommendedA = targets.a;
      dnsTargetSource = targets.source;
      misconfigured = targets.misconfigured;
    } else {
      dnsTargetSource = "missing";
      error = targets.error;
      misconfigured = targets.misconfigured;
    }

    status = vercelVerified ? "verifying" : "pending";
  } else {
    mode = "manual";
    status = "manual";
    dnsTargetSource = "manual";
    error =
      "Automatic domain registration is not configured. Contact support for the exact DNS record — do not guess a CNAME value.";
  }

  const verificationPayload: StoredDnsVerification = {
    challenges,
    mode,
    recommendedCname,
    recommendedA,
    dnsTargetSource,
  };

  const supabase = await createServiceClient();
  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      custom_domain: domain,
      custom_domain_status: status,
      custom_domain_vercel_verified: vercelVerified,
      custom_domain_misconfigured: misconfigured,
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
    metadata: { domain, status, mode, dnsTargetSource, recommendedCname, recommendedA },
  });

  const next = await loadBusinessDomainState(options.businessId);
  if (!next) throw new Error("Failed to reload domain state.");
  return toPublicDomainState(next, {
    recommendedCname,
    recommendedA,
    dnsTargetSource,
  });
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
  const previous = storedVerification(row);

  let challenges = verificationFromRow(row);
  let vercelVerified = row.custom_domain_vercel_verified;
  let misconfigured: boolean | null = row.custom_domain_misconfigured;
  let status: CustomDomainStatus = row.custom_domain_status ?? "pending";
  let error: string | null = null;
  let recommendedCname: string | null =
    typeof previous.recommendedCname === "string" ? previous.recommendedCname : null;
  let recommendedA: string | null =
    typeof previous.recommendedA === "string" ? previous.recommendedA : null;
  let dnsTargetSource: DnsTargetSource = previous.dnsTargetSource ?? "missing";
  let dnsTargetChanged: DnsTargetChange | null = null;

  if (!isVercelDomainApiConfigured()) {
    status = "manual";
    dnsTargetSource = "manual";
    error =
      "Automatic checks are unavailable. Contact support after you add the DNS records — they will confirm the connection.";
  } else {
    const targets = await fetchVercelDnsTargets(domain);
    if (targets.ok) {
      if (
        !isApexDomain(domain) &&
        targets.cname &&
        recommendedCname &&
        targets.cname !== recommendedCname
      ) {
        dnsTargetChanged = {
          record: "CNAME",
          from: recommendedCname,
          to: targets.cname,
          message: `Our host updated the required CNAME target from ${recommendedCname} to ${targets.cname}. Update your DNS record to the new value — the old one will not finish connecting.`,
        };
      }
      if (
        isApexDomain(domain) &&
        targets.a &&
        recommendedA &&
        targets.a !== recommendedA
      ) {
        dnsTargetChanged = {
          record: "A",
          from: recommendedA,
          to: targets.a,
          message: `Our host updated the required A-record target from ${recommendedA} to ${targets.a}. Update your DNS record to the new value.`,
        };
      }
      recommendedCname = targets.cname;
      recommendedA = targets.a;
      dnsTargetSource = targets.source;
      misconfigured = targets.misconfigured;
    } else {
      dnsTargetSource = recommendedCname || recommendedA ? dnsTargetSource : "missing";
      error = targets.error;
      misconfigured = targets.misconfigured;
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
        error = verified.error.message;
        status = "pending";
      }
    }

    if (vercelVerified && misconfigured === false) {
      status = "connected";
      if (!dnsTargetChanged) error = null;
    } else if (vercelVerified && misconfigured === true) {
      status = "verifying";
      error =
        error ||
        "Domain ownership looks good, but DNS is not pointing at ShootPortal yet (or Cloudflare proxy is on). Keep the CNAME/A record as shown, DNS-only.";
    } else if (!vercelVerified) {
      status = "pending";
      if (!error) {
        error =
          "Waiting for DNS. This often takes a few minutes and can take up to 48 hours — that is normal, not a failure.";
      }
    }
  }

  if (dnsTargetChanged) {
    error = dnsTargetChanged.message;
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
        dnsTargetSource,
        mode: isVercelDomainApiConfigured() ? "api" : "manual",
      } satisfies StoredDnsVerification,
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
    metadata: {
      domain,
      status,
      vercelVerified,
      misconfigured,
      dnsTargetSource,
      recommendedCname,
      recommendedA,
      dnsTargetChanged,
    },
  });

  const next = await loadBusinessDomainState(options.businessId);
  if (!next) throw new Error("Failed to reload domain state.");
  return toPublicDomainState(next, {
    recommendedCname,
    recommendedA,
    dnsTargetSource,
    dnsTargetChanged,
  });
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

export { EntitlementError, VERCEL_DEFAULT_A, VERCEL_DEFAULT_CNAME };
