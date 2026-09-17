import { getTenantContext } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { LoggedInRequestForm } from "@/components/forms/logged-in-request-form";

export const dynamic = "force-dynamic";

export default async function LoggedInRequestPage() {
  const tenant = await getTenantContext();
  const settings = tenant ? await getAppSettings(tenant.businessId) : null;
  return (
    <LoggedInRequestForm
      instantPreliminaryEstimate={settings?.proposals.autoPreliminaryEstimate !== false}
    />
  );
}
