import { requireAdminPage } from "@/lib/admin-access";
import { SitesHeader } from "@/components/admin/sites/sites-tab-nav";
import { Header } from "@/components/layout/header";

/**
 * Sites: one place for the business's websites. Business Website embeds the existing website
 * builder; Property Websites lists every project's Marketing Kit website and links into the
 * existing editor. Owner admins only — staff are refused here and by middleware.
 */
export default async function AdminSitesLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage({ adminOnly: true });
  // Header renders in the Classic interface and steps aside inside the New shell.
  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="app-page app-page-wide mx-auto w-full max-w-6xl min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
        <SitesHeader />
        <div className="min-w-0">{children}</div>
      </main>
    </div>
  );
}
