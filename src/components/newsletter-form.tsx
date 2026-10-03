"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api, rateLimitMessage } from "@/lib/auth-client";
import { NEWSLETTER_POLICY_VERSION, type NewsletterSource } from "@/lib/newsletter-consent";

/**
 * Product-news opt-in for people who do not have an account.
 *
 * Contract notes that matter here:
 * - `POST /api/newsletter/subscribe` returns `{ ok: true }` for every accepted
 *   address, so the success message must never imply whether an account
 *   exists or whether the person was subscribed before. It says what happened,
 *   not what the service knows about them.
 * - Consent is only sent when the box is actually ticked. Nothing is ever
 *   preselected, and an unticked box writes nothing.
 * - The stored row is PENDING_CONFIRMATION. Nothing is being sent to anyone
 *   yet, so the copy must not promise a forthcoming email that cannot arrive.
 * - `source` records the surface the consent was captured on, which is why
 *   this component takes it as a prop rather than hard-coding one.
 */
export default function NewsletterForm({
  source,
  className,
}: {
  source: NewsletterSource;
  className?: string;
}) {
  const base = useId();
  const emailId = `${base}-email`;
  const checkId = `${base}-consent`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;
  const statusId = `${base}-status`;
  const errorRef = useRef<HTMLParagraphElement>(null);

  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setStatus(null);
    setError(null);

    if (!consent) {
      setError("Tick the box to say you want INFAIX product news, or leave this form alone.");
      return;
    }

    setBusy(true);
    const res = await api("/api/newsletter/subscribe", {
      email,
      source,
      policyVersion: NEWSLETTER_POLICY_VERSION,
      consent: true,
    });
    setBusy(false);

    if (!res.ok) {
      setError(rateLimitMessage(res) ?? res.message ?? "That did not save. Nothing was sent.");
      return;
    }
    setConsent(false);
    setEmail("");
    setStatus("Thank you. Your request is recorded. Nothing is sent until confirmation is available, and you can turn it off at any time.");
  }

  return (
    <form className={`news-form${className ? ` ${className}` : ""}`} onSubmit={submit} noValidate>
      <label className="news-label" htmlFor={emailId}>
        Email address
      </label>
      <div className="news-row">
        <input
          id={emailId}
          className="news-input"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
        />
        <button type="submit" className="news-submit" disabled={busy} aria-busy={busy}>
          {busy ? "Saving…" : "Subscribe"}
        </button>
      </div>

      <p className="news-hint" id={hintId}>
        No account needed, and no account is created. Only INFAIX product news: launches,
        project updates, beta and early-access invitations, and major releases. Never an
        account or security message.
      </p>

      <label className="news-check" htmlFor={checkId}>
        <input
          id={checkId}
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (e.target.checked) setError(null);
          }}
          disabled={busy}
          aria-describedby={hintId}
        />
        <span>
          Yes, email me INFAIX product news. Optional, and separate from account mail.
          Unsubscribe from any message, or manage it in{" "}
          <Link href="/account">your account</Link>.
        </span>
      </label>

      {error && (
        <p className="news-error" id={errorId} role="alert" tabIndex={-1} ref={errorRef}>
          {error}
        </p>
      )}
      {status && (
        <p className="news-status" id={statusId} role="status">
          {status}
        </p>
      )}
    </form>
  );
}