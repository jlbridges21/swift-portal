import { requireSuperAdminPage } from "@/lib/admin-access";
import { PlatformW9Template } from "@/components/platform/platform-w9-template";
import { W9_REVISION_NOTE } from "@/lib/w9-fields";
import { listW9Templates } from "@/lib/w9-template";

export const dynamic = "force-dynamic";

export default async function PlatformW9Page() {
  await requireSuperAdminPage();
  const templates = await listW9Templates();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-heading">Form W-9 template</h1>
      <p className="mb-6 text-sm text-muted">{W9_REVISION_NOTE}</p>
      <PlatformW9Template templates={templates} />
    </main>
  );
}
