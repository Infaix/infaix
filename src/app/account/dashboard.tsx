"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, rateLimitMessage, type PublicUser } from "@/lib/auth-client";
import { NEWSLETTER_CONSENT_LABEL, NEWSLETTER_POLICY_VERSION } from "@/lib/newsletter-consent";
import { settlePreference, type NewsletterPreference, type NewsletterStatus } from "@/lib/newsletter-preference";

function roleLabel(role: PublicUser["role"]): string {
  if (role === "OWNER") return "Owner";
  if (role === "ADMIN") return "Admin";
  return "Member";
}

function statusLabel(user: PublicUser): string {
  if (user.status === "DISABLED") return "Disabled";
  if (user.status === "PENDING_VERIFICATION" || !user.email_verified) return "Verification required";
  return "Active";
}

function newsletterLabel(status: NewsletterStatus): string {
  if (status === "SUBSCRIBED") return "Subscribed";
  if (status === "PENDING_CONFIRMATION") return "Confirmation pending";
  if (status === "UNSUBSCRIBED") return "Unsubscribed";
  return "Not subscribed";
}

export default function AccountDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [operation, setOperation] = useState<"name" | "password" | "verify" | "news" | null>(null);
  const [preference, setPreference] = useState<NewsletterPreference>({ state: "loading" });
  const [optIn, setOptIn] = useState(false);
  const busy = operation !== null;

  useEffect(() => {
    let live = true;
    Promise.all([
      api<{ user: PublicUser }>("/api/auth/me"),
      api<{ status: NewsletterStatus }>("/api/newsletter/me"),
    ]).then(([me, pref]) => {
      if (!live) return;
      setLoading(false);
      if (!me.ok || !me.data) {
        router.push("/login");
        return;
      }
      setUser(me.data.user);
      setName(me.data.user.display_name);
      setPreference((previous) => settlePreference(previous, pref.ok, pref.data?.status));
    });
    return () => {
      live = false;
    };
  }, [router]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    setOperation("name");
    const res = await api<{ user: PublicUser }>("/api/auth/profile", { displayName: name });
    setOperation(null);
    if (!res.ok || !res.data) {
      setMsg({ kind: "error", text: res.message ?? "Could not save display name." });
      return;
    }
    setUser(res.data.user);
    setMsg({ kind: "success", text: "Display name updated." });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    if (newPassword !== confirmPassword) {
      setMsg({ kind: "error", text: "Passwords do not match." });
      return;
    }
    setOperation("password");
    const res = await api<{ ok: boolean; passwordChanged?: boolean; notificationDelivered?: boolean }>("/api/auth/change-password", { currentPassword, newPassword });
    setOperation(null);
    if (!res.ok) {
      setMsg({ kind: "error", text: rateLimitMessage(res) ?? res.message ?? "Could not change password." });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    const delivered = res.data?.notificationDelivered === true;
    setMsg({
      kind: "success",
      text: delivered
        ? "Password changed. Other sessions were signed out. A security email was sent."
        : "Password changed. Other sessions were signed out. The security email could not be sent.",
    });
  }

  async function resendVerification() {
    if (!user || busy) return;
    setMsg(null);
    setOperation("verify");
    const res = await api("/api/auth/request-verification", { email: user.email });
    setOperation(null);
    if (res.code === "RATE_LIMITED") {
      setMsg({ kind: "error", text: rateLimitMessage(res) ?? "Too many attempts. Try again later." });
      return;
    }
    if (!res.ok) {
      setMsg({ kind: "error", text: res.message ?? "Could not send a verification email." });
      return;
    }
    setMsg({ kind: "success", text: "If this account still needs verification, a new link is on its way." });
  }

  async function saveNewsletter(e: React.FormEvent) {
    e.preventDefault();
    if (!user || busy || preference.state !== "ready") return;
    setMsg(null);
    setOperation("news");
    const newsletter = preference.status;
    if (optIn && newsletter !== "SUBSCRIBED" && newsletter !== "PENDING_CONFIRMATION") {
      const res = await api("/api/newsletter/subscribe", {
        email: user.email,
        source: "account-settings",
        policyVersion: NEWSLETTER_POLICY_VERSION,
        consent: true,
      });
      setOperation(null);
      if (!res.ok) {
        setMsg({ kind: "error", text: rateLimitMessage(res) ?? "Newsletter preference could not be saved. Try again." });
        return;
      }
      setPreference({ state: "ready", status: "PENDING_CONFIRMATION" });
      setOptIn(false);
      setMsg({ kind: "success", text: "Preference saved. You are not subscribed until that request is confirmed." });
      return;
    }
    const res = await api<{ status: NewsletterStatus }>("/api/newsletter/withdraw", {});
    setOperation(null);
    if (!res.ok) {
      setMsg({ kind: "error", text: rateLimitMessage(res) ?? "Could not update email preferences." });
      return;
    }
    setPreference({ state: "ready", status: res.data?.status ?? null });
    setMsg({ kind: "success", text: "You will not receive INFAIX product news." });
  }

  async function retryPreferences() {
    if (busy) return;
    setOperation("news");
    const pref = await api<{ status: NewsletterStatus }>("/api/newsletter/me");
    setOperation(null);
    if (!pref.ok && preference.state === "ready") {
      setMsg({ kind: "error", text: "Could not refresh email preferences. The status below is the last one loaded." });
    }
    setPreference((previous) => settlePreference(previous, pref.ok, pref.data?.status));
  }

  async function logout() {
    await api("/api/auth/logout", {});
    router.push("/");
    router.refresh();
  }

  if (loading) return <div className="ai-hint loading-state account-content" role="status">Loading account…</div>;
  if (!user) return <div className="ai-hint loading-state account-content" role="status">Redirecting to login…</div>;

  const memberSince = new Date(user.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="account-content">
      {msg && (
        <div className={msg.kind === "error" ? "auth-error" : "auth-success"} role={msg.kind === "error" ? "alert" : "status"}>
          {msg.text}
        </div>
      )}
      <h2 className="auth-heading">Identity</h2>
      <ul className="kv-list">
        <li>
          <span className="k">Display name</span>
          <span className="v">{user.display_name}</span>
        </li>
        <li>
          <span className="k">Email</span>
          <span className="v">{user.email}</span>
        </li>
        <li>
          <span className="k">Verification</span>
          <span className="v">{user.email_verified ? "Verified" : "Not verified"}</span>
        </li>
        <li>
          <span className="k">Account</span>
          <span className="v">{statusLabel(user)}</span>
        </li>
        <li>
          <span className="k">Role</span>
          <span className="v">{roleLabel(user.role)}</span>
        </li>
        <li>
          <span className="k">Member since</span>
          <span className="v">{memberSince}</span>
        </li>
        <li>
          <span className="k">INFAIX AI</span>
          <span className="v">{user.role === "OWNER" || user.ai_access ? "Enabled" : "Not enabled"}</span>
        </li>
      </ul>
      <p className="auth-note">This account is your INFAIX identity. It does not by itself open private products.</p>

      {user.role === "OWNER" || user.ai_access ? (
        <div className="auth-links">
          <Link href="/ai">Open INFAIX AI</Link>
        </div>
      ) : (
        <p className="auth-note" role="status">
          INFAIX AI is not enabled for this account.
        </p>
      )}

      {!user.email_verified && (
        <button type="button" className="ai-send auth-submit" onClick={resendVerification} disabled={busy} aria-busy={operation === "verify"}>
          {operation === "verify" ? "Sending…" : "Resend verification email"}
        </button>
      )}

      {user.role === "OWNER" && (
        <div className="auth-links">
          <Link href="/account/admin/ai-access">Manage AI access</Link>
        </div>
      )}

      <hr className="auth-divider" />
      <h2 className="auth-heading">Display name</h2>
      <form onSubmit={saveName}>
        <div className="auth-field">
          <label htmlFor="acct-name">Display name</label>
          <input
            id="acct-name"
            className="ai-input"
            type="text"
            autoComplete="nickname"
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>
        <button type="submit" className="ai-send auth-submit" disabled={busy} aria-busy={operation === "name"}>
          {operation === "name" ? "Saving…" : "Save display name"}
        </button>
      </form>

      <hr className="auth-divider" />
      <h2 className="auth-heading">Password</h2>
      <form onSubmit={changePassword}>
        <div className="auth-field">
          <label htmlFor="acct-current">Current password</label>
          <input
            id="acct-current"
            className="ai-input"
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="auth-field">
          <label htmlFor="acct-new">New password</label>
          <input
            id="acct-new"
            className="ai-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
            aria-describedby="acct-pw-hint"
          />
          <p id="acct-pw-hint" className="auth-note">
            At least 12 characters, using 3 of lowercase, uppercase, digits, and symbols. Other sessions are signed out.
          </p>
        </div>
        <div className="auth-field">
          <label htmlFor="acct-confirm">Confirm new password</label>
          <input
            id="acct-confirm"
            className="ai-input"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        <button type="submit" className="ai-send auth-submit" disabled={busy} aria-busy={operation === "password"}>
          {operation === "password" ? "Updating…" : "Change password"}
        </button>
      </form>
      <div className="auth-links">
        <Link href="/forgot-password">Forgot your password?</Link>
      </div>

      <hr className="auth-divider" />
      <h2 id="email-preferences" className="auth-heading">Email preferences</h2>
      {preference.state === "loading" && (
        <p className="auth-note" role="status">Loading email preferences…</p>
      )}
      {preference.state === "unavailable" && (
        <div className="auth-error" role="alert">
          Email preferences could not be loaded. Nothing was changed.
          <div className="auth-links">
            <button type="button" className="btn-quiet" onClick={retryPreferences} disabled={busy}>
              Try again
            </button>
          </div>
        </div>
      )}
      {preference.state === "ready" && (
        <>
          <p className="auth-note">
            Current newsletter status: {newsletterLabel(preference.status)}. Product news is separate from account mail such as verification and password notices.
          </p>
          {preference.status === "PENDING_CONFIRMATION" && (
            <p className="auth-note" role="status">
              A newsletter request is waiting for confirmation. You are not subscribed, and no product news is being sent.
            </p>
          )}
          <form onSubmit={saveNewsletter}>
            {preference.status !== "SUBSCRIBED" && preference.status !== "PENDING_CONFIRMATION" && (
              <label className="auth-check" htmlFor="acct-news">
                <input
                  id="acct-news"
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  disabled={busy}
                />
                <span>{NEWSLETTER_CONSENT_LABEL}</span>
              </label>
            )}
            <button type="submit" className="ai-send auth-submit" disabled={busy || (preference.status !== "SUBSCRIBED" && preference.status !== "PENDING_CONFIRMATION" && !optIn)} aria-busy={operation === "news"}>
              {operation === "news" ? "Saving…" : preference.status === "SUBSCRIBED" || preference.status === "PENDING_CONFIRMATION" ? "Stop product news" : "Save email preference"}
            </button>
          </form>
        </>
      )}

      <hr className="auth-divider" />
      <h2 className="auth-heading">Privacy &amp; documents</h2>
      <p className="auth-note">
        These documents describe what INFAIX actually stores. Anything still awaiting an
        owner or legal decision is marked in the text and collected on the{" "}
        <Link href="/legal#decisions">legal centre</Link>.
      </p>
      <ul className="account-doc-list">
        <li>
          <Link href="/legal/privacy">Privacy Policy</Link>
          <span className="account-doc-note">What is stored, why, and for how long.</span>
        </li>
        <li>
          <Link href="/legal/terms">Terms of Use</Link>
          <span className="account-doc-note">The agreement that comes with the account.</span>
        </li>
        <li>
          <Link href="/legal/cookies">Cookie Policy</Link>
          <span className="account-doc-note">One necessary cookie, no trackers, no consent dialog.</span>
        </li>
      </ul>
      <p className="auth-note">
        Turning off product news above only stops marketing. Verification, password reset
        and security notices are transactional and cannot be switched off, because your
        account does not work without them. There is no self-service account deletion
        control today; that is recorded as an open decision rather than presented as a
        feature.
      </p>

      <hr className="auth-divider" />
      <h2 className="auth-heading">Session</h2>
      <button type="button" className="btn-quiet" onClick={logout}>
        Log out <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
