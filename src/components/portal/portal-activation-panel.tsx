"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LogIn,
  Mail,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import type { ThankYouMode } from "@/lib/portal-activation";

const MIN_LENGTH = 8;

type Props = {
  token: string;
  mode: ThankYouMode;
  maskedEmail: string | null;
  /** Portal path for login / signed-in links. */
  projectPath: string;
  businessName: string;
  /** "thank_you" = optional upsell under a request; "activate" = the page's main job. */
  context?: "thank_you" | "activate";
};

export function PortalActivationPanel({
  token,
  mode: initialMode,
  maskedEmail,
  projectPath,
  businessName,
  context = "thank_you",
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<ThankYouMode>(initialMode);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);

  const loginHref = `/login?redirect=${encodeURIComponent(projectPath)}`;

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/portal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirm_password: confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
        email?: string;
        next?: string;
      };
      if (!res.ok) {
        if (data.reason === "already_active") setMode("login");
        else if (data.reason === "requires_email_link" || data.reason === "expired" || data.reason === "email_changed") {
          setMode("email_link");
        }
        throw new Error(data.error || "Couldn't create your account. Please try again.");
      }

      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email!,
        password,
      });
      if (signInError) {
        router.push(`/login?redirect=${encodeURIComponent(data.next || projectPath)}&message=${encodeURIComponent("Account created. Please sign in.")}`);
        return;
      }
      router.push(data.next || projectPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function resend() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setResendNotice(null);
    try {
      const res = await fetch("/api/portal/activation/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reason?: string; sentTo?: string };
      if (!res.ok) {
        if (data.reason === "already_active") setMode("login");
        throw new Error(data.error || "Couldn't send a new link. Please try again.");
      }
      setResendNotice(`New activation link sent to ${data.sentTo || maskedEmail || "your email"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const optionalTag =
    context === "thank_you" ? (
      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 surface-dark:bg-subtle surface-dark:text-muted">
        Optional
      </span>
    ) : null;

  if (mode === "none") return null;

  const benefits = [
    { icon: LayoutDashboard, title: "Track your whole project", body: "Every step, from booking to delivery." },
    { icon: FileCheck2, title: "See your official proposal", body: "Review and approve it in one click." },
    { icon: CreditCard, title: "Pay securely online", body: "Card or bank, with receipts saved." },
    { icon: MessageSquare, title: `Message ${businessName}`, body: "One thread, no lost emails." },
    { icon: CalendarClock, title: "Manage your appointment", body: "See the time, reschedule when allowed." },
    { icon: Download, title: "Download your media", body: "Photos and videos the moment they're ready." },
  ];

  if (mode === "signed_in") {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-heading">It&apos;s in your portal</h2>
        <p className="mt-1 text-sm text-muted">This request was added to your account.</p>
        <Link href={projectPath} className="mt-4 block">
          <Button variant="accent" size="lg" className="min-h-12 w-full">
            View My Project <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>
    );
  }

  if (mode === "login") {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <LogIn className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
          <div>
            <h2 className="text-lg font-semibold text-heading">You already have a portal account</h2>
            <p className="mt-1 text-sm text-muted">
              Log in{maskedEmail ? ` with ${maskedEmail}` : ""} to track this request, review your estimate, and
              message {businessName}.
            </p>
          </div>
        </div>
        <Link href={loginHref} className="mt-4 block">
          <Button variant="accent" size="lg" className="min-h-12 w-full">
            Log In to View My Project
          </Button>
        </Link>
      </section>
    );
  }

  if (mode === "email_link") {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
            <Mail className="h-5 w-5 text-accent" aria-hidden /> Activate your client portal
          </h2>
          {optionalTag}
        </div>
        <p className="mt-2 text-sm text-muted">
          {context === "activate"
            ? "This link can't be used anymore. We can email a fresh, secure link to the address on file."
            : `For your security, portal access for this email is activated from your inbox. We've sent a secure link to ${maskedEmail || "your email"}.`}
        </p>
        {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {resendNotice ? (
          <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{resendNotice}</p>
        ) : null}
        <Button
          type="button"
          variant={context === "activate" ? "accent" : "outline"}
          size="lg"
          className="mt-4 min-h-12 w-full"
          disabled={busy}
          onClick={() => void resend()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {context === "activate" ? "Email Me a New Link" : "Resend Activation Email"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">
          Already set a password?{" "}
          <Link href={loginHref} className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      </section>
    );
  }

  const featured = context === "thank_you";

  return (
    <section
      id="create-account"
      className={
        featured
          ? "scroll-mt-24 overflow-hidden rounded-2xl border border-accent/30 bg-card shadow-md ring-1 ring-accent/10"
          : "rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
      }
    >
      <div className={featured ? "grid md:grid-cols-[1.1fr_1fr]" : undefined}>
      {featured ? (
        <div className="bg-gradient-to-br from-accent-subtle to-card p-5 sm:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-foreground">
            Free · takes 30 seconds
          </span>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-heading sm:text-2xl">
            Create your account to manage everything in one place
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Set a password and your project portal with {businessName} is ready — no app to download.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
            {benefits.map((b) => (
              <li key={b.title} className="flex items-start gap-2.5">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-accent shadow-sm">
                  <b.icon className="h-4 w-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-heading">{b.title}</span>
                  <span className="block text-xs text-muted">{b.body}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className={featured ? "p-5 sm:p-7" : undefined}>
      {featured ? (
        <h3 className="flex items-center gap-2 text-base font-semibold text-heading">
          <KeyRound className="h-5 w-5 text-accent" aria-hidden /> Create your password
        </h3>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-heading">
              <KeyRound className="h-5 w-5 text-accent" aria-hidden />
              {context === "activate" ? "Create your portal password" : "Want to track this project online?"}
            </h2>
            {optionalTag}
          </div>
          <p className="mt-2 text-sm text-muted">
            Create a password to view status updates, approve your proposal, message {businessName}, and download your
            media — all in one place.
          </p>
        </>
      )}
      {featured && maskedEmail ? <p className="mt-1 text-xs text-muted">Your account email: {maskedEmail}</p> : null}
      <form onSubmit={activate} className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="activate-password">Create Password</Label>
          <div className="relative">
            <Input
              id="activate-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={MIN_LENGTH}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="min-h-11 pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-heading"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="activate-confirm">Confirm Password</Label>
          <Input
            id="activate-confirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="min-h-11"
          />
        </div>
        {error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <Button type="submit" variant="accent" size="lg" className="min-h-12 w-full" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Creating your account..." : featured ? "Create My Account" : "Create Account & View My Project"}
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {context === "thank_you"
            ? "Your request is already submitted — this just gives you access."
            : "Only you choose your password."}
        </p>
      </form>
      </div>
      </div>
    </section>
  );
}
