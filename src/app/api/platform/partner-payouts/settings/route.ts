import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  loadPartnerPayoutAutomationSettings,
  updatePartnerPayoutAutomationSettings,
} from "@/lib/partner-payout-automation";
import { getStripeMode } from "@/lib/stripe";
import { writePlatformAudit } from "@/lib/platform-audit";

export async function GET() {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const settings = await loadPartnerPayoutAutomationSettings();
  return NextResponse.json({ settings, deployMode: getStripeMode() });
}

export async function PATCH(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const patch: Record<string, unknown> = {};
    const deployMode = getStripeMode();

    if (body.automated_payouts_enabled != null) {
      patch.automated_payouts_enabled = Boolean(body.automated_payouts_enabled);
    }
    if (body.automated_payouts_dry_run != null) {
      patch.automated_payouts_dry_run = Boolean(body.automated_payouts_dry_run);
    }
    if (body.automated_payouts_kill_switch != null) {
      patch.automated_payouts_kill_switch = Boolean(body.automated_payouts_kill_switch);
    }
    if (body.automated_payouts_minimum_cents != null) {
      const n = Number(body.automated_payouts_minimum_cents);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json({ error: "Minimum must be ≥ 0 cents." }, { status: 400 });
      }
      patch.automated_payouts_minimum_cents = Math.round(n);
    }

    // Mode-isolated transfer enables — never cross-enable
    if (body.automated_payouts_test_transfers_enabled != null) {
      if (deployMode !== "test") {
        return NextResponse.json(
          { error: "Test transfer enable can only be changed in a test-mode deploy." },
          { status: 400 }
        );
      }
      patch.automated_payouts_test_transfers_enabled = Boolean(
        body.automated_payouts_test_transfers_enabled
      );
    }
    if (body.automated_payouts_live_transfers_enabled != null) {
      if (deployMode !== "live") {
        return NextResponse.json(
          { error: "Live transfer enable can only be changed in a live-mode deploy." },
          { status: 400 }
        );
      }
      patch.automated_payouts_live_transfers_enabled = Boolean(
        body.automated_payouts_live_transfers_enabled
      );
    }

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: "No changes." }, { status: 400 });
    }

    const settings = await updatePartnerPayoutAutomationSettings(patch);

    await writePlatformAudit({
      actorUserId: auth.profile.id,
      actorEmail: auth.profile.email,
      action: "partner.payout_automation_settings",
      targetType: "partner_program_settings",
      targetId: "1",
      metadata: { patch, deployMode },
    });

    return NextResponse.json({ settings, deployMode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed." },
      { status: 400 }
    );
  }
}
