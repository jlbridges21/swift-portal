import Link from "next/link";
import { BadgeCheck, CircleX } from "lucide-react";
import { findAcademyCertificate } from "@/lib/academy/server";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import { CertificateDocument } from "@/components/academy/certificate-dialog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const cert = await findAcademyCertificate((await params).code);
  return {
    title: cert ? `${cert.holderName} is ShootPortal Certified` : "Certificate not found",
    robots: { index: false, follow: false },
  };
}

/** Public page that confirms a ShootPortal Academy certificate is real. */
export default async function VerifyAcademyCertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cert = await findAcademyCertificate(code);
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        {cert ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-white">
                <BadgeCheck className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">This certificate is valid</h1>
                <p className="text-sm text-slate-500">
                  Issued by ShootPortal Academy to {cert.holderName}
                  {cert.businessName ? ` of ${cert.businessName}` : ""}.
                </p>
              </div>
            </div>
            <CertificateDocument
              holderName={cert.holderName}
              businessName={cert.businessName}
              cert={cert}
              verifyOrigin={getPlatformApexOrigin()}
            />
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <CircleX className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
            <h1 className="mt-3 text-xl font-bold text-slate-900">We couldn&apos;t find that certificate</h1>
            <p className="mt-1 text-sm text-slate-500">
              Check the code ({code.toUpperCase()}). Certificate codes look like SPA-XXXX-XXXX.
            </p>
          </div>
        )}
        <p className="mt-6 text-center text-sm text-slate-500">
          ShootPortal is the all-in-one client portal for real estate photographers and drone pilots.{" "}
          <Link href="https://shootportal.app" className="font-semibold text-slate-900 hover:underline">
            shootportal.app
          </Link>
        </p>
      </div>
    </main>
  );
}
