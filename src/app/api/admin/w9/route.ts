import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { isOwnerAdmin } from "@/lib/staff-access";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { w9CountryDecision } from "@/lib/w9-country";
import { createW9Pdf, w9ErrorResponse, w9SignatureDate } from "@/lib/w9-generate";
import { listW9Sends, storeAndEmailW9 } from "@/lib/w9-send";
import { W9InputError } from "@/lib/w9-tin";

async function requireW9Admin() {
  const profile = await getProfile();
  if (!profile || !isOwnerAdmin(profile)) {
    return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  }
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(profile.role) };
  const country = await w9CountryDecision(tenant.businessId);
  if (!country.us) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  return { profile, businessId: tenant.businessId };
}

const CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const gate = await requireW9Admin();
  if ("error" in gate && gate.error) return gate.error;
  if (!("businessId" in gate)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (clientId && !CLIENT_ID.test(clientId)) {
    return NextResponse.json({ error: "Choose a client." }, { status: 400 });
  }
  try {
    const sends = await listW9Sends(gate.businessId, clientId || undefined);
    return NextResponse.json({ sends });
  } catch (err) {
    return w9ErrorResponse(err);
  }
}

export async function POST(request: Request) {
  const gate = await requireW9Admin();
  if ("error" in gate && gate.error) return gate.error;
  if (!("profile" in gate)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  delete body.clientId;
  if (!clientId) return NextResponse.json({ error: "Choose a client." }, { status: 400 });

  try {
    const settings = await getAppSettings(gate.businessId);
    const date = w9SignatureDate(settings.workflow.businessDefaults.timezone);
    const pdf = await createW9Pdf({ businessId: gate.businessId, body, date });
    const sent = await storeAndEmailW9({
      businessId: gate.businessId,
      clientId,
      senderUserId: gate.profile.id,
      pdf,
    });
    return NextResponse.json({
      ok: true,
      expiresAt: sent.expiresAt,
      recipientEmail: sent.recipientEmail,
      downloadUrl: sent.downloadUrl,
    });
  } catch (err) {
    if (err instanceof W9InputError) return w9ErrorResponse(err);
    return w9ErrorResponse(err);
  }
}
