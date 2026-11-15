import { notFound } from "next/navigation";
import { Header, PageHeader } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { academyLessonBySlug } from "@/lib/academy/catalog";
import { loadAcademyProgress } from "@/lib/academy/server";
import { staffMayAccessAdminPath } from "@/lib/staff-access";
import { LessonView } from "@/components/academy/lesson-view";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const lesson = academyLessonBySlug((await params).slug);
  return { title: lesson ? `${lesson.title} · Academy` : "Academy" };
}

export default async function AcademyLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ autoplay?: string }>;
}) {
  const { profile } = await requireAdminPage();
  const lesson = academyLessonBySlug((await params).slug);
  if (!lesson) notFound();
  const sp = await searchParams;
  const initial = await loadAcademyProgress(profile.id);
  const tryPath = lesson.tryHref?.split("#")[0] ?? "";
  const canTry = Boolean(tryPath) && (tryPath.startsWith("/admin") ? staffMayAccessAdminPath(profile, tryPath) : profile.role !== "staff");
  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={profile.role === "staff" ? "staff" : "admin"} />
      <main className="app-page app-page-wide mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        {/* New interface: lesson title in the top bar. Classic: the lesson view shows its own heading. */}
        <PageHeader title={lesson.title} crumbs={[{ label: "Academy", href: "/admin/academy" }]} className="hidden" />
        <LessonView lesson={lesson} initial={initial} autoplay={sp.autoplay === "1"} canTry={canTry} />
      </main>
    </div>
  );
}
