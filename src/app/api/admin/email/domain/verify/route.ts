import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getAppSettings, saveAppSettings } from "@/lib/app-settings";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { mapResendDomainStatus, mapResendRecords } from "@/lib/resend-domains";
import { Resend } from "resend";

export async function POST() {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Email sending is not configured" }, { status: 503 });
  }

  const current = await getAppSettings(tenant.businessId);
  if (!current.email.resendDomainId || !current.email.customDomain) {
    return NextResponse.json({ error: "Start domain verification first" }, { status: 400 });
  }

  const resend = new Resend(apiKey);
  await resend.domains.verify(current.email.resendDomainId);
  const { data, error } = await resend.domains.get(current.email.resendDomainId);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not re-check domain" }, { status: 400 });
  }

  const status = mapResendDomainStatus(data.status);
  const saved = await saveAppSettings(
    {
      email: {
        ...current.email,
        domainVerificationStatus: status,
        senderMode: status === "verified" ? current.email.senderMode : "platform",
      },
    },
    profile.id,
    tenant.businessId,
    { allowVerificationWrite: true }
  );

  return NextResponse.json({
    settings: saved,
    domainVerificationStatus: status,
    resendStatus: data.status,
    records: mapResendRecords(data.records),
  });
}
