"use client";

import { useState } from "react";
import { api } from "@/lib/auth-client";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    await api("/api/auth/request-password-reset", { email });
    setBusy(false);
    // Neutral by design: identical response whether or not the email exists.
    setDone(true);
  }

  if (done) {
    return (
      <div className="auth-success" role="status">
        If an account exists for that email, a reset link is on its way. It expires in 1 hour and can only be used once.
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="auth-field">
        <label htmlFor="fp-email">Email</label>
        <input
          id="fp-email"
          className="ai-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
      </div>
      <button type="submit" className="ai-send auth-submit" disabled={busy}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
