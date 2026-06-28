import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { setProjectStatus } from "@/lib/status-automation";
import { getAppSettings } from "@/lib/app-settings";
import { getStripe } from "@/lib/stripe";
import { logWorkflowAudit, logWorkflowSkipped, portalLink, resolveMessageTemplate } from "@/lib/workflow";
import { logProjectActivity } from "@/lib/activity";
import { idempotencyKey } from "@/lib/idempotency";

export async function POST(request: Request) {
  try {
    const profile = await requireAdmin();
    const body = await request.json();

    if (!body.project_id || !body.client_id || !body.amount || !body.description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = await createClient();
    const appSettings = await getAppSettings();

    const dueDate = body.due_date
      ? body.due_date
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + appSettings.workflow.businessDefaults.defaultPaymentDueDays);
          return d.toISOString().split("T")[0];
        })();

    if (body.quote_id) {
      const { data: existingForQuote } = await supabase
        .from("payments")
        .select("*")
        .eq("quote_id", body.quote_id)
        .maybeSingle();

      if (existingForQuote) {
        return NextResponse.json(existingForQuote);
      }
    }

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
        quote_id: body.quote_id || null,
        amount: body.amount,
        description: body.description,
        due_date: dueDate,
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
        ...(body.quote_id ? { quote_id: body.quote_id } : {}),
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
        payment_link_url: paymentLink.url,
        status: "sent",
      })
      .eq("id", paymentRow.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const amountStr = `$${(body.amount / 100).toFixed(2)}`;
    const payWorkflow = appSettings.workflow.payments;
    if (payWorkflow.autoMoveOnPaymentLink) {
      const clientBody = resolveMessageTemplate(
        appSettings.workflow,
        "payment_request",
        {
          payment_amount: amountStr,
          portal_link: portalLink(`/dashboard/projects/${body.project_id}#payments`),
        },
        `Complete your ${amountStr} payment to unlock your final downloads.`
      );

      await setProjectStatus({
        projectId: body.project_id,
        status: "awaiting_payment",
        activityType: "invoice_sent",
        activityDescription: `Invoice sent for ${amountStr}`,
        skipIfSame: true,
        notifyClient: true,
        clientEventKey: "payment_link_sent",
        clientTitle: "Final Payment",
        clientBody,
        link: `/dashboard/projects/${body.project_id}#payments`,
        idempotencyKey: `payment:link:${paymentRow.id}`,
      });
      await logWorkflowAudit(body.project_id, "Workflow automatically moved project to Approved – Awaiting Payment when payment link was created.", {
        idempotencyKey: `workflow:payment-link:${paymentRow.id}`,
      });
    } else {
      await logWorkflowSkipped(
        body.project_id,
        "Automatic move to Awaiting Payment skipped — disabled in Payment Automation settings.",
        `workflow:payment-link-skipped:${paymentRow.id}`
      );
    }

    await logProjectActivity("invoice_sent", `Payment link created for ${amountStr}`, {
      projectId: body.project_id,
      userId: profile.id,
      idempotencyKey: idempotencyKey("payment", "link", paymentRow.id),
      metadata: { paymentId: paymentRow.id, amount: body.amount },
    });

    return NextResponse.json(payment);
  } catch (err) {
    console.error("Payment creation error:", err);
    return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
  }
}
