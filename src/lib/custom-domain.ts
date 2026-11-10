/**
 * Self-serve custom domain: validation, Vercel registration, status, cleanup.
 *
 * Three kinds of hostname share this one code path:
 *   - "portal"  → businesses.custom_domain*   (client portal address, e.g. portal.yourstudio.com)
 *   - "listing" → businesses.listing_domain*  (property websites, e.g. listings.yourstudio.com)
 *   - "website" → businesses.website_domain*  (Business Website, e.g. www.yourstudio.com — v119),
 *                 optionally with the bare domain registered as a redirect (website_apex_redirect)
 * All use the same Vercel project, DNS instructions, verification and status model. The portal
 * path is unchanged; other kinds map the same fields onto their own columns.
 * A hostname may be exactly one kind, for one business only.
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

export type DomainKind = "portal" | "listing" | "website";

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
  /**
   * Business Website only: the other spelling of the domain (yourstudio.com ↔ www.yourstudio.com)
   * registered as a redirect to the main address. Null when not set up.
   */
  alternate: AlternateDomainState | null;
};

export type AlternateDomainState = {
  domain: string;
  redirectsTo: string;
  status: "pending" | "connected";
  dnsRecords: DnsRecordInstruction[];
  error: string | null;
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

type StoredAlternate = {
  domain: string;
  challenges?: VercelDomainVerification[];
  recommendedCname?: string | null;
  recommendedA?: string | null;
  verified?: boolean;
  misconfigured?: boolean | null;
  error?: string | null;
};

type StoredDnsVerification = {
  challenges?: VercelDomainVerification[];
  mode?: string;
  recommendedCname?: string | null;
  recommendedA?: string | null;
  dnsTargetSource?: DnsTargetSource;
  alternate?: StoredAlternate | null;
};

/**
 * www.example.com ↔ example.com. Only offered when the main address is one of those two forms;
 * other subdomains (site.example.com) have no alternate.
 */
export function alternateWebsiteDomain(domain: string): string | null {
  const d = domain.trim().toLowerCase();
  if (isApexDomain(d)) return `www.${d}`;
  const parts = d.split(".");
  if (parts.length === 3 && parts[0] === "www") return parts.slice(1).join(".");
  return null;
}

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
  /** Business Website only (v119). */
  website_apex_redirect?: string | null;
};

const DOMAIN_SELECT =
  "id, slug, name, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured, custom_domain_last_checked_at, custom_domain_error, custom_domain_verification";

const LISTING_DOMAIN_SELECT =
  "id, slug, name, listing_domain, listing_domain_status, listing_domain_vercel_verified, listing_domain_misconfigured, listing_domain_last_checked_at, listing_domain_error, listing_domain_verification";

const WEBSITE_DOMAIN_SELECT =
  "id, slug, name, website_domain, website_domain_status, website_domain_vercel_verified, website_domain_misconfigured, website_domain_last_checked_at, website_domain_error, website_domain_verification, website_apex_redirect";

const COLUMN_PREFIX: Record<DomainKind, string> = {
  portal: "custom_domain",
  listing: "listing_domain",
  website: "website_domain",
};

/** Map a portal-shaped update onto the columns for `kind`. */
function domainColumns(kind: DomainKind, patch: Record<string, unknown>): Record<string, unknown> {
  if (kind === "portal") return patch;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    out[key.startsWith("custom_domain") ? key.replace(/^custom_domain/, COLUMN_PREFIX[kind]) : key] = value;
  }
  return out;
}

/** True when a Supabase error means the v118 listing_domain columns are not applied yet. */
export function isListingDomainSchemaMissing(error: { message?: string; code?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === "42703" || /listing_domain/i.test(error.message ?? "")));
}

/** True when a Supabase error means the v119 website_domain columns are not applied yet. */
export function isWebsiteDomainSchemaMissing(error: { message?: string; code?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === "42703" || /website_(domain|apex)/i.test(error.message ?? "")));
}

/** The columns for a non-portal domain kind are not in the database yet. */
export class DomainSetupRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainSetupRequiredError";
  }
}

export class ListingDomainSetupRequiredError extends DomainSetupRequiredError {
  constructor() {
    super("Property website addresses need a quick database update (migration v118). Contact support.");
    this.name = "ListingDomainSetupRequiredError";
  }
}

