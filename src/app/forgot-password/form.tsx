"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, rateLimitMessage } from "@/lib/auth-client";

export default function ForgotForm() {
  const alertRef = useRef<HTMLDivElement>(null);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error || done) alertRef.current?.focus();
  }, [error, done]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await api("/api/auth/request-password-reset", { email });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      return;
    }
    if (res.code === "RATE_LIMITED") {
      setError(rateLimitMessage(res) ?? "Too many attempts. Try again later.");
      return;
    }
    if (res.code === "EMAIL_UNAVAILABLE") {
      setError("Email delivery is temporarily unavailable. Try again later.");
      return;
    }
    setError(res.message ?? "Could not reach INFAIX. Check your connection.");
  }

  if (done) {
    return (
      <div>
        <div className="auth-success" role="status" tabIndex={-1} ref={alertRef}>
          If an account exists for that email, a reset link is on its way. It expires in 1 hour and can only be used once.
        </div>
        <div className="auth-links">
          <Link href="/login">Back to log in</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          {error}
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="fp-email">Email</label>
        <input
          id="fp-email"
          className="ai-input"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby="fp-hint"
        />
        <p id="fp-hint" className="auth-note">
          We reply the same way whether or not this address has an account.
        </p>
      </div>
      <button type="submit" className="ai-send auth-submit" disabled={busy} aria-busy={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <div className="auth-links">
        <Link href="/login">Back to log in</Link>
      </div>
    </form>
  );
}
