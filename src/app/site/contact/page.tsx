import type { Metadata } from "next";
import { SiteContact } from "@/components/website/site-pages";
import { SiteRequestForm } from "@/components/website/site-request-form";
import { SiteNavProvider } from "@/components/website/site-ui";
import { optionalPublicSite, requirePublicSite } from "@/lib/website/page-guard";
import { loadRequestFormProps } from "@/lib/website/request-form-props";
import { siteMetadata } from "@/lib/website/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const site = await optionalPublicSite();
  if (!site) return { title: "Not found", robots: { index: false, follow: false } };
  return siteMetadata(site, { path: "/contact", title: "Contact", description: site.view.contactIntro });
}

export default async function ContactPage() {
  const site = await requirePublicSite();
  const formProps = await loadRequestFormProps(site.businessId);
  return (
    <SiteNavProvider preview={false}>
      <SiteContact
        view={site.view}
        form={
          <SiteRequestForm
            template={site.view.template}
            {...formProps}
            portalOrigin={site.onWebsiteDomain ? site.portalOrigin : null}
          />
        }
      />
    </SiteNavProvider>
  );
}
