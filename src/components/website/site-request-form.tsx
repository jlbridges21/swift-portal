"use client";

import type { CSSProperties } from "react";
import { RequestFormBody } from "@/components/forms/public-request-form";
import type { WebsiteTemplateId } from "@/lib/website/settings";

/**
 * The existing ShootPortal request form, dressed for the website template. The fields, validation,
 * /api/request submission, estimates, notifications and client matching are unchanged.
 */
export function SiteRequestForm({
  template,
  instantPreliminaryEstimate,
  signedInClient,
  portalOrigin,
  disabled = false,
}: {
  template: WebsiteTemplateId;
  instantPreliminaryEstimate: boolean;
  signedInClient: { name: string; email: string } | null;
  portalOrigin: string | null;
  disabled?: boolean;
}) {
  // Luxury is a dark page: switch the shared form controls to their dark surface.
  const dark = template === "luxury";
  const vars = dark
    ? ({
        "--color-card": "#1B1916",
        "--color-background": "#141210",
        "--color-border": "rgba(255,255,255,0.14)",
        "--color-foreground": "#EDE7DE",
        "--color-heading": "#EDE7DE",
        "--color-muted": "#A59F95",
        "--color-subtle": "#1B1916",
        colorScheme: "dark",
      } as CSSProperties)
    : undefined;
  return (
    <div data-surface={dark ? "dark" : undefined} style={vars} className={dark ? "text-[#EDE7DE]" : "text-[#171717]"}>
      <RequestFormBody
        instantPreliminaryEstimate={instantPreliminaryEstimate}
        signedInClient={signedInClient}
        portalOrigin={portalOrigin}
        disabled={disabled}
      />
    </div>
  );
}
