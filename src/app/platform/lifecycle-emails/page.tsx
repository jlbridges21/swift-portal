import { requireSuperAdminPage } from "@/lib/admin-access";
import { createServiceClient } from "@/lib/supabase/server";
import { loadAllLifecycleTemplates } from "@/lib/platform-lifecycle";
import {
  LifecycleEmailsManager,
  type LifecycleSendView,
  type LifecycleTemplateView,
} from "@/components/platform/lifecycle-emails-manager";

export const dynamic = "force-dynamic";

export default async function PlatformLifecycleEmailsPage() {
  await requireSuperAdminPage();
  const templates = await loadAllLifecycleTemplates();
  const supabase = await createServiceClient();

  const { data: counts } = await supabase
    .from("platform_email_sends")
    .select("template_key")
    .eq("is_test", false);
  const sendCounts: Record<string, number> = {};
  for (const row of counts ?? []) {
    sendCounts[row.template_key] = (sendCounts[row.template_key] ?? 0) + 1;
  }

  const { data: recentRows } = await supabase
    .from("platform_email_sends")
    .select("id, business_id, template_key, event_date, is_test, recipient, subject, created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const businessIds = [...new Set((recentRows ?? []).map((r) => r.business_id))];
  const nameById = new Map<string, string>();
  if (businessIds.length) {
    const { data: named } = await supabase.from("businesses").select("id, name").in("id", businessIds);
    for (const b of named ?? []) nameById.set(b.id, b.name);
  }

  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const initialTemplates: LifecycleTemplateView[] = templates.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description,
    subject: t.subject,
    body: t.body,
    is_active: t.is_active,
    send_offset_days: t.send_offset_days,
    send_count: sendCounts[t.key] ?? 0,
    updated_at: t.updated_at,
  }));

  const initialRecent: LifecycleSendView[] = (recentRows ?? []).map((r) => ({
    ...r,
    business_name: nameById.get(r.business_id) ?? r.business_id,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <LifecycleEmailsManager
        initialTemplates={initialTemplates}
        initialRecent={initialRecent}
        businesses={(businesses ?? []).map((b) => ({ id: b.id, name: b.name }))}
      />
    </main>
  );
}
