"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Link2Off, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props =
  | {
      mode: "open";
      token: string;
      prefix: string;
      firstName?: string | null;
      businessName?: string;
    }
  | {
      mode: "refused";
      /** Set only when a fresh link can be emailed for this token. */
      token: string;
      prefix: string;
      message: string;
      maskedEmail?: string | null;
      loginHref?: string;
      /** Transient failure: offer "Try again" with the same link. */
      retry?: boolean;
      businessName?: string;
    };

export function ClientAccessLanding(props: Props) {
  if (props.mode === "open") return <OpenProject {...props} />;
  return <Refused {...props} />;
}

/** Submits itself once on load; the button is the no-JS / slow-network fallback. */
function OpenProject({ token, prefix, firstName, businessName }: Extract<Props, { mode: "open" }>) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true);
    formRef.current?.requestSubmit();
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <Loader2 className="mx-auto h-9 w-9 animate-spin text-accent" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-heading">
        {firstName ? `Welcome, ${firstName}` : "Opening your project"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Taking you to your project{businessName ? ` with ${businessName}` : ""}. No password needed.
      </p>
      <form
        ref={formRef}
        method="POST"
        action={`${prefix}/auth/client/consume`}
        className="mt-5"
        onSubmit={() => setBusy(true)}
      >
        <input type="hidden" name="token" value={token} />
        <Button type="submit" variant="accent" className="min-h-11 w-full" disabled={busy}>
          {busy ? "Opening…" : "Open my project"}
        </Button>
      </form>
    </section>
  );
}

function Refused({ token, prefix, message, maskedEmail, loginHref, retry, businessName }: Extract<Props, { mode: "refused" }>) {
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendFresh() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${prefix}/api/auth/client-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resend", token }),
      });
      const data = (await res.json().catch(() => ({}))) as { maskedEmail?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "Couldn't send a new link.");
      setSentTo(data.maskedEmail ?? maskedEmail ?? "your email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send a new link.");
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold text-heading">Check your email</h1>
        <p className="mt-2 text-sm text-muted">
          We sent a fresh link to <strong className="text-heading">{sentTo}</strong>. Open it on this device to go
          straight to your project.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
      <Link2Off className="mx-auto h-10 w-10 text-muted" aria-hidden />
      <h1 className="mt-3 text-xl font-semibold text-heading">
        {retry ? "Let's try that again" : token ? "Let's get you a fresh link" : "This link can't be used"}
      </h1>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <div className="mt-5 space-y-2">
        {retry && token ? (
          <form method="POST" action={`${prefix}/auth/client/consume`}>
            <input type="hidden" name="token" value={token} />
            <Button type="submit" variant="accent" className="min-h-11 w-full">
              Try again
            </Button>
          </form>
        ) : null}
        {token && maskedEmail ? (
          <p className="text-xs text-muted">
            It goes to the email on file: <span className="font-medium text-heading">{maskedEmail}</span>
          </p>
        ) : null}
        {token ? (
          <Button
            type="button"
            variant={retry ? "outline" : "accent"}
            className="min-h-11 w-full"
            onClick={() => void sendFresh()}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Email me a new link
          </Button>
        ) : null}
        <a
          href={loginHref ?? `${prefix}/login`}
          className="block text-sm font-medium text-accent underline-offset-4 hover:underline"
        >
          Log in instead
        </a>
      </div>
      {businessName ? (
        <p className="mt-4 text-xs text-muted">Still stuck? Contact {businessName} and they can resend your link.</p>
      ) : null}
    </section>
  );
}
