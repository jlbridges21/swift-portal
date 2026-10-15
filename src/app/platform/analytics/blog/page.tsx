import { requireSuperAdminPage } from "@/lib/admin-access";
import { buildArticles } from "@/lib/analytics/aggregate";
import { loadDashboard, type DashboardSearchParams } from "@/lib/analytics/dashboard";
import { AnalyticsPageHeader } from "@/components/platform/analytics/page-header";
import { ArticleTable } from "@/components/platform/analytics/article-table";
import { Notice, Panel } from "@/components/platform/analytics/ui";

export const dynamic = "force-dynamic";

export default async function BlogAnalyticsPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const { range, loaded, lifecycles } = await loadDashboard(sp);
  const rows = buildArticles(loaded.current, lifecycles);
  const rangeQuery = `?range=${range.preset}${range.preset === "custom" ? `&from=${range.startDay}&to=${range.endDay}` : ""}`;
  return (
    <div className="space-y-6">
      <AnalyticsPageHeader title="Blog performance" range={range} loaded={loaded} />
      <Notice>
        Traffic columns are measured in this range. Conversion columns credit businesses that <strong>registered in this range</strong> using the
        selected model: <strong>first touch</strong> (first article read), <strong>last touch</strong> (last article before signup), or{" "}
        <strong>assisted</strong> (read at any point before signup). Registrations without consented tracking are Unknown and never credited to an article.
      </Notice>
      <Panel title={`All ${rows.length} articles`} description="Click an article for its traffic, sources, CTAs, and attributed accounts">
        <ArticleTable rows={rows} rangeQuery={rangeQuery} />
      </Panel>
    </div>
  );
}
