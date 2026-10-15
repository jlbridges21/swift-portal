import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadBusinessAttribution } from "@/lib/analytics/report-data";
import { channelLabel } from "@/components/platform/analytics/ui";
import { formatDate } from "@/lib/utils";

/** Super-admin only: acquisition context for one business (/platform/businesses/[id]). */
export async function BusinessAcquisitionCard({
  businessId,
  createdVia,
  createdAt,
  trialEndsAt,
  subscriptionStatus,
}: {
  businessId: string;
  createdVia: string;
  createdAt: string;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
}) {
  const data = await loadBusinessAttribution(businessId).catch(() => null);
  const a = data?.attribution;
  const ok = a?.status === "attributed";
  const rows: [string, string][] = [
    ["First-touch source", ok ? `${channelLabel(a.ft_channel)}${a.ft_utm_source ? ` · ${a.ft_utm_source}` : a.ft_referrer_host ? ` · ${a.ft_referrer_host}` : ""}` : "Unknown"],
    ["First landing page", ok ? a.ft_landing_path ?? "—" : "Unknown"],
    ["First blog article", ok ? a.first_article_slug ?? "None" : "Unknown"],
    ["Last-touch source", ok ? `${channelLabel(a.lt_channel)}${a.lt_utm_source ? ` · ${a.lt_utm_source}` : a.lt_referrer_host ? ` · ${a.lt_referrer_host}` : ""}` : "Unknown"],
    ["Last landing page", ok ? a.lt_landing_path ?? "—" : "Unknown"],
    ["Signup CTA", ok ? (a.signup_cta_id ? `${a.signup_cta_id} (${a.signup_cta_location ?? "?"})` : "None recorded") : "Unknown"],
    ["Account created", formatDate(createdAt)],
    ["Trial start", trialEndsAt && createdVia === "signup" ? `${formatDate(createdAt)} (ends ${formatDate(trialEndsAt)})` : "—"],
    ["First project", data?.firstProjectAt ? formatDate(data.firstProjectAt) : "—"],
    ["Paid subscription start", data?.firstPaidAt ? formatDate(data.firstPaidAt) : "—"],
    ["Subscription status", subscriptionStatus ?? "—"],
  ];
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Acquisition</CardTitle>
      </CardHeader>
      <CardContent>
        {!data?.tablesReady ? (
          <p className="mb-3 text-xs text-muted">Analytics tables not installed (migration v103). Source fields show Unknown.</p>
        ) : !ok ? (
          <p className="mb-3 text-xs text-muted">
            {createdVia !== "signup"
              ? "Created in the platform console, so there is no marketing attribution."
              : a
                ? "No consented tracking before signup, so the source is Unknown."
                : "Registered before analytics was installed, so the source is Unknown."}
          </p>
        ) : null}
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-border/60 py-1">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right font-medium text-heading">{v}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
