"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, rateLimitMessage } from "@/lib/auth-client";

type Phase =
  | { kind: "pending" }
  | { kind: "busy" }
  | { kind: "verified" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "used" }
  | { kind: "already" }
  | { kind: "limited"; text: string }
  | { kind: "unavailable" }
  | { kind: "error"; text: string };

function phaseFor(code: string | null, message: string | null, retryAfter: string | null): Phase {
  if (code === "RATE_LIMITED") {
    return { kind: "limited", text: rateLimitMessage({ ok: false, status: 429, data: null, code, message, retryAfter }) ?? "Too many attempts. Try again later." };
  }
  if (code === "EMAIL_UNAVAILABLE") return { kind: "unavailable" };
  if (code === "VERIFICATION_EXPIRED") return { kind: "expired" };
  if (code === "VERIFICATION_USED") return { kind: "used" };
  if (code === "ALREADY_VERIFIED") return { kind: "already" };
  if (code === "VERIFICATION_INVALID" || code === "INVALID_INPUT") return { kind: "invalid" };
  return { kind: "error", text: message ?? "Verification failed." };
}

export default function Verifier() {
  const params = useSearchParams();
  const pending = params.get("pending") === "1";
  const newsletterMissed = params.get("newsletter") === "0";
  const pendingEmail = params.get("email") ?? "";
  const urlToken = params.get("token") ?? "";
  const alertRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState(urlToken);
  const [phase, setPhase] = useState<Phase>(urlToken ? { kind: "busy" } : { kind: "pending" });
  const [resendEmail, setResendEmail] = useState(pendingEmail);
  const [resendState, setResendState] = useState<"idle" | "busy" | "sent" | "limited" | "unavailable" | "error">("idle");
  const [resendText, setResendText] = useState("");

  useEffect(() => {
    if (phase.kind === "busy" || phase.kind === "pending") return;
    alertRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    const t = params.get("token");
    if (!t) return;
    let live = true;
    api("/api/auth/verify-email", { token: t }).then((res) => {
      if (!live) return;
      setPhase(res.ok ? { kind: "verified" } : phaseFor(res.code, res.message, res.retryAfter));
    });
    return () => {
      live = false;
    };
  }, [params]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPhase({ kind: "busy" });
    const res = await api("/api/auth/verify-email", { token: token.trim() });
    setPhase(res.ok ? { kind: "verified" } : phaseFor(res.code, res.message, res.retryAfter));
  }

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setResendState("busy");
    const res = await api("/api/auth/request-verification", { email: resendEmail });
    if (res.ok) {
      setResendState("sent");
      return;
    }
    if (res.code === "RATE_LIMITED") {
      setResendText(rateLimitMessage(res) ?? "Too many attempts. Try again later.");
      setResendState("limited");
      return;
    }
    if (res.code === "EMAIL_UNAVAILABLE") {
      setResendState("unavailable");
      return;
    }
    setResendText(res.message ?? "Could not reach INFAIX. Check your connection.");
    setResendState("error");
  }

  const showManual = phase.kind !== "verified" && phase.kind !== "busy" && phase.kind !== "already" && !urlToken;

  return (
    <div>
      {pending && phase.kind !== "verified" && (
        <div className="auth-success" role="status">
          Account created. Check your email for a verification link. It expires in 24 hours and works once.
        </div>
      )}
      {newsletterMissed && (
        <p className="auth-note" role="status">
          Your account was created. The newsletter preference was not saved. You can set it later from your account. You are not subscribed.
        </p>
      )}
      {phase.kind === "busy" && (
        <div className="ai-hint" role="status" aria-live="polite">
          Verifying…
        </div>
      )}
      {phase.kind === "verified" && (
        <div ref={alertRef} tabIndex={-1}>
          <div className="auth-success" role="status">
            Your email is confirmed. This account is your INFAIX identity. It does not grant access to private products.
          </div>
          <div className="auth-links">
            <Link href="/login">Log in</Link>
          </div>
        </div>
      )}
      {phase.kind === "expired" && (
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          This verification link has expired. Request a new one below. Links last 24 hours.
        </div>
      )}
      {phase.kind === "used" && (
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          This verification link has already been used. If you still need to confirm the address, request a new link.
        </div>
      )}
      {phase.kind === "already" && (
        <div ref={alertRef} tabIndex={-1}>
          <div className="auth-success" role="status">
            This account is already verified. You can log in.
          </div>
          <div className="auth-links">
            <Link href="/login">Log in</Link>
          </div>
        </div>
      )}
      {phase.kind === "invalid" && (
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          This verification link is not valid. Check the address or request a new link.
        </div>
      )}
      {phase.kind === "limited" && (
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          {phase.text}
        </div>
      )}
      {phase.kind === "unavailable" && (
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          Email delivery is temporarily unavailable. Nothing was changed. Try again later.
        </div>
      )}
      {phase.kind === "error" && (
        <div className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          {phase.text}
        </div>
      )}

      {showManual && (
        <form onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="ve-token">Verification token</label>
            <input
              id="ve-token"
              className="ai-input"
              type="text"
              autoComplete="one-time-code"
              spellCheck={false}
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-describedby="ve-token-hint"
            />
            <p id="ve-token-hint" className="auth-note">
              Paste the token if you opened this page without the email link.
            </p>
          </div>
          <button type="submit" className="ai-send auth-submit">
            Verify email
          </button>
        </form>
      )}

      {phase.kind !== "verified" && phase.kind !== "already" && (
        <>
          <hr className="auth-divider" />
          <h2 className="auth-heading">Resend verification</h2>
          {resendState === "sent" ? (
            <div className="auth-success" role="status">
              If that email has a verification waiting, a fresh link is on its way. It expires in 24 hours.
            </div>
          ) : (
            <form onSubmit={resend}>
              {resendState === "limited" && (
                <div className="auth-error" role="alert">
                  {resendText}
                </div>
              )}
              {resendState === "unavailable" && (
                <div className="auth-error" role="alert">
                  Email delivery is temporarily unavailable. Try again later.
                </div>
              )}
              {resendState === "error" && (
                <div className="auth-error" role="alert">
                  {resendText}
                </div>
              )}
              <div className="auth-field">
                <label htmlFor="ve-resend">Email</label>
                <input
                  id="ve-resend"
                  className="ai-input"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  required
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  disabled={resendState === "busy"}
                />
              </div>
              <button type="submit" className="ai-send auth-submit" disabled={resendState === "busy"} aria-busy={resendState === "busy"}>
                {resendState === "busy" ? "Sending…" : "Resend link"}
              </button>
            </form>
          )}
        </>
      )}
      {phase.kind !== "verified" && (
        <div className="auth-links">
          <Link href="/login">Log in</Link>
        </div>
      )}
    </div>
  );
}
