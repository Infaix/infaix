// In-memory Store implementation for unit tests. Mirrors D1Store
// conditional-update semantics (claim/revoke only from PENDING).
import type { Store, UserUpdate } from "./store";
import type { AuditEvent, ConversationRow, InvitationRow, MessageRow, ResetRow, SessionRow, UserRow, VerificationRow } from "./types";

export class MemoryStore implements Store {
  users = new Map<string, UserRow>();
  byEmail = new Map<string, string>();
  invitations = new Map<string, InvitationRow>();
  sessions = new Map<string, SessionRow>();
  resets = new Map<string, ResetRow>();
  verifications = new Map<string, VerificationRow>();
  audits: AuditEvent[] = [];
  rate = new Map<string, number>();
  outbox: { id: number; kind: string; to_email: string; link_token: string; created_at: number; consumed: number }[] = [];
  private outboxSeq = 1;

  async getUserById(id: string) { return this.users.get(id) ?? null; }
  async getUserByEmail(email: string) {
    const id = this.byEmail.get(email);
    return id ? (this.users.get(id) ?? null) : null;
  }
  async insertUser(u: UserRow) {
    if (this.byEmail.has(u.email)) throw new Error("UNIQUE users.email");
    this.users.set(u.id, { ...u });
    this.byEmail.set(u.email, u.id);
  }
  async updateUser(id: string, patch: UserUpdate) {
    const u = this.users.get(id);
    if (!u) return false;
    const next = { ...u };
    if (patch.password_hash !== undefined) next.password_hash = patch.password_hash;
    if (patch.display_name !== undefined) next.display_name = patch.display_name;
    if (patch.status !== undefined) next.status = patch.status;
    if (patch.email_verified !== undefined) next.email_verified = patch.email_verified;
    if (patch.ai_access !== undefined) next.ai_access = patch.ai_access;
    if (patch.role !== undefined) next.role = patch.role;
    if (patch.last_login_at !== undefined) next.last_login_at = patch.last_login_at;
    next.updated_at = patch.updated_at;
    this.users.set(id, next);
    return true;
  }
  async listUsers(limit: number) {
    return [...this.users.values()].sort((a, b) => b.created_at - a.created_at).slice(0, limit).map((u) => ({ ...u }));
  }
  async setAiAccess(id: string, value: number, now: number) {
    const u = this.users.get(id);
    if (!u) return false;
    u.ai_access = value;
    u.updated_at = now;
    return true;
  }

  async getInvitationByTokenHash(h: string) {
    for (const inv of this.invitations.values()) if (inv.token_hash === h) return { ...inv };
    return null;
  }
  async insertInvitation(inv: InvitationRow) { this.invitations.set(inv.id, { ...inv }); }
  async claimInvitation(id: string, userId: string, now: number) {
    const inv = this.invitations.get(id);
    if (!inv || inv.status !== "PENDING") return false;
    inv.status = "USED";
    inv.used_at = now;
    inv.used_by_user_id = userId;
    return true;
  }
  async revokeInvitation(id: string, now: number) {
    const inv = this.invitations.get(id);
    if (!inv || inv.status !== "PENDING") return false;
    inv.status = "REVOKED";
    inv.revoked_at = now;
    return true;
  }
  async expireInvitations(now: number) {
    let n = 0;
    for (const inv of this.invitations.values()) {
      if (inv.status === "PENDING" && inv.expires_at <= now) { inv.status = "EXPIRED"; n++; }
    }
    return n;
  }
  async listInvitations(limit: number) {
    return [...this.invitations.values()].sort((a, b) => b.created_at - a.created_at).slice(0, limit).map((i) => ({ ...i }));
  }

  async insertSession(s: SessionRow) { this.sessions.set(s.id, { ...s }); }
  async getSession(id: string) { return this.sessions.get(id) ?? null; }
  async touchSession(id: string, expiresAt: number, lastSeen: number) {
    const s = this.sessions.get(id);
    if (s) { s.expires_at = expiresAt; s.last_seen_at = lastSeen; }
  }
  async deleteSession(id: string) { this.sessions.delete(id); }
  async deleteUserSessions(userId: string) {
    for (const [id, s] of this.sessions) if (s.user_id === userId) this.sessions.delete(id);
  }
  async deleteUserSessionsExcept(userId: string, keepId: string) {
    for (const [id, s] of this.sessions) if (s.user_id === userId && id !== keepId) this.sessions.delete(id);
  }
  async pruneSessions(now: number) {
    let n = 0;
    for (const [id, s] of this.sessions) if (s.expires_at <= now) { this.sessions.delete(id); n++; }
    return n;
  }

