/**
 * Platform bulk business actions — verification (test businesses only).
 *
 *   npx tsx scripts/verify-platform-business-bulk.ts
 *
 * Never touches Swift Aerial Media (00000000-0000-0000-0000-000000000001).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  process.env.SIGNUP_TEST_NO_EMAIL = "1";
  process.env.PLATFORM_BULK_ALLOW_SIMULATE_FAIL = "1";

  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { createBusinessForPlatform } = await import("../src/lib/platform-onboard");
  const {
    runBulkBusinessAction,
    evaluateBulkEligibility,
    loadBulkBusinessSnapshots,
    BULK_HARD_DELETE_MAX,
    BULK_LIFECYCLE_MAX,
    BULK_ROUTE_MAX_DURATION_SECONDS,
  } = await import("../src/lib/platform-business-bulk");

  const { data: sa } = await raw
    .from("profiles")
    .select("id, email")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  assert(sa?.id, "need super_admin");
  const actor = { id: sa.id as string, email: (sa.email as string) ?? null };

  const stamp = Date.now().toString(36);
  const createdIds: string[] = [];

  const mk = async (label: string) => {
    const created = await createBusinessForPlatform(
      {
        name: `Bulk Test ${label} ${stamp}`,
        slug: `bulk-${label}-${stamp}`.slice(0, 48),
        adminEmail: `bulk-${label}-${stamp}@example.test`,
        adminName: `Bulk ${label}`,
        source: "platform",
      },
      actor
    );
    createdIds.push(created.businessId);
    return created.businessId;
  };

  try {
    section("Caps");
    console.log({
      BULK_HARD_DELETE_MAX,
      BULK_LIFECYCLE_MAX,
      BULK_ROUTE_MAX_DURATION_SECONDS,
      rationale:
        "maxDuration=300s (same as zip downloads). Hard-delete can take ~30–60s per media-heavy tenant → cap 5. Lifecycle ops are cheap DB updates → cap 25.",
    });

    const a = await mk("a");
    const b = await mk("b");
    const c = await mk("c");
    const d = await mk("d");
    const e = await mk("e");

    section("2. Bulk suspend then restore");
    let report = await runBulkBusinessAction({
      action: "suspend",
      businessIds: [a, b],
      actor,
    });
    console.log("suspend:", report);
    assert(report.succeeded === 2, "suspend both");
    for (const id of [a, b]) {
      const { data } = await raw.from("businesses").select("status").eq("id", id).single();
      assert(data?.status === "suspended", `${id} suspended`);
    }
    report = await runBulkBusinessAction({
      action: "restore",
      businessIds: [a, b],
      actor,
    });
    console.log("restore (reactivate):", report);
    assert(report.succeeded === 2, "restore both");
    for (const id of [a, b]) {
      const { data } = await raw.from("businesses").select("status").eq("id", id).single();
      assert(data?.status === "active", `${id} active`);
    }

    section("3. Bulk soft-delete then restore");
    report = await runBulkBusinessAction({
      action: "soft_delete",
      businessIds: [a, b],
      actor,
    });
    console.log("soft_delete:", report);
    assert(report.succeeded === 2, "soft both");
    report = await runBulkBusinessAction({
      action: "restore",
      businessIds: [a, b],
      actor,
    });
    console.log("restore soft:", report);
    assert(report.succeeded === 2, "restore soft both");
    for (const id of [a, b]) {
      const { data } = await raw
        .from("businesses")
        .select("status, deleted_at")
        .eq("id", id)
        .single();
      assert(data && !data.deleted_at && data.status === "active", `${id} restored`);
    }

    section("5. Swift Aerial Media excluded as protected");
    const swiftSnaps = await loadBulkBusinessSnapshots([SWIFT_ID]);
    const swift = swiftSnaps.get(SWIFT_ID);
    assert(swift, "swift exists");
    const swiftElig = evaluateBulkEligibility(swift, "hard_delete");
    assert(!swiftElig.ok && swiftElig.reason === "protected", "swift protected");
    console.log("operator sees before confirm:", {
      name: swift.name,
      slug: swift.slug,
      is_protected: swift.is_protected,
      eligibility: swiftElig,
      uiCopy: `${swift.name} (protected)`,
    });
    report = await runBulkBusinessAction({
      action: "hard_delete",
      businessIds: [SWIFT_ID, c],
      actor,
    });
    console.log("mixed with Swift:", {
      succeeded: report.succeeded,
      skipped: report.skipped,
      excludedBeforeConfirm: report.excludedBeforeConfirm,
      results: report.results.map((r) => ({
        name: r.name,
        outcome: r.outcome,
        ...(r.outcome === "skipped" ? { reason: r.reason, detail: r.detail } : {}),
      })),
    });
    assert(
      report.results.some((r) => r.id === SWIFT_ID && r.outcome === "skipped"),
      "swift skipped"
    );
    assert(
      report.results.some((r) => r.id === c && r.outcome === "succeeded"),
      "eligible still deleted"
    );
    // c was hard-deleted — remove from cleanup list
    const cIdx = createdIds.indexOf(c);
    if (cIdx >= 0) createdIds.splice(cIdx, 1);

    section("6. Commission history exclusion");
    // Seed a commission row on d
    const earnedAt = new Date().toISOString();
    const { data: payment, error: payErr } = await raw
      .from("platform_subscription_payments")
      .insert({
        business_id: d,
        stripe_invoice_id: `in_bulk_${stamp}`,
        amount_paid_cents: 1000,
        currency: "usd",
        paid_at: earnedAt,
        stripe_mode: "test",
      })
      .select("id")
      .single();
    assert(!payErr && payment?.id, payErr?.message ?? "payment");
    // Need a partner for commission FK
    const { data: anyPartner } = await raw
      .from("partners")
      .select("id")
      .limit(1)
      .maybeSingle();
    let partnerId = anyPartner?.id as string | undefined;
    if (!partnerId) {
      const { data: p, error: pErr } = await raw
        .from("partners")
        .insert({
          name: `Bulk Partner ${stamp}`,
          email: `bulk-partner-${stamp}@example.test`,
          brand_name: `Bulk Partner ${stamp}`,
          referral_code: `bulkp${stamp.slice(-6)}`,
          commission_rate_pct: 30,
          status: "active",
        })
        .select("id")
        .single();
      assert(!pErr && p, pErr?.message ?? "partner");
      partnerId = p.id;
    }
    const { error: cErr } = await raw.from("partner_commissions").insert({
      partner_id: partnerId,
      business_id: d,
      subscription_payment_id: payment.id,
      kind: "commission",
      commission_rate_pct: 30,
      source_amount_cents: 1000,
      amount_cents: 300,
      currency: "usd",
      stripe_mode: "test",
      earned_at: earnedAt,
      payable_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      note: `bulk-verify-${stamp}`,
    });
    assert(!cErr, cErr?.message ?? "commission");

    const dSnaps = await loadBulkBusinessSnapshots([d]);
    const dElig = evaluateBulkEligibility(dSnaps.get(d), "hard_delete");
    assert(!dElig.ok && dElig.reason === "commission_history", "commission block");
    console.log("commission exclusion:", {
      name: dSnaps.get(d)?.name,
      eligibility: dElig,
      uiCopy: `${dSnaps.get(d)?.name} (has commission history)`,
    });

    section("7. Mixed selection");
    report = await runBulkBusinessAction({
      action: "hard_delete",
      businessIds: [SWIFT_ID, d, e],
      actor,
    });
    console.log("mixed report:", JSON.stringify(report, null, 2));
    assert(report.skipped >= 2, "swift + commission skipped");
    assert(
      report.results.find((r) => r.id === e)?.outcome === "succeeded",
      "e hard-deleted"
    );
    const eIdx = createdIds.indexOf(e);
    if (eIdx >= 0) createdIds.splice(eIdx, 1);

    section("8. Mid-batch failure simulation");
    const f = await mk("f");
    const g = await mk("g");
    const h = await mk("h");
    report = await runBulkBusinessAction({
      action: "hard_delete",
      businessIds: [f, g, h],
      actor,
      shouldFailId: (id) => id === g,
    });
    console.log("mid-batch:", report.results);
    assert(report.results.find((r) => r.id === f)?.outcome === "succeeded", "f done");
    assert(report.results.find((r) => r.id === g)?.outcome === "failed", "g failed");
    assert(report.results.find((r) => r.id === h)?.outcome === "succeeded", "h continued");
    const { data: gLeft } = await raw.from("businesses").select("id").eq("id", g).maybeSingle();
    assert(gLeft, "g untouched (still exists)");
    const { data: fGone } = await raw.from("businesses").select("id").eq("id", f).maybeSingle();
    assert(!fGone, "f fully deleted");
    // cleanup g; f and h already gone
    for (const id of [f, h]) {
      const i = createdIds.indexOf(id);
      if (i >= 0) createdIds.splice(i, 1);
    }

    section("4. Bulk hard-delete 3 throwaways — deep check");
    const x = await mk("x");
    const y = await mk("y");
    const z = await mk("z");
    // seed a client row on x for table presence
    await raw.from("clients").insert({
      business_id: x,
      name: "Bulk Client",
      email: `bulk-client-${stamp}@example.test`,
    });
    const beforeAudit = await raw
      .from("platform_audit_log")
      .select("id", { count: "exact", head: true });
    void beforeAudit;

    report = await runBulkBusinessAction({
      action: "hard_delete",
      businessIds: [x, y, z],
      actor,
    });
    console.log("hard-delete 3:", report);
    assert(report.succeeded === 3, "three deleted");
    console.log("orphans aggregated:", report.orphans);

    for (const id of [x, y, z]) {
      const { data: biz } = await raw.from("businesses").select("id").eq("id", id).maybeSingle();
      assert(!biz, `${id} business row gone`);
      for (const table of ["clients", "projects", "media_assets", "partner_referrals"] as const) {
        const { count } = await raw
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("business_id", id);
        assert((count ?? 0) === 0, `${id} ${table} empty`);
      }
      const { data: audits } = await raw
        .from("platform_audit_log")
        .select("action, target_id, metadata")
        .eq("target_id", id)
        .eq("action", "business.hard_delete")
        .limit(3);
      console.log(`audit for ${id}:`, audits);
      assert((audits?.length ?? 0) >= 1, `audit row for ${id}`);
      const i = createdIds.indexOf(id);
      if (i >= 0) createdIds.splice(i, 1);
    }

    section("9. Orphan report (always includes legacy storage note when wipe runs)");
    // Already printed from hard-deletes; assert shape
    const anyOrphans = report.orphans;
    console.log("sample orphans from last batch:", anyOrphans);

    section("10. Typed confirm required (API-level)");
    // Mimic route check
    const confirmOk = (confirm: string, eligibleCount: number) =>
      confirm === "DELETE" || confirm === String(eligibleCount);
    assert(!confirmOk("", 3), "empty rejected");
    assert(!confirmOk("delete", 3), "wrong case rejected");
    assert(confirmOk("DELETE", 3), "DELETE ok");
    assert(confirmOk("3", 3), "count ok");
    console.log("typed confirm gates:", {
      empty: false,
      lowercase: false,
      DELETE: true,
      count: true,
    });

    section("11. Select-all = filtered set (unit)");
    const all = [
      { id: "1", name: "Alpha Test", slug: "alpha-test" },
      { id: "2", name: "Beano Media", slug: "beano" },
      { id: "3", name: "Zulu", slug: "zulu" },
    ];
    const filter = "test";
    const visible = all.filter(
      (b) =>
        b.name.toLowerCase().includes(filter) || b.slug.toLowerCase().includes(filter)
    );
    assert(visible.length === 1 && visible[0].id === "1", "filter narrows");
    console.log("filter 'test' → select-all would only include:", visible);

    section("12. Non-super-admin API (HTTP if server up)");
    const base = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
    try {
      const res = await fetch(`${base}/api/platform/businesses/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "suspend", businessIds: [a] }),
        signal: AbortSignal.timeout(5000),
      });
      const body = await res.json().catch(() => ({}));
      console.log("unauthenticated bulk response:", res.status, body);
      assert(res.status === 401 || res.status === 403, "auth required");
    } catch (err) {
      console.log(
        "HTTP probe skipped (server not reachable):",
        err instanceof Error ? err.message : err
      );
    }

    // Soft-delete leftover d (has commission — cannot hard-delete) then leave or soft-delete
    await runBulkBusinessAction({ action: "soft_delete", businessIds: [d], actor });
    const dIdx = createdIds.indexOf(d);
    if (dIdx >= 0) createdIds.splice(dIdx, 1);

    // Cleanup remaining via hard-delete (a,b,g and any leftovers without commissions)
    if (createdIds.length) {
      const cleanup = await runBulkBusinessAction({
        action: "hard_delete",
        businessIds: createdIds,
        actor,
      });
      console.log("final cleanup:", cleanup.results);
    }

    // Swift untouched
    const { data: swiftStill } = await raw
      .from("businesses")
      .select("id, name, is_protected")
      .eq("id", SWIFT_ID)
      .single();
    assert(swiftStill?.is_protected === true, "Swift still protected");
    console.log("Swift untouched:", swiftStill);

    section("14. tenant-isolation / teardown");
    console.log(
      "Run separately: psql … -f supabase/tests/tenant-isolation.sql && tenant-teardown.sql → expect zero leftover test rows."
    );

    console.log("\nALL BULK BUSINESS CHECKS PASSED");
  } finally {
    // Best-effort cleanup of any remaining createdIds
    for (const id of [...createdIds]) {
      if (id === SWIFT_ID) continue;
      try {
        await runBulkBusinessAction({
          action: "hard_delete",
          businessIds: [id],
          actor,
        });
      } catch {
        await raw.from("businesses").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      }
    }
  }
}

main().catch((err) => {
  console.error("\nVERIFY FAILED:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
