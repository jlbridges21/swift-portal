import { NextResponse } from "next/server";
import { teamPayActor, teamPayFailure } from "@/lib/team-pay/access";
import { buildExport, EXPORT_FORMATS, type ExportFormat } from "@/lib/team-pay/export";
import { buildPeriodOverview } from "@/lib/team-pay/server";

/**
 * GET ?start=YYYY-MM-DD&format=summary|detail|quickbooks_bills|quickbooks_time|gusto_hours[&user=<id>]
 * A CSV of the pay period (owner, or staff who approve team pay).
 */
export async function GET(request: Request) {
  const ctx = await teamPayActor("manager");
  if ("error" in ctx) return ctx.error;
  const url = new URL(request.url);
  const requested = url.searchParams.get("format") as ExportFormat | null;
  const format = EXPORT_FORMATS.some((f) => f.id === requested) ? (requested as ExportFormat) : "summary";
  try {
    const overview = await buildPeriodOverview(ctx.businessId, {
      start: url.searchParams.get("start"),
      onlyUserId: url.searchParams.get("user"),
    });
    const { filename, csv } = buildExport(format, overview.period, overview.people);
    // BOM so Excel reads names with accents correctly.
    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return teamPayFailure(err);
  }
}