export class WebsiteDomainSetupRequiredError extends DomainSetupRequiredError {
  constructor() {
    super("Business Website addresses need a quick database update (migration v119). Contact support.");
    this.name = "WebsiteDomainSetupRequiredError";
  }
}

export async function loadBusinessDomainState(
  businessId: string,
  kind: DomainKind = "portal"
): Promise<BusinessDomainRow | null> {
  const supabase = await createServiceClient();
  if (kind === "listing" || kind === "website") {
    const p = COLUMN_PREFIX[kind];
    const { data, error } = await supabase
      .from("businesses")
      .select(kind === "listing" ? LISTING_DOMAIN_SELECT : WEBSITE_DOMAIN_SELECT)
      .eq("id", businessId)
      .is("deleted_at", null)
      .maybeSingle();
    if (kind === "listing" && isListingDomainSchemaMissing(error)) throw new ListingDomainSetupRequiredError();
    if (kind === "website" && isWebsiteDomainSchemaMissing(error)) throw new WebsiteDomainSetupRequiredError();
    if (!data) return null;
    const r = data as unknown as Record<string, unknown>;
    return {
      id: r.id as string,
      slug: r.slug as string,
      name: r.name as string,
      custom_domain: (r[p] as string | null) ?? null,
      custom_domain_status: (r[`${p}_status`] as CustomDomainStatus) ?? null,
      custom_domain_vercel_verified: r[`${p}_vercel_verified`] === true,
      custom_domain_misconfigured: (r[`${p}_misconfigured`] as boolean | null) ?? null,
      custom_domain_last_checked_at: (r[`${p}_last_checked_at`] as string | null) ?? null,
      custom_domain_error: (r[`${p}_error`] as string | null) ?? null,
      custom_domain_verification: (r[`${p}_verification`] as Record<string, unknown> | null) ?? null,
      website_apex_redirect: kind === "website" ? ((r.website_apex_redirect as string | null) ?? null) : undefined,
    };
  }
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
    alternate: null,
  };
}

function alternateState(primary: string, stored: StoredAlternate | null | undefined): AlternateDomainState | null {
  if (!stored?.domain) return null;
  const records: DnsRecordInstruction[] = [];
  const host = dnsHostLabel(stored.domain);
  if (isApexDomain(stored.domain)) {
    if (stored.recommendedA) records.push({ type: "A", host: "@", value: stored.recommendedA, purpose: "routing" });
  } else if (stored.recommendedCname) {
    records.push({ type: "CNAME", host, value: stored.recommendedCname, purpose: "routing" });
  }
  for (const c of stored.challenges ?? []) {
    if (c.type?.toUpperCase() === "TXT") records.push({ type: "TXT", host: c.domain || "_vercel", value: c.value, purpose: "ownership" });
  }
  return {
    domain: stored.domain,
    redirectsTo: primary,
    status: stored.verified && stored.misconfigured === false ? "connected" : "pending",
    dnsRecords: records,
    error: stored.error ?? null,
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
    alternate: domain ? alternateState(domain, stored.alternate) : null,
  };
}

const KIND_LABEL: Record<DomainKind, string> = {
  portal: "client portal",
  listing: "property website",
  website: "Business Website",
};

/**
 * A hostname may be one kind for one business. Checks every domain column (tolerating columns
 * from migrations that are not applied yet).
 */
async function assertDomainAvailable(domain: string, businessId: string, kind: DomainKind = "portal") {
  const supabase = await createServiceClient();
  const columns: { column: string; kind: DomainKind | "website_alt" }[] = [
    { column: "custom_domain", kind: "portal" },
    { column: "listing_domain", kind: "listing" },
    { column: "website_domain", kind: "website" },
    { column: "website_apex_redirect", kind: "website_alt" },
  ];
  for (const c of columns) {
    const { data, error } = await supabase.from("businesses").select("id").eq(c.column, domain).limit(1).maybeSingle();
    if (error || !data) continue;
    if (data.id !== businessId) throw new Error("That domain is already connected to another business.");
    const ownKind = c.kind === "website_alt" ? "website" : c.kind;
    if (ownKind === kind) continue; // re-claiming the same address of the same kind
    throw new Error(
      `That hostname is already your ${KIND_LABEL[ownKind]} address. Use a different one for your ${KIND_LABEL[kind]}.`
    );
  }
}

