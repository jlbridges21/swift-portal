import { Header, PageHeader } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { loadAcademyProgress } from "@/lib/academy/server";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import { AcademyCourse } from "@/components/academy/academy-course";

export const metadata = { title: "Academy" };

export default async function AcademyPage() {
  const { profile, tenant } = await requireAdminPage();
  const isStaff = profile.role === "staff";
  const initial = await loadAcademyProgress(profile.id);
  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={isStaff ? "staff" : "admin"} />
      <main className="app-page app-page-wide mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <PageHeader title="Academy" description="Learn ShootPortal in short videos, then earn your certificate." />
        <AcademyCourse
          initial={initial}
          holderName={profile.full_name?.trim() || profile.email}
          businessName={tenant.business.name ?? null}
          verifyOrigin={getPlatformApexOrigin()}
          isStaff={isStaff}
        />
      </main>
    </div>
  );
}
