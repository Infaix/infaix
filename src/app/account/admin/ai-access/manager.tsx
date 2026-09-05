"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, type PublicUser } from "@/lib/auth-client";

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: "OWNER" | "ADMIN" | "USER";
  status: string;
  email_verified: boolean;
  ai_access: boolean;
  created_at: number;
  last_login_at: number | null;
}

type LoadState = { kind: "loading" } | { kind: "denied" } | { kind: "ready" };

export default function AiAccessManager() {
  const router = useRouter();
  const [load, setLoad] = useState<LoadState>({ kind: "loading" });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const me = await api<{ user: PublicUser }>("/api/auth/me");
    if (!me.ok || !me.data) {
      router.push("/login");
      return;
    }
    if (me.data.user.role !== "OWNER") {
      setLoad({ kind: "denied" });
      return;
    }
    const list = await api<{ users: AdminUser[] }>("/api/admin/users");
    if (!list.ok || !list.data) {
      setNotice({ kind: "error", text: list.message ?? "Could not load users." });
      setLoad({ kind: "denied" });
      return;
    }
    setUsers(list.data.users);
    setLoad({ kind: "ready" });
  }, [router]);

  useEffect(() => {
    let live = true;
    (async () => {
      if (live) await refresh();
    })();
    return () => {
      live = false;
    };
  }, [refresh]);

  async function toggle(u: AdminUser) {
    if (saving) return;
    setNotice(null);
    setSaving(u.id);
    const res = await api<{ user: AdminUser }>(`/api/admin/users/${u.id}/ai-access`, {
      enabled: !u.ai_access,
    });
    setSaving(null);
    if (!res.ok || !res.data) {
      setNotice({ kind: "error", text: res.message ?? "Could not update AI access." });
      return;
    }
    const updated = res.data.user;
    setUsers((prev) => prev.map((p) => (p.id === u.id ? { ...p, ai_access: updated.ai_access } : p)));
    setNotice({
      kind: "success",
      text: `AI access ${updated.ai_access ? "enabled" : "disabled"} for ${u.email}.`,
    });
  }

  if (load.kind === "loading") return <div className="ai-hint">Loading administration…</div>;
  if (load.kind === "denied")
    return (
      <div>
        <div className="auth-error" role="alert">
          This area is restricted to INFAIX owners.
        </div>
        <div className="auth-links">
          <Link href="/account">Back to account</Link>
        </div>
      </div>
    );

  return (
    <div>
      {notice && (
        <div className={notice.kind === "error" ? "auth-error" : "auth-success"} role="status" aria-live="polite">
          {notice.text}
        </div>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table" aria-label="INFAIX users and their AI access">
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Status</th>
              <th scope="col">Role</th>
              <th scope="col">AI access</th>
              <th scope="col" aria-label="Action"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isOwner = u.role === "OWNER";
              const busy = saving === u.id;
              return (
                <tr key={u.id}>
                  <td>
                    <div className="admin-email">{u.email}</div>
                    <div className="admin-sub">{u.display_name}</div>
                  </td>
                  <td>{u.status}</td>
                  <td>{u.role}</td>
                  <td>
                    {isOwner ? (
                      <span className="status-pill active">Always on</span>
                    ) : (
                      <span className={`status-pill ${u.ai_access ? "live" : ""}`}>
                        {u.ai_access ? "ON" : "OFF"}
                      </span>
                    )}
                  </td>
                  <td className="admin-action">
                    {!isOwner && (
                      <button
                        type="button"
                        className="ai-send admin-toggle"
                        disabled={busy || saving !== null}
                        onClick={() => toggle(u)}
                        aria-label={`${u.ai_access ? "Disable" : "Enable"} AI access for ${u.email}`}
                      >
                        {busy ? "Saving…" : u.ai_access ? "Disable" : "Enable"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {users.length === 0 && <div className="ai-hint">No users found.</div>}
    </div>
  );
}
