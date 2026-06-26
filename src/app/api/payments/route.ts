import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { setProjectStatus } from "@/lib/status-automation";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json();

    if (!body.project_id || !body.client_id || !body.amount || !body.description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: project } = await supabase
      .from("projects")
      .select("project_name")
      .eq("id", body.project_id)
      .single();

    const { data: paymentRow, error: insertError } = await supabase
      .from("payments")
      .insert({
        project_id: body.project_id,
        client_id: body.client_id,
        amount: body.amount,
        description: body.description,
        due_date: body.due_date || null,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !paymentRow) {
      return NextResponse.json({ error: insertError?.message || "Failed to create payment" }, { status: 500 });
    }

    const paymentLink = await getStripe().paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: body.description },
            unit_amount: body.amount,
          },
          quantity: 1,
        },
      ],
      metadata: {
        project_id: body.project_id,
        payment_id: paymentRow.id,
        client_id: body.client_id,
        project_name: project?.project_name || "",
      },
      after_completion: {
        type: "redirect",
        redirect: {
          url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${body.project_id}?payment=success#payments`,
        },
      },
    });

    const { data: payment, error } = await supabase
      .from("payments")
      .update({
        stripe_payment_link_id: paymentLink.id,
        stripe_payment_link_url: paymentLink.url,
      })
      .eq("id", paymentRow.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const amountStr = `$${(body.amount / 100).toFixed(2)}`;
    await setProjectStatus({
      projectId: body.project_id,
      status: "awaiting_payment",
      activityType: "invoice_sent",
      activityDescription: `Invoice sent for ${amountStr}`,
      skipIfSame: true,
      notifyClient: true,
      clientEventKey: "payment_link_sent",
      clientTitle: "Final Payment",
      clientBody: `Complete your ${amountStr} payment to unlock your final downloads.`,
      link: `/dashboard/projects/${body.project_id}#payments`,
    });

    return NextResponse.json(payment);
  } catch (err) {
    console.error("Payment creation error:", err);
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }
}
