"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, type PublicUser } from "@/lib/auth-client";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    router.push("/account");
    router.refresh();
  }

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
      <button type="submit" className="ai-send auth-submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <div className="auth-links">
        <Link href="/forgot-password">Forgot password?</Link>
        <Link href="/register">Have an invitation? Register</Link>
      </div>
    </form>
  );
}
