import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { getAppSettings, saveAppSettings } from "@/lib/app-settings";

const LOGO_BUCKET = "business-logos";

export async function POST(request: Request) {
  const profile = await getProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "File must be an image" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Image must be under 5MB" }, { status: 400 });
  }

  const db = await createTenantServiceClient(tenant.businessId);
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "png";
  const path = `${tenant.businessId}/logo.${safeExt}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await db.raw.storage
    .from(LOGO_BUCKET)
    .upload(path, buffer, { upsert: true, contentType: file.type });

  if (uploadError) {
    console.error("[business-logo] upload failed:", uploadError.message);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: "Storage URL not configured" }, { status: 500 });
  }

  const logoUrl = `${supabaseUrl}/storage/v1/object/public/${LOGO_BUCKET}/${path}?v=${Date.now()}`;
  const current = await getAppSettings(tenant.businessId);
  const saved = await saveAppSettings(
    {
      business: {
        ...current.business,
        logoUrl,
        emailLogoUrl: current.business.emailLogoUrl || logoUrl,
      },
    },
    profile.id,
    tenant.businessId
  );

  return NextResponse.json({ logoUrl, settings: saved });
}
