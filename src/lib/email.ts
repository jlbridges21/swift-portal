import { Resend } from "resend";
import { BRAND } from "@/lib/brand";

let resend: Resend | null = null;

function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Swift Portal <portal@swiftaerialmedia.com>";

function emailLayout(content: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Swift Portal</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:#0F172A;padding:28px 32px;">
          <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">${BRAND.name}</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;font-weight:500;">Swift Portal</p>
        </td></tr>
        <tr><td style="padding:32px 32px 28px;">
          ${content}
        </td></tr>
        <tr><td style="padding:20px 32px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;color:#64748b;font-size:12px;line-height:1.5;text-align:center;">
            You received this because you have a project with Swift Aerial Media.
          </p>
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
            <a href="${appUrl}" style="color:#3B82F6;text-decoration:none;font-weight:600;">Open Swift Portal</a>
            &nbsp;·&nbsp; ${BRAND.name}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
}

export async function sendBrandedEmail(options: SendEmailOptions): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log("[email skipped — no RESEND_API_KEY]", options.subject, "→", options.to);
    return false;
  }

  const cta =
    options.ctaLabel && options.ctaUrl
      ? `<p style="margin:28px 0 0;"><a href="${options.ctaUrl}" style="display:inline-block;background:#3B82F6;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">${options.ctaLabel}</a></p>`
      : "";

  const html = emailLayout(`
    <h1 style="margin:0 0 16px;color:#0F172A;font-size:24px;font-weight:700;line-height:1.3;letter-spacing:-0.02em;">${options.title}</h1>
    <p style="margin:0;color:#475569;font-size:16px;line-height:1.65;">${options.body}</p>
    ${cta}
  `);

  try {
    await client.emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html,
    });
    return true;
  } catch (err) {
    console.error("[email] send failed:", options.subject, "→", options.to, err);
    return false;
  }
}
