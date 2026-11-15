import { notFound } from "next/navigation";
import { AcademyCourse } from "@/components/academy/academy-course";
import { LessonView } from "@/components/academy/lesson-view";
import { HelpMenu } from "@/components/academy/help-menu";
import { WatchHowPill } from "@/components/academy/watch-how";
import { NextLessonCard } from "@/components/academy/next-lesson-card";
import { ACADEMY_LESSONS } from "@/lib/academy/catalog";
import type { AcademyProgressState } from "@/lib/academy/server";
import { AcademyProgressProvider } from "@/components/academy/academy-progress";
import { AdminCapabilitiesProvider } from "@/components/admin/admin-capabilities-context";
import { AdminChromeProviders } from "@/components/admin/admin-chrome-providers";
import { MenuDemo } from "./menu-demo";

/**
 * Dev-only harness for the Academy UI with sample progress (no sign-in, no database).
 * /dev/academy-harness?view=course | lesson | done | shell | menu  (&pill=V00 picks the shell's Watch how lesson)
 */
export default async function AcademyHarness({ searchParams }: { searchParams: Promise<{ view?: string; pill?: string; lesson?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const view = sp.view ?? "course";
  const now = new Date().toISOString();
  const doneKeys = view === "done" ? ACADEMY_LESSONS.map((l) => l.key) : ["V00", "V01", "V02", "V03", "V04", "V05", "V06"];
  const sample: AcademyProgressState = {
    setupRequired: false,
    certificate: null,
    lessons: {
      ...Object.fromEntries(doneKeys.map((k) => [k, { percent: 100, position: 0, completedAt: now }])),
      ...(view === "done" ? {} : { V07: { percent: 40, position: 71, completedAt: null } }),
    },
  };
  if (view === "menu") return <MenuDemo />;
  if (view === "shell") {
    // The real New-interface shell (sidebar + top bar) with sample progress.
    return (
      <AcademyProgressProvider initial={sample}>
        <AdminCapabilitiesProvider showPartner={false} partnerNavLabel="" partnerNavHref="" userRole="admin">
          <AdminChromeProviders
            experience={{ mode: "new", phase: "classic_only", canSwitch: false, banner: null }}
            shellUser={{ name: "Jordan Blake", avatarUrl: null, businessName: "Your Business" }}
          >
            <main className="space-y-4 p-6">
              <WatchHowPill lessonKey={sp.pill ?? "V07"} />
              <NextLessonCard />
            </main>
          </AdminChromeProviders>
        </AdminCapabilitiesProvider>
      </AcademyProgressProvider>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center gap-3 border-b border-border bg-card px-6">
        <b className="text-heading">Academy harness</b>
        <span className="text-sm text-muted">sample data · view={view}</span>
        <div className="ml-auto flex items-center gap-2">
          <WatchHowPill />
          <HelpMenu />
        </div>
      </div>
      <main className="mx-auto max-w-[1440px] px-3 py-6 sm:px-6 lg:px-8">
        {view === "lesson" ? (
          <LessonView lesson={ACADEMY_LESSONS.find((l) => l.key === sp.lesson) ?? ACADEMY_LESSONS[7]} initial={sample} autoplay={false} canTry />
        ) : (
          <>
            <div className="mb-4">
              <NextLessonCard />
            </div>
            <AcademyCourse
              initial={sample}
              holderName="Jordan Blake"
              businessName="Your Business"
              verifyOrigin="https://www.shootportal.app"
              isStaff={false}
            />
          </>
        )}
      </main>
    </div>
  );
}
