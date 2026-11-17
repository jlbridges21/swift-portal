import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { loadTeam } from "@/lib/booking/team";

const AVATAR_BUCKET = "avatars";
const MAX_BYTES = 8 * 1024 * 1024;

async function gate(userIdRaw: unknown) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return { error: auth.response } as const;
  const tenant = await getTenantContext();
  if (!tenant) return { error: missingTenantResponse(auth.profile.role) } as const;
  if (tenant.impersonating && !tenant.allowWrites) {
    return { error: NextResponse.json({ error: "Read-only session." }, { status: 403 }) } as const;
  }
  const userId = typeof userIdRaw === "string" ? userIdRaw : "";
  const team = await loadTeam(tenant.businessId);
  if (!team.members.some((m) => m.userId === userId)) {
    return { error: NextResponse.json({ error: "Team member not found." }, { status: 404 }) } as const;
  }
  return { businessId: tenant.businessId, userId } as const;
}

/** Upload or replace a team member's (or the owner's) profile photo. */
export async function POST(request: Request) {
  const form = await request.formData();
  const g = await gate(form.get("userId"));
  if ("error" in g) return g.error;
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WebP photo." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photos must be under 8 MB." }, { status: 400 });

  const db = await createTenantServiceClient(g.businessId);
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${g.userId}/avatar.${ext}`;
  const { error: uploadError } = await db.raw.storage
    .from(AVATAR_BUCKET)
    .upload(path, Buffer.from(await file.arrayBuffer()), { upsert: true, contentType: file.type });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return NextResponse.json({ error: "Storage URL not configured" }, { status: 500 });
  const avatarUrl = `${base}/storage/v1/object/public/${AVATAR_BUCKET}/${path}?v=${Date.now()}`;
  const { error } = await db.raw.from("profiles").update({ avatar_url: avatarUrl }).eq("id", g.userId).eq("business_id", g.businessId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ avatarUrl });
}

/** Remove a profile photo. */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const g = await gate(url.searchParams.get("userId"));
  if ("error" in g) return g.error;
  const db = await createTenantServiceClient(g.businessId);
  await db.raw.storage
    .from(AVATAR_BUCKET)
    .remove(["jpg", "png", "webp", "jpeg"].map((ext) => `${g.userId}/avatar.${ext}`));
  await db.raw.from("profiles").update({ avatar_url: null }).eq("id", g.userId).eq("business_id", g.businessId);
  return NextResponse.json({ ok: true });
}
