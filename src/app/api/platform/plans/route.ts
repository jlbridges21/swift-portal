import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { listAllPlans, listActivePlans } from "@/lib/entitlements";
import { createPlan } from "@/lib/platform-plans";
import { getPlanSubscriberPriceBreakdown } from "@/lib/plan-subscriber-prices";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const activeOnly = url.searchParams.get("active") === "1";
  try {
    const plans = activeOnly ? await listActivePlans() : await listAllPlans();
    const breakdownEntries = await Promise.all(
      plans
        .filter((p) => p.key !== "founding")
        .map(async (p) => [p.key, await getPlanSubscriberPriceBreakdown(p.key)] as const)
    );
    return NextResponse.json({
      plans,
      breakdowns: Object.fromEntries(breakdownEntries),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list plans" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const plan = await createPlan(body, { id: auth.profile.id, email: auth.profile.email });
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create plan" },
      { status: 400 }
    );
  }
}
