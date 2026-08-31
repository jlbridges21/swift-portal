"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  messageForAuthLinkError,
  type AuthLinkErrorKind,
} from "@/lib/auth-fragment";

/**
 * Shared "that link didn't work" + Send me a new link UI for /login and landings.
 */
export function AuthLinkHelpCard({
  errorKind,
  description,
  initialEmail = "",
  onDismiss,
  dismissLabel = "Back",
}: {
  errorKind: AuthLinkErrorKind;
  description?: string | null;
  initialEmail?: string;
  onDismiss?: () => void;
  dismissLabel?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(messageForAuthLinkError(errorKind, description ?? null));
  const [notice, setNotice] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/auth/resend-link", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not send a new link.");
      return;
    }
    setSent(true);
    setNotice(data.message || "If an account exists, a new link was sent.");
  }

  const shareErrorTitle =
    errorKind === "share_expired"
      ? "This share link expired"
      : errorKind === "share_one_time_used"
        ? "One-time link already used"
        : errorKind === "share_revoked"
          ? "Share access revoked"
          : errorKind === "share_not_started"
            ? "Share not active yet"
            : errorKind === "share_rate_limited"
              ? "Too many attempts"
              : "That link didn’t work";

  const shareErrorDescription =
    errorKind === "share_expired" ||
    errorKind === "share_one_time_used" ||
    errorKind === "share_revoked" ||
    errorKind === "share_not_started" ||
    errorKind === "share_rate_limited" ? (
      <CardDescription>{messageForAuthLinkError(errorKind, description ?? null)}</CardDescription>
    ) : (
      <CardDescription>
        Email security scanners often open invite or reset links automatically and consume them.
        Requesting a new link usually fixes this — the product isn’t broken.
      </CardDescription>
    );

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{shareErrorTitle}</CardTitle>
        {shareErrorDescription}
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && errorKind !== "share_expired" && errorKind !== "share_one_time_used" && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          {(errorKind === "share_expired" || errorKind === "share_one_time_used") && (
            <p className="text-sm text-muted">{error}</p>
          )}
          {errorKind === "otp_expired" && (
            <p className="text-sm text-muted">
              Expired or already-used links are common when an email scanner opens the URL before
              you do.
            </p>
          )}
          {errorKind === "access_denied" && (
            <p className="text-sm text-muted">
              Access was denied for that link. A fresh invite or reset email usually resolves it.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="auth-link-email">Your email</Label>
            <Input
              id="auth-link-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
            />
          </div>
          {notice && <p className="text-sm text-muted">{notice}</p>}
          <Button type="submit" variant="accent" className="w-full min-h-11" disabled={loading || sent}>
            {loading ? "Sending…" : sent ? "Link sent" : "Send me a new link"}
          </Button>
          {onDismiss && (
            <p className="text-center text-sm">
              <button type="button" className="text-accent hover:underline" onClick={onDismiss}>
                {dismissLabel}
              </button>
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