async function registerAlternate(primary: string, alternate: string): Promise<StoredAlternate> {
  const out: StoredAlternate = { domain: alternate, challenges: [], verified: false, misconfigured: null, error: null };
  if (!isVercelDomainApiConfigured()) {
    out.error = "Automatic registration is unavailable. Contact support to finish the redirect.";
    return out;
  }
  const existing = await vercelGetProjectDomain(alternate);
  if (existing.ok) {
    out.challenges = existing.data.verification ?? [];
    out.verified = existing.data.verified === true;
  } else {
    const added = await vercelAddProjectDomain(alternate, { redirect: primary, redirectStatusCode: 308 });
    if (!added.ok) {
      out.error = added.error.message || "Could not register the redirect domain.";
      return out;
    }
    out.challenges = added.data.verification ?? [];
    out.verified = added.data.verified === true;
  }
  const targets = await fetchVercelDnsTargets(alternate);
  if (targets.ok) {
    out.recommendedCname = targets.cname;
    out.recommendedA = targets.a;
    out.misconfigured = targets.misconfigured;
  } else {
    out.error = targets.error;
    out.misconfigured = targets.misconfigured;
  }
  return out;
}

async function refreshAlternate(stored: StoredAlternate): Promise<StoredAlternate> {
  if (!isVercelDomainApiConfigured()) return stored;
  const next: StoredAlternate = { ...stored, error: null };
  const got = await vercelGetProjectDomain(stored.domain);
  if (got.ok) {
    next.challenges = got.data.verification ?? next.challenges;
    next.verified = got.data.verified === true;
    if (!got.data.verified) {
      const v = await vercelVerifyProjectDomain(stored.domain);
      if (v.ok) {
        next.verified = v.data.verified === true;
        next.challenges = v.data.verification ?? next.challenges;
      }
    }
  } else {
    next.error = got.error.status === 404 ? "This redirect is not registered. Remove the domain and connect it again." : got.error.message;
  }
  const targets = await fetchVercelDnsTargets(stored.domain);
  if (targets.ok) {
    next.recommendedCname = targets.cname;
    next.recommendedA = targets.a;
    next.misconfigured = targets.misconfigured;
  } else {
    next.misconfigured = targets.misconfigured;
    next.error = next.error || targets.error;
  }
  if (next.verified && next.misconfigured === true && !next.error) {
    next.error = "Waiting for DNS on this address.";
  }
  return next;
}

