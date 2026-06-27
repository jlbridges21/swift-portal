import { createServiceClient } from "@/lib/supabase/server";
import { getEmailConfigStatus } from "@/lib/email";
import { isGoogleCalendarConfigured, getGoogleCalendarConnection } from "@/lib/google-calendar";
import { isOneSignalConfigured } from "@/lib/onesignal-client";

export type CheckStatus = "ok" | "warning" | "error" | "unknown";

export interface LaunchCheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  category: "core" | "integrations" | "storage" | "pwa";
}

export interface LaunchChecklistResult {
  items: LaunchCheckItem[];
  readyCount: number;
  warningCount: number;
  errorCount: number;
  generatedAt: string;
}

function item(
  id: string,
  label: string,
  status: CheckStatus,
  detail: string,
  category: LaunchCheckItem["category"] = "core"
): LaunchCheckItem {
  return { id, label, status, detail, category };
}

export async function getLaunchChecklist(): Promise<LaunchChecklistResult> {
  const items: LaunchCheckItem[] = [];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const isProd = process.env.NODE_ENV === "production";

  // Supabase
  const supabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseAnon = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const supabaseService = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  items.push(
    item(
      "supabase-env",
      "Supabase environment variables",
      supabaseUrl && supabaseAnon && supabaseService ? "ok" : "error",
      supabaseUrl && supabaseAnon && supabaseService
        ? "URL, anon key, and service role key are configured."
        : "Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY."
    )
  );

  if (supabaseUrl && supabaseService) {
    try {
      const supabase = await createServiceClient();
      const { error } = await supabase.from("projects").select("id").limit(1);
      items.push(
        item(
          "supabase-connect",
          "Supabase database reachable",
          error ? "error" : "ok",
          error ? `Connection failed: ${error.message}` : "Successfully queried the projects table."
        )
      );
    } catch (err) {
      items.push(
        item(
          "supabase-connect",
          "Supabase database reachable",
          "error",
          err instanceof Error ? err.message : "Connection failed."
        )
      );
    }
  }

  // App URL
  items.push(
    item(
      "app-url",
      "Application URL (NEXT_PUBLIC_APP_URL)",
      appUrl && !appUrl.includes("localhost") ? "ok" : isProd ? "error" : "warning",
      appUrl
        ? isProd && appUrl.includes("localhost")
          ? "Production should not use localhost."
          : `Configured as ${appUrl}`
        : "Not set — payment redirects and emails may use fallback URLs."
    )
  );

  // Stripe
  const stripeKey = Boolean(process.env.STRIPE_SECRET_KEY);
  const stripeWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  items.push(
    item(
      "stripe-key",
      "Stripe secret key",
      stripeKey ? "ok" : "error",
      stripeKey ? "STRIPE_SECRET_KEY is configured." : "Missing STRIPE_SECRET_KEY — payment links will fail.",
      "integrations"
    )
  );
  items.push(
    item(
      "stripe-webhook",
      "Stripe webhook secret",
      stripeWebhook ? "ok" : isProd ? "error" : "warning",
      stripeWebhook
        ? "STRIPE_WEBHOOK_SECRET is configured."
        : "Missing STRIPE_WEBHOOK_SECRET — webhook payments will not verify in production.",
      "integrations"
    )
  );

  // Resend
  const emailStatus = getEmailConfigStatus();
  items.push(
    item(
      "resend-key",
      "Resend API key",
      emailStatus.resendApiKeyPresent ? "ok" : "error",
      emailStatus.resendApiKeyPresent
        ? "RESEND_API_KEY is configured."
        : "Missing RESEND_API_KEY — client emails will not send.",
      "integrations"
    )
  );
  items.push(
    item(
      "resend-from",
      "Resend sender email",
      emailStatus.resendFromEmailPresent ? "ok" : "warning",
      emailStatus.resendFromEmailPresent
        ? `Default sender: ${emailStatus.fromEmail}`
        : "RESEND_FROM_EMAIL not set — configure a verified domain sender.",
      "integrations"
    )
  );
  items.push(
    item(
      "resend-webhook",
      "Resend webhook secret",
      emailStatus.resendWebhookSecretPresent ? "ok" : isProd ? "warning" : "unknown",
      emailStatus.resendWebhookSecretPresent
        ? "RESEND_WEBHOOK_SECRET is configured."
        : "Optional but recommended — email delivery analytics may be incomplete.",
      "integrations"
    )
  );

  // OneSignal
  items.push(
    item(
      "onesignal",
      "OneSignal push notifications",
      isOneSignalConfigured() ? "ok" : "warning",
      isOneSignalConfigured()
        ? "OneSignal App ID and REST API key are configured."
        : "Optional — admin push notifications will be unavailable.",
      "integrations"
    )
  );

  // Google Calendar
  const gcalConfigured = isGoogleCalendarConfigured();
  items.push(
    item(
      "google-calendar-env",
      "Google Calendar OAuth credentials",
      gcalConfigured ? "ok" : "warning",
      gcalConfigured
        ? "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are configured."
        : "Optional — scheduling will not sync to Google Calendar.",
      "integrations"
    )
  );
  if (gcalConfigured) {
    try {
      const conn = await getGoogleCalendarConnection();
      items.push(
        item(
          "google-calendar-connected",
          "Google Calendar connected",
          conn?.calendar_id ? "ok" : "warning",
          conn?.calendar_id
            ? `Connected to calendar: ${conn.calendar_summary || conn.calendar_id}`
            : "OAuth credentials exist but no calendar is connected yet — connect in Settings.",
          "integrations"
        )
      );
    } catch {
      items.push(
        item(
          "google-calendar-connected",
          "Google Calendar connected",
          "unknown",
          "Could not verify connection status.",
          "integrations"
        )
      );
    }
  }

  // Cron
  items.push(
    item(
      "cron-secret",
      "Workflow reminders (CRON_SECRET)",
      process.env.CRON_SECRET ? "ok" : "warning",
      process.env.CRON_SECRET
        ? "CRON_SECRET is configured for automated reminders."
        : "Optional — workflow reminder cron will reject requests without CRON_SECRET.",
      "integrations"
    )
  );

  // Storage buckets
  if (supabaseService) {
    try {
      const supabase = await createServiceClient();
      const buckets = ["project-media", "project-documents", "avatars"];
      for (const bucket of buckets) {
        const { data, error } = await supabase.storage.getBucket(bucket);
        items.push(
          item(
            `bucket-${bucket}`,
            `Storage bucket: ${bucket}`,
            error || !data ? "error" : "ok",
            error || !data
              ? `Bucket "${bucket}" not found or inaccessible. Create it in Supabase Storage.`
              : `Bucket "${bucket}" exists.`,
            "storage"
          )
        );
      }
    } catch {
      items.push(
        item(
          "storage-buckets",
          "Storage buckets",
          "unknown",
          "Could not verify storage buckets.",
          "storage"
        )
      );
    }
  }

  // PWA
  items.push(
    item(
      "pwa-manifest",
      "PWA manifest",
      "ok",
      "manifest.webmanifest and app icons are included in the app bundle.",
      "pwa"
    )
  );

  const readyCount = items.filter((i) => i.status === "ok").length;
  const warningCount = items.filter((i) => i.status === "warning").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return {
    items,
    readyCount,
    warningCount,
    errorCount,
    generatedAt: new Date().toISOString(),
  };
}
