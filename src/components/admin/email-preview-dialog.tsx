"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type EmailPreviewDraft = {
  primaryColor: string;
  accentColor: string;
  emailLogoUrl: string;
  logoUrl: string;
  businessName: string;
  portalName: string;
  footerText: string;
};

/**
 * Renders the real deliverables email for the branding currently on the form.
 * The 600px email table scrolls sideways inside the modal on a phone.
 */
export function EmailPreviewDialog(draft: EmailPreviewDraft) {
  const [open, setOpen] = useState(false);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    primaryColor,
    accentColor,
    emailLogoUrl,
    logoUrl,
    businessName,
    portalName,
    footerText,
  } = draft;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch("/api/admin/email/preview", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify({
              primaryColor,
              accentColor,
              emailLogoUrl,
              logoUrl,
              businessName,
              portalName,
              footerText,
            }),
          });
          if (!res.ok) throw new Error("Could not render the email preview.");
          const next = await res.text();
          if (controller.signal.aborted) return;
          setHtml(next);
          setError(null);
        } catch (err) {
          if (controller.signal.aborted) return;
          setError(err instanceof Error ? err.message : "Could not render the email preview.");
        }
      })();
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, primaryColor, accentColor, emailLogoUrl, logoUrl, businessName, portalName, footerText]);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Preview email
      </Button>
      <p className="text-xs text-muted">
        Shows a sample deliverables email with the logo and colors on this page. Nothing is sent.
      </p>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Email preview"
        className="max-w-3xl min-w-0"
      >
        <p className="mb-3 text-xs text-muted sm:hidden">
          Swipe sideways to see the full email. It is 600px wide, the same width clients receive.
        </p>
        {error ? <p className="text-sm text-amber-800">{error}</p> : null}
        {!html && !error ? <p className="text-sm text-muted">Rendering preview…</p> : null}
        {html ? (
          <div className="w-full max-w-full overflow-x-auto">
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={html}
              className="h-[720px] w-[600px] border-0 bg-[#F1F5F9]"
            />
          </div>
        ) : null}
      </Modal>
    </>
  );
}