export async function claimCustomDomain(options: {
  businessId: string;
  domainRaw: unknown;
  actorUserId: string;
  actorEmail: string | null;
  skipEntitlement?: boolean;
  kind?: DomainKind;
  /** Business Website only: also register www ↔ apex as a redirect to the main address. */
  redirectAlternate?: boolean;
}): Promise<CustomDomainPublicState> {
  const kind: DomainKind = options.kind ?? "portal";
  if (!options.skipEntitlement) {
    await requireEntitlement(options.businessId, "custom_domain");
  }

  const validated = validateCustomDomainCandidate(options.domainRaw);
  if (!validated.ok) throw new Error(validated.error);

  const { domain } = validated;
  await assertDomainAvailable(domain, options.businessId, kind);

  const row = await loadBusinessDomainState(options.businessId, kind);
  if (!row) throw new Error("Business not found.");

  if (row.custom_domain && row.custom_domain !== domain) {
    throw new Error(
      kind === "listing"
        ? "Remove your current property website address before connecting a different one."
        : kind === "website"
          ? "Remove your current Business Website address before connecting a different one."
          : "Remove your current custom domain before connecting a different one."
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

  let alternate: StoredAlternate | null = null;
  const alternateName = kind === "website" && options.redirectAlternate ? alternateWebsiteDomain(domain) : null;
  if (alternateName) {
    await assertDomainAvailable(alternateName, options.businessId, "website");
    alternate = await registerAlternate(domain, alternateName);
  }

  const verificationPayload: StoredDnsVerification = {
    challenges,
    mode,
    recommendedCname,
    recommendedA,
    dnsTargetSource,
    alternate,
  };

  const supabase = await createServiceClient();
  const { error: updateError } = await supabase
    .from("businesses")
    .update({
      ...domainColumns(kind, {
        custom_domain: domain,
        custom_domain_status: status,
        custom_domain_vercel_verified: vercelVerified,
        custom_domain_misconfigured: misconfigured,
        custom_domain_last_checked_at: new Date().toISOString(),
        custom_domain_error: error,
        custom_domain_verification: verificationPayload,
        updated_at: new Date().toISOString(),
      }),
      ...(kind === "website" ? { website_apex_redirect: alternate?.domain ?? null } : {}),
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
    action: kind === "listing" ? "listing_domain.add" : kind === "website" ? "website_domain.add" : "domain.add",
    targetBusinessId: options.businessId,
    targetType: "business",
    targetId: options.businessId,
    metadata: { domain, status, mode, dnsTargetSource, recommendedCname, recommendedA, kind },
  });

  const next = await loadBusinessDomainState(options.businessId, kind);
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
  kind?: DomainKind;
}): Promise<CustomDomainPublicState> {
  const kind: DomainKind = options.kind ?? "portal";
  if (!options.skipEntitlement) {
    await requireEntitlement(options.businessId, "custom_domain");
  }

  const row = await loadBusinessDomainState(options.businessId, kind);
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

  // Business Website: the www ↔ apex redirect is checked alongside (never blocks "connected").
  const alternate = kind === "website" && previous.alternate?.domain ? await refreshAlternate(previous.alternate) : null;

  const supabase = await createServiceClient();
  await supabase
    .from("businesses")
    .update(
      domainColumns(kind, {
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
          alternate,
        } satisfies StoredDnsVerification,
        updated_at: new Date().toISOString(),
      })
    )
    .eq("id", options.businessId);

  // Routing for listing hosts reads status; drop cached host rows so "connected" takes effect.
  if (kind !== "portal") invalidateHostLookupCache();

  await writePlatformAudit({
    actorUserId: options.actorUserId,
    actorEmail: options.actorEmail,
    action: kind === "listing" ? "listing_domain.verify" : kind === "website" ? "website_domain.verify" : "domain.verify",
    targetBusinessId: options.businessId,
    targetType: "business",
    targetId: options.businessId,
    metadata: {
      kind,
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

  const next = await loadBusinessDomainState(options.businessId, kind);
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
  kind?: DomainKind;
}): Promise<CustomDomainPublicState> {
  const kind: DomainKind = options.kind ?? "portal";
  if (!options.skipEntitlement) {
    await requireEntitlement(options.businessId, "custom_domain");
  }

  const row = await loadBusinessDomainState(options.businessId, kind);
  if (!row) throw new Error("Business not found.");
  const domain = row.custom_domain;

  const alternate = kind === "website" ? row.website_apex_redirect ?? storedVerification(row).alternate?.domain ?? null : null;
  if (isVercelDomainApiConfigured()) {
    for (const name of [alternate, domain]) {
      if (!name) continue;
      const removed = await vercelRemoveProjectDomain(name);
      if (!removed.ok && removed.error.status !== 404) {
        console.warn("[custom-domain] Vercel remove failed:", removed.error.message);
      }
    }
  }

  const supabase = await createServiceClient();
  await supabase
    .from("businesses")
    .update({
      ...domainColumns(kind, {
        custom_domain: null,
        custom_domain_status: null,
        custom_domain_vercel_verified: false,
        custom_domain_misconfigured: null,
        custom_domain_last_checked_at: new Date().toISOString(),
        custom_domain_error: null,
        custom_domain_verification: {},
        updated_at: new Date().toISOString(),
      }),
      ...(kind === "website" ? { website_apex_redirect: null } : {}),
    })
    .eq("id", options.businessId);

  invalidateHostLookupCache();

  await writePlatformAudit({
    actorUserId: options.actorUserId,
    actorEmail: options.actorEmail,
    action: kind === "listing" ? "listing_domain.remove" : kind === "website" ? "website_domain.remove" : "domain.remove",
    targetBusinessId: options.businessId,
    targetType: "business",
    targetId: options.businessId,
    metadata: { domain, kind },
  });

  const next = await loadBusinessDomainState(options.businessId, kind);
  if (!next) throw new Error("Failed to reload domain state.");
  return toPublicDomainState(next);
}

export { EntitlementError, VERCEL_DEFAULT_A, VERCEL_DEFAULT_CNAME };
