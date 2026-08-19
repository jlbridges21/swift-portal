import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin();
    const { id: clientId } = await params;
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);
    const { data: client } = await db.from("clients").select("id").eq("id", clientId).maybeSingle();
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    const { data, error } = await db
      .from("client_notes")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin();
    const { id: clientId } = await params;
    const body = await request.json();

    if (!body.note?.trim()) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 });
    }

    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db
      .from("client_notes")
      .insert({
        client_id: clientId,
        user_id: profile.id,
        note: body.note.trim(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin();
    const { id: clientId } = await params;
    const body = await request.json();

    if (!body.note_id || !body.note?.trim()) {
      return NextResponse.json({ error: "note_id and note are required" }, { status: 400 });
    }

    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db
      .from("client_notes")
      .update({ note: body.note.trim() })
      .eq("id", body.note_id)
      .eq("client_id", clientId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAdmin();
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("note_id");

    if (!noteId) {
      return NextResponse.json({ error: "note_id required" }, { status: 400 });
    }

    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);
    const { error } = await db
      .from("client_notes")
      .delete()
      .eq("id", noteId)
      .eq("client_id", clientId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
