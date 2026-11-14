import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import { EMAIL_RE, IMPORT_MAX_ROWS, type ImportClientInput } from "@/lib/clients-workspace";

type Skip = { index: number; email: string; reason: string };

function clean(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, max);
  return v || null;
}

/**
 * CSV client import (new interface Clients page). The browser parses the file; this route
 * re-validates every row, skips emails that already belong to a client of this business
 * (active or hidden) or repeat within the file, and inserts the rest in one statement.
 * `dry_run: true` returns the same verdicts without writing. No portal invites are sent —
 * the business invites from the Not Invited tab when it's ready.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi({ permission: "clients.create" });
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = (await request.json().catch(() => null)) as { rows?: unknown; dry_run?: unknown } | null;
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Send the rows to import." }, { status: 400 });
  }
  if (body.rows.length > IMPORT_MAX_ROWS) {
    return NextResponse.json(
      { error: `Import up to ${IMPORT_MAX_ROWS} clients at a time.` },
      { status: 400 }
    );
  }
  const dryRun = body.dry_run === true;
  const db = await createTenantServiceClient(tenant.businessId);

  // Every existing email for this business (hidden clients included), paged.
  const existing = new Map<string, { hidden: boolean }>();
  for (let page = 0; page < 50; page++) {
    const { data, error } = await db
      .from("clients")
      .select("email, deleted_at")
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) return NextResponse.json({ error: "Couldn't check for duplicates." }, { status: 500 });
    for (const c of data ?? []) {
      const e = ((c.email as string | null) ?? "").trim().toLowerCase();
      if (e) existing.set(e, { hidden: Boolean(c.deleted_at) });
    }
    if (!data || data.length < 1000) break;
  }

  const skipped: Skip[] = [];
  const toInsert: (ImportClientInput & { index: number })[] = [];
  const inFile = new Set<string>();
  (body.rows as Record<string, unknown>[]).forEach((raw, index) => {
    const name = clean(raw?.name, 200);
    const email = (clean(raw?.email, 320) ?? "").toLowerCase();
    if (!name) return skipped.push({ index, email, reason: "Missing name" });
    if (!email || !EMAIL_RE.test(email)) return skipped.push({ index, email, reason: "Invalid email" });
    if (inFile.has(email)) return skipped.push({ index, email, reason: "Duplicate email in this file" });
    const dup = existing.get(email);
    if (dup) {
      return skipped.push({
        index,
        email,
        reason: dup.hidden ? "Already a hidden client" : "Already a client",
      });
    }
    inFile.add(email);
    toInsert.push({
      index,
      name,
      email,
      phone: clean(raw?.phone, 50),
      company: clean(raw?.company, 200),
      referral_source: clean(raw?.referral_source, 120),
      notes: clean(raw?.notes, 2000),
    });
  });

  if (dryRun || toInsert.length === 0) {
    return NextResponse.json({ created: 0, ready: toInsert.length, skipped, dryRun });
  }

  const { data: inserted, error } = await db
    .from("clients")
    .insert(
      toInsert.map((r) => ({
        name: r.name,
        email: r.email,
        phone: r.phone,
        company: r.company,
        referral_source: r.referral_source,
        notes: r.notes,
      }))
    )
    .select("id");
  if (error) {
    return NextResponse.json({ error: `Import failed — nothing was added. ${error.message}` }, { status: 500 });
  }

  await logProjectActivity("clients_imported", `Imported ${inserted?.length ?? 0} clients from CSV`, {
    businessId: tenant.businessId,
    userId: auth.profile.id,
    visibility: "admin",
    metadata: { created: inserted?.length ?? 0, skipped: skipped.length },
  }).catch(() => null);

  return NextResponse.json({ created: inserted?.length ?? 0, ready: toInsert.length, skipped, dryRun: false });
}
