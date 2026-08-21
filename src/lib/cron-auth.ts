import { NextResponse } from "next/server";

/**
 * Vercel Cron auth (verified 2026-08 against vercel.com/docs/cron-jobs/manage-cron-jobs):
 *
 * When `CRON_SECRET` is set in the Vercel project env, scheduled invocations
 * automatically include `Authorization: Bearer <CRON_SECRET>`. That is the
 * supported mechanism — not a separate proprietary header for the secret.
 * Vercel also sends `x-vercel-cron-schedule` with the cron expression.
 *
 * Manual curls use the same Bearer header. Unauthenticated public GETs 401.
 *
 * Plan limits (usage-and-pricing, Hobby/Pro): up to 100 crons/project; Hobby
 * minimum interval once/day; Pro once/minute. Our vercel.json uses daily UTC
 * schedules so Hobby and Pro both accept the deploy.
 */
export function assertCronAuthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("[cron] CRON_SECRET is not configured — rejecting");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function cronDryRunRequested(request: Request): boolean {
  const url = new URL(request.url);
  return url.searchParams.get("dryRun") === "1" || url.searchParams.get("dry_run") === "1";
}
