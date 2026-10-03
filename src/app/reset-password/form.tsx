"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, rateLimitMessage } from "@/lib/auth-client";

const PASSWORD_HINT = "At least 12 characters, using 3 of lowercase, uppercase, digits, and symbols.";

export default function ResetForm() {
  const params = useSearchParams();
  const urlToken = params.get("token") ?? "";
  const alertRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState(urlToken);
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error || done) alertRef.current?.focus();
  }, [error, done]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (newPassword !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    const res = await api("/api/auth/reset-password", { token: token.trim(), newPassword });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      return;
    }
    if (res.code === "RATE_LIMITED") {
      setError(rateLimitMessage(res) ?? "Too many attempts. Try again later.");
      return;
    }
    if (res.code === "RESET_EXPIRED") {
      setError("This reset link has expired. Request a new one. Links last 1 hour.");
      return;
    }
    if (res.code === "RESET_USED") {
      setError("This reset link has already been used. Request a new one if you still need to change the password.");
      return;
    }
    if (res.code === "RESET_INVALID" || res.code === "INVALID_INPUT") {
      setError(res.code === "INVALID_INPUT" && res.message && !res.message.includes("link") ? res.message : "This reset link is not valid.");
      return;
    }
    setError(res.message ?? "Reset failed.");
  }

  if (done) {
    return (
      <div>
        <div className="auth-success" role="status" tabIndex={-1} ref={alertRef}>
          Password updated. Every session was signed out. Log in with the new password.
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
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          {error}
        </div>
      )}
      {!urlToken && (
        <div className="auth-field">
          <label htmlFor="rp-token">Reset token</label>
          <input
            id="rp-token"
            className="ai-input"
            type="text"
            autoComplete="one-time-code"
            spellCheck={false}
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={busy}
          />
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="rp-password">New password</label>
        <input
          id="rp-password"
          className="ai-input"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={busy}
          aria-describedby="rp-hint"
        />
        <p id="rp-hint" className="auth-note">
          {PASSWORD_HINT}
        </p>
      </div>
      <div className="auth-field">
        <label htmlFor="rp-confirm">Confirm new password</label>
        <input
          id="rp-confirm"
          className="ai-input"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={busy}
        />
      </div>
      <button type="submit" className="ai-send auth-submit" disabled={busy} aria-busy={busy}>
        {busy ? "Updating…" : "Set new password"}
      </button>
      <div className="auth-links">
        <Link href="/forgot-password">Request a new link</Link>
      </div>
    </form>
  );
}
