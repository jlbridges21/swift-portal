"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ServiceSelect } from "@/components/forms/service-select";
import { AddressFields } from "@/components/forms/address-fields";
import { CheckCircle2, Loader2, UserRound } from "lucide-react";

/**
 * The project request form itself — fields, validation, submission to /api/request and the
 * confirmation hand-off. Used by /request (inside the portal card) and embedded on the Business
 * Website contact page and /request when the website is live. One form, one workflow.
 */
export function RequestFormBody({
  instantPreliminaryEstimate = true,
  signedInClient = null,
  disabled = false,
  portalOrigin = null,
  onSubmittedInline,
}: {
  instantPreliminaryEstimate?: boolean;
  signedInClient?: { name: string; email: string } | null;
  /** Editor preview: show the form without allowing a submission. */
  disabled?: boolean;
  /**
   * Set on a Business Website domain: the confirmation page (account activation) lives on the
   * client portal address, so we navigate there instead of staying on the website host.
   */
  portalOrigin?: string | null;
  onSubmittedInline?: (projectId: string) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submittedInline, setSubmittedInline] = useState<string | null>(null);
  const inquiryMode = !instantPreliminaryEstimate;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading || disabled) return;
    setLoading(true);
    setError("");

    const data = Object.fromEntries(new FormData(e.currentTarget).entries());

    try {
      const res = await fetch("/api/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        projectId?: string;
        thankYouUrl?: string | null;
      };

      if (!res.ok) {
        throw new Error(body.message || body.error || "We couldn't submit your request. Please try again.");
      }

      if (body.thankYouUrl) {
        if (portalOrigin) {
          window.location.assign(`${portalOrigin.replace(/\/$/, "")}${body.thankYouUrl}`);
        } else {
          router.push(body.thankYouUrl);
        }
        return;
      }
      // Saved, but no confirmation link could be built — confirm inline.
      setSubmittedInline(body.projectId ?? "");
      onSubmittedInline?.(body.projectId ?? "");
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  if (submittedInline !== null && !onSubmittedInline) {
    return (
      <div className="space-y-3 py-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h3 className="text-xl font-semibold text-heading">Request received</h3>
        <p className="text-muted">
          Thanks! Your request is in. You don&apos;t need to do anything else — check your email for a confirmation.
        </p>
      </div>
    );
  }

  const loginHref = portalOrigin ? `${portalOrigin.replace(/\/$/, "")}/login?redirect=/dashboard/request` : "/login?redirect=/dashboard/request";

  return (
              <form onSubmit={handleSubmit} className="space-y-6">
                <fieldset disabled={disabled} className="contents">
                {signedInClient ? (
                  <section className="flex items-start gap-3 rounded-xl border border-border bg-slate-50 p-4 surface-dark:bg-subtle">
                    <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-heading">
                        Submitting as {signedInClient.name || signedInClient.email}
                      </p>
                      <p className="truncate text-muted">{signedInClient.email}</p>
                      <p className="mt-1 text-xs text-muted">
                        This request will be added to your portal account.
                      </p>
                    </div>
                  </section>
                ) : (
                  <section className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Contact</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="first_name">First Name *</Label>
                        <Input id="first_name" name="first_name" required placeholder="John" autoComplete="given-name" className="min-h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="last_name">Last Name *</Label>
                        <Input id="last_name" name="last_name" required placeholder="Smith" autoComplete="family-name" className="min-h-11" />
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          inputMode="email"
                          required
                          placeholder="john@example.com"
                          autoComplete="email"
                          className="min-h-11"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(555) 123-4567" className="min-h-11" />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="company">Company</Label>
                        <Input id="company" name="company" autoComplete="organization" placeholder="Brokerage or company" className="min-h-11" />
                      </div>
                    </div>
                  </section>
                )}

                <section className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Project</h3>
                  <AddressFields />
                  {inquiryMode ? (
                    <div className="space-y-2">
                      <Label htmlFor="preferred_date">Preferred Date</Label>
                      <Input id="preferred_date" name="preferred_date" type="date" className="min-h-11" />
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="service_requested">Service Requested *</Label>
                        <ServiceSelect id="service_requested" name="service_requested" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="preferred_date">Preferred Date</Label>
                        <Input id="preferred_date" name="preferred_date" type="date" className="min-h-11" />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="notes">{inquiryMode ? "Description" : "Project Notes"}</Label>
                    <Textarea
                      id="notes"
                      name="notes"
                      placeholder={
                        inquiryMode
                          ? "Tell us about the property, what you need, or any special requirements..."
                          : "Tell us about the property, deliverables, or special requirements..."
                      }
                      rows={4}
                    />
                  </div>
                </section>

                {error && (
                  <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" variant="accent" size="lg" className="min-h-12 w-full" disabled={loading || disabled}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {inquiryMode ? "Sending..." : "Submitting..."}
                    </>
                  ) : inquiryMode ? (
                    "Send Inquiry"
                  ) : (
                    "Submit Request"
                  )}
                </Button>
                {!signedInClient && (
                  <p className="text-center text-xs text-muted">
                    Already have a portal account?{" "}
                    <Link href={loginHref} className="font-medium text-accent hover:underline">
                      Log in
                    </Link>{" "}
                    to submit from your portal.
                  </p>
                )}
                </fieldset>
              </form>
  );
}

export function PublicRequestForm({
  instantPreliminaryEstimate = true,
  signedInClient = null,
}: {
  /** When false, inquiry mode: no service field, no estimate language. */
  instantPreliminaryEstimate?: boolean;
  /** Signed-in client of this business: contact details come from their account. */
  signedInClient?: { name: string; email: string } | null;
}) {
  const [submittedInline, setSubmittedInline] = useState<string | null>(null);
  const inquiryMode = !instantPreliminaryEstimate;

  if (submittedInline !== null) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 px-4 py-12 sm:px-6 lg:px-8">
          <Card className="mx-auto max-w-xl text-center shadow-sm">
            <CardContent className="space-y-3 py-10">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h1 className="text-2xl font-bold text-heading">Request received</h1>
              <p className="text-muted">
                Thanks! Your request is in. You don&apos;t need to do anything else — check your email for a
                confirmation.
              </p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-heading sm:text-3xl">
              {inquiryMode ? "Send an Inquiry" : "Request a Shoot"}
            </h1>
            <p className="mt-2 text-muted">
              {inquiryMode
                ? "Tell us about your property. No account needed."
                : "Tell us about your project. No account needed — it takes about a minute."}
            </p>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>{inquiryMode ? "Project Inquiry" : "Project Request"}</CardTitle>
              <CardDescription>
                {inquiryMode
                  ? "We'll review your inquiry and follow up by email."
                  : "You'll see a preliminary estimate as soon as you submit."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RequestFormBody
                instantPreliminaryEstimate={instantPreliminaryEstimate}
                signedInClient={signedInClient}
                onSubmittedInline={(id) => {
                  setSubmittedInline(id);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
