import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { CartError, EMPTY_CART, loadClientCart, removeFromCart } from "@/lib/marketing/cart";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

async function auth() {
  const profile = await getProfile();
  if (!profile) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const tenant = await getTenantContext();
  if (!tenant) return { ok: false as const, response: missingTenantResponse(profile.role) };
  return { ok: true as const, profile, tenant };
}

function errorResponse(e: unknown) {
  if (e instanceof CartError) return NextResponse.json({ error: e.message }, { status: e.status });
  const message = e instanceof Error ? e.message : "Request failed";
  if (/Impersonation is read-only/.test(message)) return NextResponse.json({ error: message }, { status: 403 });
  console.error("[portal/cart] error", message);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/** The signed-in client's optional Marketing Kit cart (business staff and share viewers get an empty cart). */
export async function GET() {
  const a = await auth();
  if (!a.ok) return a.response;
  if (a.profile.role !== "client" || a.tenant.isSharedViewer) return NextResponse.json(EMPTY_CART, { headers: noStore });
  try {
    return NextResponse.json(await loadClientCart(a.profile, a.tenant.businessId), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * { action: "remove", purchaseIds: string[] } | { action: "clear" }
 * Cancels the unpaid optional add-on(s) only. Prices and payment ids are never taken from the browser.
 */
export async function POST(request: Request) {
  const a = await auth();
  if (!a.ok) return a.response;
  if (a.profile.role !== "client" || a.tenant.isSharedViewer) {
    return NextResponse.json({ error: "Only the project's client can change this cart." }, { status: 403 });
  }
  let body: { action?: unknown; purchaseIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let target: string[] | "all";
  if (body.action === "clear") target = "all";
  else if (body.action === "remove" && Array.isArray(body.purchaseIds)) {
    target = body.purchaseIds.filter((x): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 20);
    if (!target.length) return NextResponse.json({ error: "Choose an item to remove." }, { status: 400 });
  } else return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  try {
    return NextResponse.json(await removeFromCart(a.profile, a.tenant.businessId, target), { headers: noStore });
  } catch (e) {
    return errorResponse(e);
  }
}