  async insertReset(r: ResetRow) { this.resets.set(r.id, { ...r }); }
  async getResetByTokenHash(h: string) {
    for (const r of this.resets.values()) if (r.token_hash === h) return { ...r };
    return null;
  }
  async claimReset(id: string, now: number) {
    const r = this.resets.get(id);
    if (!r || r.status !== "PENDING") return false;
    r.status = "USED";
    r.used_at = now;
    return true;
  }
  async expireResets(now: number) {
    let n = 0;
    for (const r of this.resets.values()) if (r.status === "PENDING" && r.expires_at <= now) { r.status = "EXPIRED"; n++; }
    return n;
  }
  async expireUserResets(userId: string) {
    for (const r of this.resets.values()) if (r.user_id === userId && r.status === "PENDING") r.status = "EXPIRED";
  }

  async insertVerification(v: VerificationRow) { this.verifications.set(v.id, { ...v }); }
  async getVerificationByTokenHash(h: string) {
    for (const v of this.verifications.values()) if (v.token_hash === h) return { ...v };
    return null;
  }
  async claimVerification(id: string, now: number) {
    const v = this.verifications.get(id);
    if (!v || v.status !== "PENDING") return false;
    v.status = "USED";
    v.used_at = now;
    return true;
  }
  async expireVerifications(now: number) {
    let n = 0;
    for (const v of this.verifications.values()) if (v.status === "PENDING" && v.expires_at <= now) { v.status = "EXPIRED"; n++; }
    return n;
  }
  async expireUserVerifications(userId: string) {
    for (const v of this.verifications.values()) if (v.user_id === userId && v.status === "PENDING") v.status = "EXPIRED";
  }

  async insertAudit(e: AuditEvent) { this.audits.push({ ...e }); }

  conversations = new Map<string, ConversationRow>();
  messages: MessageRow[] = [];
  private messageSeq = 1;

  async insertConversation(c: ConversationRow) { this.conversations.set(c.id, { ...c }); }
  async listConversations(userId: string, limit: number) {
    return [...this.conversations.values()]
      .filter((c) => c.user_id === userId)
      .sort((a, b) => b.updated_at - a.updated_at)
      .slice(0, limit)
      .map((c) => ({ ...c }));
  }
  async getConversation(id: string) { return this.conversations.get(id) ?? null; }
  async touchConversation(id: string, now: number) {
    const c = this.conversations.get(id);
    if (c) c.updated_at = now;
  }
  async deleteConversation(id: string) {
    this.conversations.delete(id);
    this.messages = this.messages.filter((m) => m.conversation_id !== id);
  }
  async insertMessage(conversationId: string, role: string, content: string, now: number) {
    this.messages.push({ id: this.messageSeq++, conversation_id: conversationId, role, content, created_at: now });
  }
  async listMessages(conversationId: string, limit: number) {
    return this.messages.filter((m) => m.conversation_id === conversationId).slice(0, limit).map((m) => ({ ...m }));
  }

  async hitRateLimit(scope: string, windowStart: number) {
    const k = `${scope}|${windowStart}`;
    const n = (this.rate.get(k) ?? 0) + 1;
    this.rate.set(k, n);
    return n;
  }
  async pruneRateLimits(before: number) {
    for (const [k, v] of this.rate) {
      void v;
      const w = Number(k.split("|").pop());
      if (w < before) this.rate.delete(k);
    }
  }

  async insertOutbox(kind: string, toEmail: string, linkToken: string, now: number) {
    const id = this.outboxSeq++;
    this.outbox.push({ id, kind, to_email: toEmail, link_token: linkToken, created_at: now, consumed: 0 });
    return 1;
  }
  async latestOutbox(toEmail: string, kind: string) {
    const rows = this.outbox.filter((o) => o.to_email === toEmail && o.kind === kind && o.consumed === 0);
    if (!rows.length) return null;
    const last = rows[rows.length - 1];
    return { id: last.id, link_token: last.link_token };
  }
  async consumeOutbox(id: number) {
    const o = this.outbox.find((x) => x.id === id);
    if (o) o.consumed = 1;
  }
}
