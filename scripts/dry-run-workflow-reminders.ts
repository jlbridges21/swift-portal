/**
 * Dry-run report: what workflow-reminders would send RIGHT NOW (no emails).
 *
 *   npx tsx scripts/dry-run-workflow-reminders.ts
 *
 * Respects the same timing + WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE rules as the cron.
 * Also prints "pending" candidates that are in a reminder status but not yet due.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

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

import { createServiceClient } from "../src/lib/supabase/server";
import { getAppSettings } from "../src/lib/app-settings";
import { reminderTimingToMs } from "../src/lib/workflow-settings";
import { idempotencyKey } from "../src/lib/idempotency";

const STATUS_MAP = [
  { type: "proposal" as const, status: "quote_sent", timingKey: "proposal" as const },
  { type: "scheduling" as const, status: "proposal_approved", timingKey: "scheduling" as const },
  { type: "review" as const, status: "ready_for_review", timingKey: "review" as const },
  { type: "payment" as const, status: "awaiting_payment", timingKey: "payment" as const },
];

async function main() {
  const nowMs = Date.now();
  const cutoffRaw = process.env.WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE?.trim();
  const notBeforeMs = cutoffRaw ? new Date(cutoffRaw).getTime() : nowMs;

  console.log("=== workflow-reminders dry-run ===");
  console.log("now:", new Date(nowMs).toISOString());
  console.log(
    "WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE:",
    cutoffRaw || "(unset → treat as now; ZERO historical sends)"
  );
  console.log("effective notBefore:", new Date(notBeforeMs).toISOString());
  console.log("");

  const raw = await createServiceClient();
  const { data: businesses } = await raw
    .from("businesses")
    .select("id, name")
    .eq("status", "active")
    .is("deleted_at", null);

  const wouldSend: unknown[] = [];
  const pending: unknown[] = [];
  const skippedCutoff: unknown[] = [];

  for (const b of businesses ?? []) {
    const settings = await getAppSettings(b.id);
    const { reminders } = settings.workflow;

    for (const spec of STATUS_MAP) {
      const timing = reminders[spec.timingKey];
      const ms = reminderTimingToMs(timing);
      if (!ms) continue;

      const { data: projects } = await raw
        .from("projects")
        .select("id, project_name, client_id, updated_at, status")
        .eq("business_id", b.id)
        .eq("status", spec.status);

      for (const p of projects ?? []) {
        const anchorMs = new Date(p.updated_at).getTime();
        const ageH = ((nowMs - anchorMs) / 3600000).toFixed(1);
        const base = {
          business: b.name,
          businessId: b.id,
          type: spec.type,
          timing,
          projectId: p.id,
          project: p.project_name,
          clientId: p.client_id,
          updated_at: p.updated_at,
          ageHours: Number(ageH),
        };

        if (anchorMs < notBeforeMs) {
          skippedCutoff.push(base);
          continue;
        }

        const key = idempotencyKey("reminder", spec.type, p.id, timing);
        const { data: existing } = await raw
          .from("activity_logs")
          .select("id")
          .eq("project_id", p.id)
          .eq("idempotency_key", key)
          .maybeSingle();

        if (existing) {
          pending.push({ ...base, state: "already_sent" });
          continue;
        }

        if (nowMs - anchorMs < ms) {
          pending.push({
            ...base,
            state: "not_due_yet",
            dueInHours: Number(((ms - (nowMs - anchorMs)) / 3600000).toFixed(1)),
          });
          continue;
        }

        wouldSend.push(base);
      }
    }
  }

  console.log(`WOULD SEND NOW (${wouldSend.length}):`);
  console.log(JSON.stringify(wouldSend, null, 2));
  console.log(`\nIN REMINDER STATUS BUT NOT YET DUE / ALREADY SENT (${pending.length}):`);
  console.log(JSON.stringify(pending, null, 2));
  console.log(`\nSKIPPED BY CUTOFF (${skippedCutoff.length}):`);
  console.log(JSON.stringify(skippedCutoff, null, 2));

  // Second pass: ignore cutoff — what would fire if ANCHOR_NOT_BEFORE were epoch
  const wouldIfEnabled: unknown[] = [];
  for (const row of skippedCutoff as Array<{
    business: string;
    type: string;
    timing: string;
    projectId: string;
    project: string;
    updated_at: string;
    ageHours: number;
  }>) {
    const ms = reminderTimingToMs(row.timing as "24h" | "3d" | "7d" | "off");
    if (!ms) continue;
    const ageMs = row.ageHours * 3600000;
    if (ageMs >= ms) {
      wouldIfEnabled.push({ ...row, note: "would_send_if_cutoff_cleared" });
    } else {
      wouldIfEnabled.push({
        ...row,
        note: "not_due_yet_even_without_cutoff",
        dueInHours: Number(((ms - ageMs) / 3600000).toFixed(1)),
      });
    }
  }
  console.log(`\nIF CUTOFF CLEARED (historical anchors eligible) (${wouldIfEnabled.length}):`);
  console.log(JSON.stringify(wouldIfEnabled, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
