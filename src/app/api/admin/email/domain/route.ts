import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getAppSettings, saveAppSettings } from "@/lib/app-settings";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  getPlatformEmailDomain,
  normalizeDomain,
  parseEmailDomain,
} from "@/lib/email-sender-policy";
import { createServiceClient } from "@/lib/supabase/server";
import { mapResendDomainStatus, mapResendRecords, type DnsRecordView } from "@/lib/resend-domains";
import { Resend } from "resend";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

async function requireAdminTenant() {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) };
  return { profile, tenant };
}

async function domainTakenByOther(domain: string, businessId: string): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data: rows } = await supabase.from("business_settings").select("business_id, settings");
  const needle = normalizeDomain(domain);
  return (rows ?? []).some((row) => {
    if (row.business_id === businessId) return false;
    const custom = (row.settings as { email?: { customDomain?: string } } | null)?.email?.customDomain;
    return Boolean(custom && normalizeDomain(custom) === needle);
  });
}

export async function GET() {
  const auth = await requireAdminTenant();
  if ("error" in auth) return auth.error;

  const settings = await getAppSettings(auth.tenant.businessId);
  const resend = getResendClient();
  if (!resend || !settings.email.resendDomainId) {
    return NextResponse.json({
      customDomain: settings.email.customDomain,
      domainVerificationStatus: settings.email.domainVerificationStatus,
      records: [],
    });
  }

  const { data, error } = await resend.domains.get(settings.email.resendDomainId);
  if (error || !data) {
    return NextResponse.json({
      customDomain: settings.email.customDomain,
      domainVerificationStatus: settings.email.domainVerificationStatus,
      records: [],
      error: error?.message ?? "Could not load DNS records",
    });
  }

  return NextResponse.json({
    customDomain: data.name,
    domainVerificationStatus: mapResendDomainStatus(data.status),
    records: mapResendRecords(data.records),
    resendStatus: data.status,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdminTenant();
  if ("error" in auth) return auth.error;

  const resend = getResendClient();
  if (!resend) {
    return NextResponse.json({ error: "Email sending is not configured" }, { status: 503 });
  }

  const body = (await request.json()) as { domain?: string };
  const domain = normalizeDomain(body.domain ?? "");
  if (!domain || !parseEmailDomain(`noreply@${domain}`)) {
    return NextResponse.json({ error: "Enter a valid domain (example.com)" }, { status: 400 });
  }

  const platformDomain = getPlatformEmailDomain();
  if (platformDomain && domain === platformDomain) {
    return NextResponse.json(
      { error: "That domain is the platform sending domain and cannot be claimed" },
      { status: 400 }
    );
  }

  if (await domainTakenByOther(domain, auth.tenant.businessId)) {
    return NextResponse.json({ error: "customDomain belongs to another business" }, { status: 400 });
  }

  const current = await getAppSettings(auth.tenant.businessId);
  let domainId = current.email.resendDomainId;
  let records: DnsRecordView[] = [];

  if (domainId) {
    const existing = await resend.domains.get(domainId);
    if (existing.data && normalizeDomain(existing.data.name) === domain) {
      records = mapResendRecords(existing.data.records);
    } else {
      domainId = "";
    }
  }

  if (!domainId) {
    const created = await resend.domains.create({ name: domain });
    if (created.error || !created.data) {
      return NextResponse.json(
        { error: created.error?.message ?? "Resend could not create this domain" },
        { status: 400 }
      );
    }
    domainId = created.data.id;
    records = mapResendRecords(created.data.records);
  }

  const saved = await saveAppSettings(
    {
      email: {
        ...current.email,
        customDomain: domain,
        resendDomainId: domainId,
        domainVerificationStatus: "pending",
        senderMode: "platform",
        senderEmail: "",
      },
    },
    auth.profile.id,
    auth.tenant.businessId,
    { allowVerificationWrite: true }
  );

  return NextResponse.json({
    settings: saved,
    records,
    domainVerificationStatus: saved.email.domainVerificationStatus,
  });
}
