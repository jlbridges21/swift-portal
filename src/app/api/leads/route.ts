import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.email || !body.property_address || !body.service_requested) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        company: body.company || null,
        property_address: body.property_address,
        service_requested: body.service_requested,
        preferred_date: body.preferred_date || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Lead creation error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("activity_logs").insert({
      activity_type: "lead_created",
      description: `New lead from ${body.name} for ${body.service_requested}`,
      lead_id: lead.id,
      metadata: { email: body.email, service: body.service_requested },
    });

    return NextResponse.json({ success: true, id: lead.id });
  } catch (err) {
    console.error("Lead API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
