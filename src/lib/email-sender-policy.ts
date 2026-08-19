import type { EmailSettings } from "@/lib/app-settings";
import { DEFAULT_PLATFORM_EMAIL_DOMAIN, DEFAULT_PLATFORM_FROM_ADDRESS } from "@/lib/site-metadata";

export type EmailSenderMode = "platform" | "custom_domain";
export type DomainVerificationStatus = "unverified" | "pending" | "verified";

export class InvalidEmailSenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidEmailSenderError";
  }
}

export function parseEmailDomain(address: string): string | null {
  const trimmed = address.trim().toLowerCase();
  const match = trimmed.match(/^[^\s@]+@([^\s@]+\.[^\s@]+)$/);
  if (!match) return null;
  return match[1].replace(/\.$/, "");
}

export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.$/, "");
}

export function getPlatformEmailDomain(): string {
  const explicit = process.env.PLATFORM_EMAIL_DOMAIN?.trim();
  if (explicit) return normalizeDomain(explicit);
  const from = process.env.PLATFORM_FROM_ADDRESS || process.env.RESEND_FROM_EMAIL || "";
  const address = from.match(/<([^>]+)>/)?.[1] ?? from;
  return parseEmailDomain(address) ?? DEFAULT_PLATFORM_EMAIL_DOMAIN;
}

export function getPlatformFromAddress(): string {
  const explicit = process.env.PLATFORM_FROM_ADDRESS?.trim();
  if (explicit) {
    return explicit.includes("<") ? (explicit.match(/<([^>]+)>/)?.[1] ?? explicit) : explicit;
  }
  const domain = getPlatformEmailDomain();
  if (domain) return `noreply@${domain}`;
  const fallback = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_PLATFORM_FROM_ADDRESS;
  return fallback.match(/<([^>]+)>/)?.[1] ?? fallback;
}

export interface OtherBusinessDomain {
  businessId: string;
  customDomain: string;
}

export interface SenderPolicyInput {
  email: EmailSettings;
  businessId: string;
  platformDomain: string;
  otherBusinessDomains: OtherBusinessDomain[];
}

/**
 * Tenant email-spoofing controls. Call from saveAppSettings so PATCH /api/admin/settings
 * cannot be bypassed by a crafted body.
 */
export function assertEmailSenderPolicy(input: SenderPolicyInput): void {
  const email = input.email;
  const platformDomain = normalizeDomain(input.platformDomain);
  const customDomain = email.customDomain ? normalizeDomain(email.customDomain) : "";
  const senderEmail = email.senderEmail.trim();
  const senderDomain = senderEmail ? parseEmailDomain(senderEmail) : null;

  if (email.senderMode === "custom_domain" && email.domainVerificationStatus !== "verified") {
    throw new InvalidEmailSenderError(
      "senderMode='custom_domain' is only permitted when domainVerificationStatus='verified'"
    );
  }

  if (customDomain) {
    const taken = input.otherBusinessDomains.find(
      (row) => row.businessId !== input.businessId && normalizeDomain(row.customDomain) === customDomain
    );
    if (taken) {
      throw new InvalidEmailSenderError("customDomain belongs to another business");
    }
    if (platformDomain && customDomain === platformDomain) {
      const ownsPlatformDomain =
        email.senderMode === "custom_domain" && email.domainVerificationStatus === "verified";
      if (!ownsPlatformDomain) {
        throw new InvalidEmailSenderError("customDomain may not be the platform domain");
      }
    }
  }

  if (!senderEmail) return;

  if (!senderDomain) {
    throw new InvalidEmailSenderError("senderEmail must be a valid email address");
  }

  const usesPlatformDomain = Boolean(platformDomain) && senderDomain === platformDomain;
  const ownVerifiedCustomIsPlatform =
    email.senderMode === "custom_domain" &&
    email.domainVerificationStatus === "verified" &&
    customDomain === platformDomain;

  if (usesPlatformDomain && !ownVerifiedCustomIsPlatform) {
    throw new InvalidEmailSenderError("senderEmail may not use the platform domain");
  }

  const ownedByOther = input.otherBusinessDomains.find(
    (row) => row.businessId !== input.businessId && normalizeDomain(row.customDomain) === senderDomain
  );
  if (ownedByOther) {
    throw new InvalidEmailSenderError("senderEmail domain belongs to another business");
  }

  if (email.senderMode !== "custom_domain" || email.domainVerificationStatus !== "verified") {
    throw new InvalidEmailSenderError(
      "senderEmail is only allowed for a verified custom domain; use senderMode='platform' with an empty senderEmail"
    );
  }

  if (!customDomain || senderDomain !== customDomain) {
    throw new InvalidEmailSenderError(
      "senderEmail domain must equal this business's own verified customDomain"
    );
  }
}

export function formatFromHeader(displayName: string, address: string): string {
  return `${displayName.trim()} <${address.trim()}>`;
}
