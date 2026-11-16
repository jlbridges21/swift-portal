"use client";

import { useState } from "react";
import { ArrowRight, Eye, Mail } from "lucide-react";
import { EmailPreviewDialog } from "@/components/admin/email-preview-dialog";
import { deriveBrandTheme, sanitizeCssColor, type SurfaceMode } from "@/lib/brand-color";
import { cn } from "@/lib/utils";

type PreviewMode = "portal" | "email";

/**
 * Small sticky preview of the branding on the form: a portal header, a primary-colored
 * project hero and a card with an accent link, or the top of a client email.
 */
export function BrandingLivePreview({
  primary,
  accent,
  surfaceMode,
  portalName,
  businessName,
  logoUrl,
  emailLogoUrl,
  logoSizePx,
  footerText,
  brandUnsaved,
}: {
  primary: string;
  accent: string;
  surfaceMode: SurfaceMode;
  portalName: string;
  businessName: string;
  logoUrl: string;
  emailLogoUrl: string;
  logoSizePx: number;
  footerText: string;
  brandUnsaved: boolean;
}) {
  const [mode, setMode] = useState<PreviewMode>("portal");
  const theme = deriveBrandTheme(primary, accent, surfaceMode);
  const emailTheme = deriveBrandTheme(primary, accent, "light");
  const name = portalName.trim() || businessName.trim() || "Your portal";
  const emailLogo = (emailLogoUrl || logoUrl).trim();
  // The preview is roughly 60% scale; keep the logo's relative size visible.
  const logoPx = Math.max(16, Math.round(logoSizePx * 0.6));

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:sticky lg:top-20">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
          <Eye className="h-4 w-4" aria-hidden /> Live preview
        </p>
        <div role="tablist" aria-label="Preview" className="inline-flex rounded-lg border border-border bg-subtle p-0.5">
          {(["portal", "email"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "min-h-8 rounded-md px-3 text-xs font-medium capitalize transition-colors",
                mode === m ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading"
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3.5">
        {mode === "portal" ? (
          <div
            className="overflow-hidden rounded-xl border"
            style={{ background: theme.background, borderColor: theme.border, color: theme.foreground }}
          >
            <div
              className="flex items-center gap-2 border-b px-3 py-2.5"
              style={{ background: theme.card, borderColor: theme.border }}
            >
              {logoUrl.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element -- tenant URL; domain allowlist unknown
                <img
                  src={logoUrl}
                  alt=""
                  className="w-auto max-w-[96px] shrink-0 object-contain"
                  style={{ height: logoPx }}
                />
              ) : null}
              <span className="min-w-0 truncate text-[13px] font-semibold" style={{ color: theme.heading }}>
                {name}
              </span>
              <span
                className="ml-auto shrink-0 rounded-md px-2.5 py-1 text-[11px] font-semibold"
                style={{ background: theme.accent, color: theme.accentForeground }}
              >
                Save
              </span>
            </div>
            <div className="m-3 rounded-lg p-3.5" style={{ background: theme.primary, color: theme.primaryForeground }}>
              <p className="text-[10px] font-medium uppercase tracking-wider opacity-70">Project</p>
              <p className="mt-1 text-sm font-semibold">123 Main Street</p>
            </div>
            <div
              className="mx-3 mb-3 rounded-lg border p-3 text-xs"
              style={{ background: theme.card, borderColor: theme.border, color: theme.muted }}
            >
              <p className="mb-0.5 text-[13px] font-semibold" style={{ color: theme.heading }}>
                Photos are ready
              </p>
              32 edited photos · Delivered today
              <p className="mt-1.5 inline-flex items-center gap-1 font-semibold" style={{ color: theme.accent }}>
                View gallery <ArrowRight className="h-3 w-3" aria-hidden />
              </p>
            </div>
          </div>
        ) : (
          // Emails always render on a light page, so this mock uses fixed email colors.
          <div className="overflow-hidden rounded-xl border border-border" style={{ background: "#F1F5F9" }}>
            <div
              className="flex min-h-14 items-center justify-center px-4 py-3"
              style={{ background: sanitizeCssColor(primary, "#0F172A"), color: emailTheme.primaryForeground }}
            >
              {emailLogo ? (
                // eslint-disable-next-line @next/next/no-img-element -- tenant URL; domain allowlist unknown
                <img src={emailLogo} alt="" className="max-h-8 w-auto max-w-[140px] object-contain" />
              ) : (
                <span className="text-sm font-semibold">{businessName || name}</span>
              )}
            </div>
            <div className="m-3 rounded-lg p-3.5" style={{ background: "#FFFFFF", color: "#334155" }}>
              <p className="text-[13px] font-semibold" style={{ color: "#0F172A" }}>
                Your photos are ready
              </p>
              <p className="mt-1 text-xs">32 edited photos for 123 Main Street are in your portal.</p>
              <span
                className="mt-3 inline-block rounded-md px-3 py-1.5 text-[11px] font-semibold"
                style={{ background: emailTheme.accent, color: emailTheme.accentForeground }}
              >
                View your photos
              </span>
            </div>
            {footerText.trim() ? (
              <p className="line-clamp-2 px-4 pb-3 text-center text-[10px]" style={{ color: "#64748B" }}>
                {footerText}
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="space-y-2 px-3.5 pb-4">
        <EmailPreviewDialog
          primaryColor={primary}
          accentColor={accent}
          emailLogoUrl={emailLogoUrl}
          logoUrl={logoUrl}
          businessName={businessName}
          portalName={portalName}
          footerText={footerText}
          triggerLabel="Preview a sample email"
          triggerIcon={<Mail className="h-4 w-4" />}
          triggerClassName="h-11 w-full"
          showHint={false}
        />
        <p className="text-xs text-muted">
          {brandUnsaved
            ? "Previewing your changes across the app. Save to apply them for you and your clients."
            : "Changes preview across the app as you make them. Nothing changes for clients until you save."}
        </p>
      </div>
    </div>
  );
}
