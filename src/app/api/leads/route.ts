import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { resolvePublicSignupBusinessId } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.email || !body.property_address || !body.service_requested) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const resolved = await resolvePublicSignupBusinessId(body);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const businessId = resolved.businessId;
    const db = await createTenantServiceClient(businessId);

    const { data: lead, error } = await db
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

    await db.from("activity_logs").insert({
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
