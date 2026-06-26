import { BRAND, LOGO_URL } from "@/lib/brand";
import { PROJECT_STATUSES } from "@/lib/constants";

export type PremiumEmailTemplate =
  | "proposal_ready"
  | "proposal_updated"
  | "shoot_proposed"
  | "shoot_confirmed"
  | "deliverables_ready"
  | "revision_response"
  | "payment_requested"
  | "payment_received"
  | "project_complete"
  | "general";

export interface PremiumEmailContent {
  template: PremiumEmailTemplate;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl?: string;
  secondaryInfo?: string;
  progressStep?: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildProgressIndicator(currentStep: number, accentColor: string): string {
  const steps = PROJECT_STATUSES.map((s) => s.clientLabel);
  const cells = steps
    .map((label, index) => {
      const active = index === currentStep;
      const completed = index < currentStep;
      const bg = active ? accentColor : completed ? "#0F172A" : "#E2E8F0";
      const color = active ? accentColor : completed ? "#0F172A" : "#94A3B8";
      const width = Math.floor(100 / steps.length);
      return `
        <td style="padding:2px;width:${width}%;">
          <div style="height:6px;border-radius:999px;background:${bg};"></div>
          <p style="margin:6px 0 0;font-size:9px;line-height:1.3;color:${color};text-align:center;font-weight:${active ? "700" : "500"};">
            ${escapeHtml(label)}
          </p>
        </td>`;
    })
    .join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:28px;">
      <tr>${cells}</tr>
    </table>`;
}

export interface EmailBrandingOptions {
  portalName?: string;
  businessName?: string;
  logoUrl?: string;
  footerText?: string;
  accentColor?: string;
  primaryColor?: string;
}

export function buildPremiumEmailHtml(options: {
  title: string;
  body: string;
  projectName?: string;
  secondaryInfo?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  progressStep?: number;
  branding?: EmailBrandingOptions;
}): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(
    /\/$/,
    ""
  );
  const portalName = options.branding?.portalName ?? BRAND.portalName;
  const businessName = options.branding?.businessName ?? BRAND.name;
  const logoUrl = options.branding?.logoUrl ?? LOGO_URL;
  const footerText =
    options.branding?.footerText ??
    "You received this email because you have a project with Swift Aerial Media.";
  const accentColor = options.branding?.accentColor ?? "#3B82F6";
  const primaryColor = options.branding?.primaryColor ?? "#0F172A";
  const title = escapeHtml(options.title);
  const body = escapeHtml(options.body).replace(/\n/g, "<br/>");
  const projectName = options.projectName ? escapeHtml(options.projectName) : "";
  const secondary = options.secondaryInfo ? escapeHtml(options.secondaryInfo) : "";
  const ctaLabel = options.ctaLabel ? escapeHtml(options.ctaLabel) : "";
  const ctaUrl = options.ctaUrl ? escapeHtml(options.ctaUrl) : "";

  const projectPill = projectName
    ? `<p style="margin:0 0 20px;display:inline-block;background:#F1F5F9;color:#0F172A;font-size:13px;font-weight:600;padding:8px 14px;border-radius:999px;">${projectName}</p>`
    : "";

  const secondaryBlock = secondary
    ? `<p style="margin:20px 0 0;color:#64748B;font-size:14px;line-height:1.6;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:14px 16px;">${secondary}</p>`
    : "";

  const progress =
    typeof options.progressStep === "number"
      ? buildProgressIndicator(
          Math.max(0, Math.min(options.progressStep, PROJECT_STATUSES.length - 1)),
          accentColor
        )
      : "";

  const cta =
    ctaLabel && ctaUrl
      ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0 0;">
          <tr><td style="border-radius:14px;background:${accentColor};">
            <a href="${ctaUrl}" style="display:inline-block;padding:16px 32px;color:#FFFFFF;font-size:16px;font-weight:700;text-decoration:none;letter-spacing:-0.01em;">${ctaLabel}</a>
          </td></tr>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <!--[if mso]><style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F1F5F9;padding:24px 12px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;">
        <tr><td style="background:${primaryColor};border-radius:20px 20px 0 0;padding:28px 32px 24px;text-align:center;">
          <img src="${logoUrl}" alt="${escapeHtml(businessName)}" width="160" style="display:block;margin:0 auto 14px;max-width:160px;height:auto;border:0;" />
          <p style="margin:0;color:#94A3B8;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(portalName)}</p>
        </td></tr>
        <tr><td style="background:#FFFFFF;padding:36px 32px 32px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
          <h1 style="margin:0 0 12px;color:#0F172A;font-size:28px;font-weight:700;line-height:1.25;letter-spacing:-0.03em;">${title}</h1>
          ${projectPill}
          <p style="margin:0;color:#475569;font-size:17px;line-height:1.7;">${body}</p>
          ${secondaryBlock}
          ${progress}
          ${cta}
        </td></tr>
        <tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 20px 20px;padding:28px 32px;text-align:center;">
          <p style="margin:0 0 6px;color:#0F172A;font-size:15px;font-weight:700;">${escapeHtml(businessName)}</p>
          <p style="margin:0 0 14px;color:#64748B;font-size:14px;line-height:1.6;">Questions?<br/>Reply to this email or visit ${escapeHtml(portalName)}.</p>
          <p style="margin:0 0 10px;color:#94A3B8;font-size:12px;line-height:1.5;">
            ${escapeHtml(footerText)}
          </p>
          <a href="${appUrl}" style="color:${accentColor};font-size:13px;font-weight:600;text-decoration:none;">Open ${escapeHtml(portalName)} →</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export const EMAIL_TYPE_LABELS: Record<string, string> = {
  quote_sent: "Proposal Email",
  proposal_changes: "Proposal Updated Email",
  shoot_proposed: "Shoot Time Email",
  schedule_change_requested: "Schedule Update Email",
  status_changed: "Project Update Email",
  deliverables_uploaded: "Deliverables Email",
  revision_requested: "Revision Response Email",
  invoice_available: "Payment Request Email",
  payment_confirmed: "Payment Received Email",
  test: "Test Email",
};

export const EMAIL_EVENT_ICONS: Record<string, string> = {
  sent: "📨",
  delivered: "✅",
  opened: "👀",
  clicked: "🔗",
  bounced: "⚠️",
  complained: "⚠️",
};

export const EMAIL_EVENT_LABELS: Record<string, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  clicked: "CTA Clicked",
  bounced: "Bounced",
  complained: "Marked as Spam",
};
