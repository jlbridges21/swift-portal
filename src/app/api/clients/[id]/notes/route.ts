import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id: clientId } = await params;
    const supabase = await createServiceClient();
    const { data, error } = await supabase
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

    const supabase = await createServiceClient();
    const { data, error } = await supabase
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
    await requireAdmin();
    const { id: clientId } = await params;
    const body = await request.json();

    if (!body.note_id || !body.note?.trim()) {
      return NextResponse.json({ error: "note_id and note are required" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
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
    await requireAdmin();
    const { id: clientId } = await params;
    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("note_id");

    if (!noteId) {
      return NextResponse.json({ error: "note_id required" }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { error } = await supabase
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
