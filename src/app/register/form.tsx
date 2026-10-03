"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, rateLimitMessage, type PublicUser } from "@/lib/auth-client";
import { NEWSLETTER_CONSENT_LABEL, NEWSLETTER_POLICY_VERSION } from "@/lib/newsletter-consent";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal-versions";

const PASSWORD_HINT = "At least 12 characters, using 3 of lowercase, uppercase, digits, and symbols.";

export default function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const alertRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState(params.get("token") ?? "");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [newsletter, setNewsletter] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!terms) {
      setError("Please accept the Terms of Use and read the Privacy Policy to create an account.");
      return;
    }
    setBusy(true);
    const res = await api<{ user: PublicUser }>("/api/auth/register", {
      ...(token.trim() ? { token: token.trim() } : {}),
      email,
      displayName,
      password,
    });
    if (!res.ok) {
      setBusy(false);
      setError(rateLimitMessage(res) ?? res.message ?? "Registration failed.");
      return;
    }
    let newsletterFlag = "";
    if (newsletter) {
      const news = await api("/api/newsletter/subscribe", {
        email,
        source: "registration",
        policyVersion: NEWSLETTER_POLICY_VERSION,
        consent: true,
      });
      if (!news.ok) newsletterFlag = "&newsletter=0";
    }
    setBusy(false);
    router.push("/verify-email?pending=1&email=" + encodeURIComponent(email) + newsletterFlag);
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="auth-note">
        Creating an account gives you an INFAIX identity. It does not open Chat, AI, or other private products.
      </p>
      {error && (
        <div id="reg-error" className="auth-error" role="alert" tabIndex={-1} ref={alertRef}>
          {error}
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          className="ai-input"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "reg-error" : undefined}
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
        <label htmlFor="reg-password">Password</label>
        <input
          id="reg-password"
          className="ai-input"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          aria-describedby="reg-password-hint"
        />
        <p id="reg-password-hint" className="auth-note">
          {PASSWORD_HINT}
        </p>
      </div>
      <div className="auth-field">
        <label htmlFor="reg-confirm">Confirm password</label>
        <input
          id="reg-confirm"
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
      <div className="auth-field">
        <label htmlFor="reg-token">Invitation token</label>
        <input
          id="reg-token"
          className="ai-input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          disabled={busy}
          placeholder="Optional"
          aria-describedby="reg-token-hint"
        />
        <p id="reg-token-hint" className="auth-note">
          Leave this blank unless an operator sent you an invitation link.
        </p>
      </div>
      <label className="auth-check" htmlFor="reg-terms">
        <input
          id="reg-terms"
          type="checkbox"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          disabled={busy}
          aria-describedby="reg-terms-hint"
        />
        <span>
          I accept the{" "}
          <Link href="/legal/terms">
            Terms of Use
          </Link>{" "}
          and have read the{" "}
          <Link href="/legal/privacy">
            Privacy Policy
          </Link>
          . Required to create an account.
        </span>
      </label>
      <p id="reg-terms-hint" className="auth-note">
        Terms version {TERMS_VERSION} and privacy version {PRIVACY_VERSION}. An account is
        an identity only: it does not open AI, Chat or any other product. Product news is
        a separate, optional choice below and is not part of these terms.
      </p>

      <fieldset className="auth-optional">
        <legend>Optional — INFAIX product news</legend>
        <label className="auth-check" htmlFor="reg-news">
          <input
            id="reg-news"
            type="checkbox"
            checked={newsletter}
            onChange={(e) => setNewsletter(e.target.checked)}
            disabled={busy}
          />
          <span>{NEWSLETTER_CONSENT_LABEL}</span>
        </label>
        <p className="auth-note">
          Marketing only. Never ticked for you, never inferred from signing up, and it does
          not affect the verification or password mail your account needs. Manage it any
          time in <Link href="/account">email preferences</Link>.
        </p>
      </fieldset>
      <button type="submit" className="ai-send auth-submit" disabled={busy} aria-busy={busy}>
        {busy ? "Creating account…" : "Create account"}
      </button>
      <div className="auth-links">
        <Link href="/login">Already have an account? Log in</Link>
      </div>
    </form>
  );
}
