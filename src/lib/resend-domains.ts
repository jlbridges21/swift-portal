import type { DomainVerificationStatus } from "@/lib/email-sender-policy";

/**
 * Resend Domains API (verified 2026-08-19 from https://resend.com/docs/api-reference/domains/create-domain):
 * `resend.domains.create({ name })` returns `id`, `status`, and `records` (SPF/DKIM/tracking).
 * `resend.domains.get(id)` and `resend.domains.verify(id)` exist for re-check.
 * That surface is small enough to ship self-serve DNS copy + re-check in this prompt.
 */

export interface DnsRecordView {
  record: string;
  name: string;
  type: string;
  value: string;
  ttl?: string;
  status?: string;
  priority?: number;
}

export function mapResendDomainStatus(
  status: string | null | undefined
): DomainVerificationStatus {
  if (status === "verified") return "verified";
  if (status === "pending" || status === "not_started" || status === "partially_verified") {
    return "pending";
  }
  return "unverified";
}

export function mapResendRecords(records: unknown): DnsRecordView[] {
  if (!Array.isArray(records)) return [];
  return records.map((raw) => {
    const row = raw as {
      record?: string;
      name?: string;
      type?: string;
      value?: string;
      ttl?: string;
      status?: string;
      priority?: number;
    };
    return {
      record: row.record ?? "",
      name: row.name ?? "",
      type: row.type ?? "",
      value: row.value ?? "",
      ttl: row.ttl,
      status: row.status,
      priority: row.priority,
    };
  });
}
