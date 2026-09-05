"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, type PublicUser } from "@/lib/auth-client";

export default function AccountDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api<{ user: PublicUser }>("/api/auth/me").then((res) => {
      if (!live) return;
      setLoading(false);
      if (!res.ok || !res.data) {
        router.push("/login");
        return;
      }
      setUser(res.data.user);
      setName(res.data.user.display_name);
    });
    return () => {
      live = false;
    };
  }, [router]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setMsg(null);
    setBusy(true);
    const res = await api<{ user: PublicUser }>("/api/auth/profile", { displayName: name });
    setBusy(false);
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
    setBusy(true);
    const res = await api<{ ok: boolean }>("/api/auth/change-password", { currentPassword, newPassword });
    setBusy(false);
    if (!res.ok) {
      setMsg({ kind: "error", text: res.message ?? "Could not change password." });
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setMsg({ kind: "success", text: "Password changed. Other sessions were signed out." });
  }

  async function logout() {
    await api("/api/auth/logout", {});
    router.push("/");
    router.refresh();
  }

  if (loading) return <div className="ai-hint">Loading account…</div>;
  if (!user) return <div className="ai-hint">Redirecting to login…</div>;

  return (
    <div>
      {msg && <div className={msg.kind === "error" ? "auth-error" : "auth-success"} role="status">{msg.text}</div>}
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
          <span className="k">Status</span>
          <span className="v">{user.status}</span>
        </li>
        <li>
          <span className="k">Verified</span>
          <span className="v">{user.email_verified ? "Yes" : "No"}</span>
        </li>
        <li>
          <span className="k">Role</span>
          <span className="v">{user.role}</span>
        </li>
        <li>
          <span className="k">INFAIX AI</span>
          <span className="v">{user.role === "OWNER" || user.ai_access ? "Enabled" : "Not enabled"}</span>
        </li>
      </ul>

      {user.role === "OWNER" && (
        <div className="auth-links" style={{ marginTop: 16 }}>
          <Link href="/account/admin/ai-access">Manage AI access →</Link>
        </div>
      )}

      <hr className="auth-divider" />
      <form onSubmit={saveName}>
        <div className="auth-field">
          <label htmlFor="acct-name">Change display name</label>
          <input
            id="acct-name"
            className="ai-input"
            type="text"
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </div>
        <button type="submit" className="ai-send auth-submit" disabled={busy}>
          Save display name
        </button>
      </form>

      <hr className="auth-divider" />
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
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        <button type="submit" className="ai-send auth-submit" disabled={busy}>
          Change password
        </button>
      </form>

      <hr className="auth-divider" />
      <button type="button" className="btn-quiet" onClick={logout}>
        Log out <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
