"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, type PublicUser } from "@/lib/auth-client";

export default function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await api<{ user: PublicUser }>("/api/auth/register", {
      token: token.trim(),
      email,
      displayName,
      password,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Registration failed.");
      return;
    }
    router.push("/verify-email?pending=1&email=" + encodeURIComponent(email));
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="reg-token">Invitation token</label>
        <input
          id="reg-token"
          className="ai-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          required
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={busy}
          placeholder="From your invitation link"
        />
      </div>
      <div className="auth-field">
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
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
        <label htmlFor="reg-name">Display name</label>
        <input
          id="reg-name"
          className="ai-input"
          type="text"
          autoComplete="nickname"
          required
          maxLength={60}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          disabled={busy}
        />
      </div>
      <div className="auth-field">
        <label htmlFor="reg-password">Password (min 12 chars, mix 3 of 4 classes)</label>
        <input
          id="reg-password"
          className="ai-input"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
      </div>
      <button type="submit" className="ai-send auth-submit" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <div className="auth-links">
        <Link href="/login">Already have an account? Log in</Link>
      </div>
    </form>
  );
}
