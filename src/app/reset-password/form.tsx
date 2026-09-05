"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/auth-client";

export default function ResetForm() {
  const params = useSearchParams();
  const [token, setToken] = useState(params.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await api("/api/auth/reset-password", { token: token.trim(), newPassword });
    setBusy(false);
    if (!res.ok) {
      setError(res.message ?? "Reset failed.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div>
        <div className="auth-success" role="status">
          Password updated. All sessions were signed out — please log in again.
        </div>
        <div className="auth-links">
          <Link href="/login">Log in</Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}
      {!params.get("token") && (
        <div className="auth-field">
          <label htmlFor="rp-token">Reset token</label>
          <input
            id="rp-token"
            className="ai-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={busy}
          />
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="rp-password">New password (min 12 chars, mix 3 of 4 classes)</label>
        <input
          id="rp-password"
          className="ai-input"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={busy}
        />
      </div>
      <button type="submit" className="ai-send auth-submit" disabled={busy}>
        {busy ? "Updating…" : "Set new password"}
      </button>
    </form>
  );
}
