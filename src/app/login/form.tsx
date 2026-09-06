"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type PublicUser } from "@/lib/auth-client";
import { safeReturnTo } from "@/lib/return-to";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = safeReturnTo(params.get("returnTo"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  // Already signed in → leave /login for the account area instead of
  // showing the form again. Session truth comes from the server (/me),
  // never from client storage or flags.
  useEffect(() => {
    let live = true;
    api<{ user: PublicUser }>("/api/auth/me").then((res) => {
      if (!live) return;
      if (res.ok) {
        router.replace(returnTo);
        return;
      }
      setChecking(false);
    });
    return () => {
      live = false;
    };
  }, [router, returnTo]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await api<{ user: PublicUser }>("/api/auth/login", { email, password });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Sign in failed.");
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  if (checking) return <div className="ai-hint">Checking session…</div>;

  return (
    <form onSubmit={submit} noValidate={false}>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="login-email">Email</label>
        <input
          id="login-email"
          className="ai-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="auth-field">
        <label htmlFor="login-password">Password</label>
        <input
          id="login-password"
          className="ai-input"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </div>
      <button type="submit" className="ai-send auth-submit" disabled={busy} aria-busy={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="auth-links">
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/register">Have an invitation? Register</Link>
      </div>
    </form>
  );
}
