"use client";

import { useEffect, useState } from "react";
import { Award, BadgeCheck, Check, Copy, Download, Lock, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACADEMY_LESSON_COUNT } from "@/lib/academy/catalog";
import type { AcademyCertificate } from "@/lib/academy/server";
import { cn } from "@/lib/utils";

export function verifyUrlFor(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/academy/verify/${code}`;
}

function linkedInAddUrl(cert: AcademyCertificate, verifyUrl: string): string {
  const issued = new Date(cert.issuedAt);
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: "ShootPortal Certified",
    organizationName: "ShootPortal",
    issueYear: String(issued.getUTCFullYear()),
    issueMonth: String(issued.getUTCMonth() + 1),
    certUrl: verifyUrl,
    certId: cert.code,
  });
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}

function issuedLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** The certificate itself (also used, locked, as a preview). */
export function CertificateDocument({
  holderName,
  businessName,
  cert,
  verifyOrigin,
}: {
  holderName: string;
  businessName: string | null;
  cert: AcademyCertificate | null;
  verifyOrigin: string;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-accent via-accent to-slate-950 p-2.5 sm:p-3">
      <div className="relative overflow-hidden rounded-lg bg-white px-5 py-8 text-center text-slate-900 sm:px-12 sm:py-10">
        <div className="pointer-events-none absolute -left-40 -top-40 h-80 w-80 rounded-full border-[36px] border-slate-100" aria-hidden />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-80 w-80 rounded-full border-[36px] border-slate-100" aria-hidden />
        <div className="relative">
          <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Award className="h-6 w-6" aria-hidden />
          </span>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.3em] text-accent">ShootPortal Academy</p>
          <h3 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-4xl">Certificate of Completion</h3>
          <p className="mt-1 text-sm text-slate-500">This certifies that</p>
          <p className="mt-4 break-words text-3xl font-light italic tracking-tight sm:text-5xl">{holderName}</p>
          <div className="mx-auto mt-3 h-px w-3/4 max-w-md bg-slate-200" />
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
            {businessName ? (
              <>
                of <b className="text-slate-900">{businessName}</b> has completed{" "}
              </>
            ) : (
              "has completed "
            )}
            all {cert?.lessonCount ?? ACADEMY_LESSON_COUNT} lessons of ShootPortal Academy and is a{" "}
            <b className="text-accent">ShootPortal Certified</b> operator.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 text-xs text-slate-500 sm:flex-row sm:items-end sm:justify-between sm:text-left">
            <div>
              <p className="text-sm font-bold text-slate-900">{cert ? issuedLabel(cert.issuedAt) : "Date completed"}</p>
              {cert ? "Date completed" : "Appears when you finish"}
            </div>
            {cert ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                <BadgeCheck className="h-4 w-4" aria-hidden /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-500">
                <Lock className="h-4 w-4" aria-hidden /> Locked
              </span>
            )}
            <div className="sm:text-right">
              <p className="text-sm font-bold text-slate-900">{cert ? cert.code : "SPA-XXXX-XXXX"}</p>
              Verify at {verifyOrigin.replace(/^https?:\/\//, "")}/academy/verify
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Certificate dialog: a locked preview while lessons remain, the celebration and sharing
 * actions once it is earned.
 */
export function CertificateDialog({
  open,
  onClose,
  holderName,
  businessName,
  cert,
  remaining,
  verifyOrigin,
}: {
  open: boolean;
  onClose: () => void;
  holderName: string;
  businessName: string | null;
  cert: AcademyCertificate | null;
  remaining: number;
  verifyOrigin: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const verifyUrl = cert ? verifyUrlFor(verifyOrigin, cert.code) : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", verifyUrl);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="cert-title">
      <button type="button" className="absolute inset-0 bg-slate-950/55" onClick={onClose} aria-label="Close" />
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-4xl overflow-y-auto rounded-3xl bg-card p-4 shadow-2xl sm:p-7">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-subtle hover:text-heading"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="mb-4 flex items-center gap-3 pr-10">
          <span
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
              cert ? "bg-emerald-600 text-white" : "bg-accent-subtle text-accent"
            )}
          >
            {cert ? <Award className="h-5 w-5" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <h2 id="cert-title" className="text-lg font-extrabold tracking-tight text-heading sm:text-2xl">
              {cert ? `Congratulations, ${holderName.split(" ")[0]}! You're ShootPortal Certified.` : "Your ShootPortal certificate"}
            </h2>
            <p className="text-sm text-muted">
              {cert
                ? `You finished all ${cert.lessonCount} lessons of ShootPortal Academy.`
                : `Finish ${remaining} more lesson${remaining === 1 ? "" : "s"} to earn it. Here's what it will look like.`}
            </p>
          </div>
        </div>

        <CertificateDocument holderName={holderName} businessName={businessName} cert={cert} verifyOrigin={verifyOrigin} />

        {cert ? (
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Button variant="accent" className="gap-2" onClick={() => window.location.assign("/api/academy/certificate/pdf")}>
              <Download className="h-4 w-4" aria-hidden /> Download PDF
            </Button>
            <a href={linkedInAddUrl(cert, verifyUrl)} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="gap-2">
                <Share2 className="h-4 w-4" aria-hidden /> Add to LinkedIn
              </Button>
            </a>
            <Button variant="outline" className="gap-2" onClick={copy}>
              {copied ? <Check className="h-4 w-4 text-emerald-600" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              {copied ? "Link copied" : "Copy verify link"}
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex justify-end">
            <Button variant="outline" onClick={onClose}>
              Keep learning
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
