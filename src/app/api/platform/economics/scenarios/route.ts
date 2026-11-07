import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { listSavedScenarios, saveScenario } from "@/lib/platform-economics";

/**
 * Saved Pricing Simulator scenarios. Stored in platform_pricing_scenarios, which no billing,
 * plan or Stripe code reads — saving a scenario can never change real prices.
 */
export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const scenarios = await listSavedScenarios();
  return NextResponse.json({ scenarios: scenarios ?? [], available: scenarios !== null });
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { config?: unknown; description?: unknown };
    const scenario = await saveScenario({ config: body.config, description: body.description }, auth.profile.email ?? null);
    return NextResponse.json({ scenario });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}
