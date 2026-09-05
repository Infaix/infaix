"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";

export default function Verifier() {
  const params = useSearchParams();
  const pending = params.get("pending") === "1";
  const pendingEmail = params.get("email") ?? "";
  const [token, setToken] = useState(params.get("token") ?? "");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" | "error"; text: string }>({
    kind: params.get("token") ? "busy" : "idle",
    text: "",
  });
  const [resendEmail, setResendEmail] = useState(pendingEmail);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const t = params.get("token");
    if (!t) return;
    let live = true;
    api("/api/auth/verify-email", { token: t }).then((res) => {
      if (!live) return;
      setState(
        res.ok
          ? { kind: "done", text: "Email verified. Your account is active — please log in." }
          : { kind: "error", text: res.message ?? "Verification failed." }
      );
    });
    return () => {
      live = false;
    };
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "busy", text: "" });
    const res = await api("/api/auth/verify-email", { token: token.trim() });
    setState(
      res.ok
        ? { kind: "done", text: "Email verified. Your account is active — please log in." }
        : { kind: "error", text: res.message ?? "Verification failed." }
    );
  }

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    await api("/api/auth/request-verification", { email: resendEmail });
    // Neutral by design.
    setResent(true);
  }

  return (
    <div>
      {pending && (
        <div className="auth-success" role="status">
          Account created. Check your email for the verification link (valid 24 hours).
        </div>
      )}
      {state.kind === "done" && (
        <div className="auth-success" role="status">
          {state.text}
        </div>
      )}
      {state.kind === "error" && (
        <div className="auth-error" role="alert">
          {state.text}
        </div>
      )}
      {state.kind === "busy" && <div className="ai-hint">Verifying…</div>}
      {state.kind !== "done" && state.kind !== "busy" && (
        <form onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="ve-token">Verification token</label>
            <input
              id="ve-token"
              className="ai-input"
              type="text"
              autoComplete="off"
              spellCheck={false}
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <button type="submit" className="ai-send auth-submit">
            Verify email
          </button>
        </form>
      )}
      <hr className="auth-divider" />
      {resent ? (
        <div className="auth-success" role="status">
          If that email has a pending verification, a fresh link is on its way.
        </div>
      ) : (
        <form onSubmit={resend}>
          <div className="auth-field">
            <label htmlFor="ve-resend">Resend verification link</label>
            <input
              id="ve-resend"
              className="ai-input"
              type="email"
              autoComplete="email"
              required
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="account email"
            />
          </div>
          <button type="submit" className="ai-send auth-submit">
            Resend link
          </button>
        </form>
      )}
      <div className="auth-links">
        <Link href="/login">Log in</Link>
      </div>
    </div>
  );
}
