// Storage layer: explicit methods over D1, plus an in-memory
// implementation for tests. No raw SQL outside this file (except schema).
import type {
  AuditEvent,
  ConversationRow,
  D1Like,
  InvitationRow,
  MessageRow,
  ResetRow,
  Role,
  SessionRow,
  UserRow,
  VerificationRow,
} from "./types";

export interface UserUpdate {
  password_hash?: string;
  display_name?: string;
  status?: UserRow["status"];
  email_verified?: number;
  ai_access?: number;
  role?: Role;
  updated_at: number;
  last_login_at?: number | null;
}

export interface Store {
  // users
  getUserById(id: string): Promise<UserRow | null>;
  getUserByEmail(email: string): Promise<UserRow | null>;
  insertUser(u: UserRow): Promise<void>;
  updateUser(id: string, patch: UserUpdate): Promise<boolean>;
  listUsers(limit: number): Promise<UserRow[]>;
  setAiAccess(id: string, value: number, now: number): Promise<boolean>;
  // invitations
  getInvitationByTokenHash(h: string): Promise<InvitationRow | null>;
  insertInvitation(inv: InvitationRow): Promise<void>;
  claimInvitation(id: string, userId: string, now: number): Promise<boolean>;
  revokeInvitation(id: string, now: number): Promise<boolean>;
  expireInvitations(now: number): Promise<number>;
  listInvitations(limit: number): Promise<InvitationRow[]>;
  // sessions
  insertSession(s: SessionRow): Promise<void>;
  getSession(id: string): Promise<SessionRow | null>;
  touchSession(id: string, expiresAt: number, lastSeen: number): Promise<void>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  deleteUserSessionsExcept(userId: string, keepId: string): Promise<void>;
  pruneSessions(now: number): Promise<number>;
  // password resets
  insertReset(r: ResetRow): Promise<void>;
  getResetByTokenHash(h: string): Promise<ResetRow | null>;
  claimReset(id: string, now: number): Promise<boolean>;
  expireResets(now: number): Promise<number>;
  expireUserResets(userId: string): Promise<void>;
  // email verifications
  insertVerification(v: VerificationRow): Promise<void>;
  getVerificationByTokenHash(h: string): Promise<VerificationRow | null>;
  claimVerification(id: string, now: number): Promise<boolean>;
  expireVerifications(now: number): Promise<number>;
  expireUserVerifications(userId: string): Promise<void>;
  // conversations
  insertConversation(c: ConversationRow): Promise<void>;
  listConversations(userId: string, limit: number): Promise<ConversationRow[]>;
  getConversation(id: string): Promise<ConversationRow | null>;
  touchConversation(id: string, now: number): Promise<void>;
  deleteConversation(id: string): Promise<void>;
  insertMessage(conversationId: string, role: string, content: string, now: number): Promise<void>;
  listMessages(conversationId: string, limit: number): Promise<MessageRow[]>;
  // audit
  insertAudit(e: AuditEvent): Promise<void>;
  // rate limiting
  hitRateLimit(scope: string, windowStart: number): Promise<number>;
  pruneRateLimits(before: number): Promise<void>;
  // dev email outbox
  insertOutbox(kind: string, toEmail: string, linkToken: string, now: number): Promise<number>;
  latestOutbox(toEmail: string, kind: string): Promise<{ id: number; link_token: string } | null>;
  consumeOutbox(id: number): Promise<void>;
}

export class D1Store implements Store {
  constructor(private db: D1Like) {}

  async getUserById(id: string): Promise<UserRow | null> {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  }
  async getUserByEmail(email: string): Promise<UserRow | null> {
    return this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  }
  async insertUser(u: UserRow): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO users (id, email, password_hash, display_name, role, status, email_verified, ai_access, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(u.id, u.email, u.password_hash, u.display_name, u.role, u.status, u.email_verified, u.ai_access ?? 0, u.created_at, u.updated_at, u.last_login_at)
      .run();
  }
  async updateUser(id: string, patch: UserUpdate): Promise<boolean> {
    const keys = Object.keys(patch) as (keyof UserUpdate)[];
    if (keys.length === 0) return true;
    const set = keys.map((k) => `${k} = ?`).join(", ");
    const vals = keys.map((k) => patch[k] ?? null);
    const r = await this.db.prepare(`UPDATE users SET ${set} WHERE id = ?`).bind(...vals, id).run();
    return r.meta.changes > 0;
  }
  async listUsers(limit: number): Promise<UserRow[]> {
    const r = await this.db.prepare("SELECT * FROM users ORDER BY created_at DESC LIMIT ?").bind(limit).all<UserRow>();
    return r.results;
  }
  async setAiAccess(id: string, value: number, now: number): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE users SET ai_access = ?, updated_at = ? WHERE id = ?")
      .bind(value, now, id)
      .run();
    return r.meta.changes > 0;
  }

  async getInvitationByTokenHash(h: string): Promise<InvitationRow | null> {
    return this.db.prepare("SELECT * FROM invitations WHERE token_hash = ?").bind(h).first<InvitationRow>();
  }
  async insertInvitation(inv: InvitationRow): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO invitations (id, token_hash, status, intended_email, role, inviter_user_id, created_at, expires_at, used_at, used_by_user_id, revoked_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(inv.id, inv.token_hash, inv.status, inv.intended_email, inv.role, inv.inviter_user_id, inv.created_at, inv.expires_at, inv.used_at, inv.used_by_user_id, inv.revoked_at, inv.note)
      .run();
  }
  async claimInvitation(id: string, userId: string, now: number): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE invitations SET status = 'USED', used_at = ?, used_by_user_id = ? WHERE id = ? AND status = 'PENDING'")
      .bind(now, userId, id)
      .run();
    return r.meta.changes > 0;
  }
  async revokeInvitation(id: string, now: number): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE invitations SET status = 'REVOKED', revoked_at = ? WHERE id = ? AND status = 'PENDING'")
      .bind(now, id)
      .run();
    return r.meta.changes > 0;
  }
  async expireInvitations(now: number): Promise<number> {
    const r = await this.db
      .prepare("UPDATE invitations SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= ?")
      .bind(now)
      .run();
    return r.meta.changes;
  }
  async listInvitations(limit: number): Promise<InvitationRow[]> {
    const r = await this.db.prepare("SELECT * FROM invitations ORDER BY created_at DESC LIMIT ?").bind(limit).all<InvitationRow>();
    return r.results;
  }

  async insertSession(s: SessionRow): Promise<void> {
    await this.db
      .prepare("INSERT INTO sessions (id, user_id, created_at, expires_at, last_seen_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(s.id, s.user_id, s.created_at, s.expires_at, s.last_seen_at, s.ip, s.user_agent)
      .run();
  }
  async getSession(id: string): Promise<SessionRow | null> {
    return this.db.prepare("SELECT * FROM sessions WHERE id = ?").bind(id).first<SessionRow>();
  }
  async touchSession(id: string, expiresAt: number, lastSeen: number): Promise<void> {
    await this.db.prepare("UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE id = ?").bind(expiresAt, lastSeen, id).run();
  }
  async deleteSession(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE id = ?").bind(id).run();
  }
  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  }
  async deleteUserSessionsExcept(userId: string, keepId: string): Promise<void> {
    await this.db.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").bind(userId, keepId).run();
  }
  async pruneSessions(now: number): Promise<number> {
    const r = await this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now).run();
    return r.meta.changes;
  }

  async insertReset(r: ResetRow): Promise<void> {
    await this.db
      .prepare("INSERT INTO password_resets (id, user_id, token_hash, status, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(r.id, r.user_id, r.token_hash, r.status, r.created_at, r.expires_at, r.used_at)
      .run();
  }
  async getResetByTokenHash(h: string): Promise<ResetRow | null> {
    return this.db.prepare("SELECT * FROM password_resets WHERE token_hash = ?").bind(h).first<ResetRow>();
  }
  async claimReset(id: string, now: number): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE password_resets SET status = 'USED', used_at = ? WHERE id = ? AND status = 'PENDING'")
      .bind(now, id)
      .run();
    return r.meta.changes > 0;
  }
  async expireResets(now: number): Promise<number> {
    const r = await this.db.prepare("UPDATE password_resets SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= ?").bind(now).run();
    return r.meta.changes;
  }
  async expireUserResets(userId: string): Promise<void> {
    await this.db.prepare("UPDATE password_resets SET status = 'EXPIRED' WHERE user_id = ? AND status = 'PENDING'").bind(userId).run();
  }

  async insertVerification(v: VerificationRow): Promise<void> {
    await this.db
      .prepare("INSERT INTO email_verifications (id, user_id, token_hash, status, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(v.id, v.user_id, v.token_hash, v.status, v.created_at, v.expires_at, v.used_at)
      .run();
  }
  async getVerificationByTokenHash(h: string): Promise<VerificationRow | null> {
    return this.db.prepare("SELECT * FROM email_verifications WHERE token_hash = ?").bind(h).first<VerificationRow>();
  }
  async claimVerification(id: string, now: number): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE email_verifications SET status = 'USED', used_at = ? WHERE id = ? AND status = 'PENDING'")
      .bind(now, id)
      .run();
    return r.meta.changes > 0;
  }
  async expireVerifications(now: number): Promise<number> {
    const r = await this.db.prepare("UPDATE email_verifications SET status = 'EXPIRED' WHERE status = 'PENDING' AND expires_at <= ?").bind(now).run();
    return r.meta.changes;
  }
  async expireUserVerifications(userId: string): Promise<void> {
    await this.db.prepare("UPDATE email_verifications SET status = 'EXPIRED' WHERE user_id = ? AND status = 'PENDING'").bind(userId).run();
  }

  async insertAudit(e: AuditEvent): Promise<void> {
    await this.db
      .prepare("INSERT INTO audit_log (event, actor_user_id, target_user_id, ip, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(e.event, e.actor_user_id, e.target_user_id, e.ip, e.detail, e.created_at)
      .run();
  }

  async insertConversation(c: ConversationRow): Promise<void> {
    await this.db
      .prepare("INSERT INTO conversations (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .bind(c.id, c.user_id, c.title, c.created_at, c.updated_at)
      .run();
  }
  async listConversations(userId: string, limit: number): Promise<ConversationRow[]> {
    const r = await this.db
      .prepare("SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?")
      .bind(userId, limit)
      .all<ConversationRow>();
    return r.results;
  }
  async getConversation(id: string): Promise<ConversationRow | null> {
    return this.db.prepare("SELECT * FROM conversations WHERE id = ?").bind(id).first<ConversationRow>();
  }
  async touchConversation(id: string, now: number): Promise<void> {
    await this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").bind(now, id).run();
  }
  async deleteConversation(id: string): Promise<void> {
    await this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").bind(id).run();
    await this.db.prepare("DELETE FROM conversations WHERE id = ?").bind(id).run();
  }
  async insertMessage(conversationId: string, role: string, content: string, now: number): Promise<void> {
    await this.db
      .prepare("INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)")
      .bind(conversationId, role, content, now)
      .run();
  }
  async listMessages(conversationId: string, limit: number): Promise<MessageRow[]> {
    const r = await this.db
      .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT ?")
      .bind(conversationId, limit)
      .all<MessageRow>();
    return r.results;
  }

  async hitRateLimit(scope: string, windowStart: number): Promise<number> {
    await this.db
      .prepare("INSERT INTO rate_limit_hits (scope, window_start, count) VALUES (?, ?, 1) ON CONFLICT(scope, window_start) DO UPDATE SET count = count + 1")
      .bind(scope, windowStart)
      .run();
    const row = await this.db
      .prepare("SELECT count AS count FROM rate_limit_hits WHERE scope = ? AND window_start = ?")
      .bind(scope, windowStart)
      .first<{ count: number }>();
    return row ? row.count : 1;
  }
  async pruneRateLimits(before: number): Promise<void> {
    await this.db.prepare("DELETE FROM rate_limit_hits WHERE window_start < ?").bind(before).run();
  }

  async insertOutbox(kind: string, toEmail: string, linkToken: string, now: number): Promise<number> {
    const r = await this.db
      .prepare("INSERT INTO email_outbox (kind, to_email, link_token, created_at, consumed) VALUES (?, ?, ?, ?, 0)")
      .bind(kind, toEmail, linkToken, now)
      .run();
    return Number(r.meta.changes);
  }
  async latestOutbox(toEmail: string, kind: string): Promise<{ id: number; link_token: string } | null> {
    return this.db
      .prepare("SELECT id, link_token FROM email_outbox WHERE to_email = ? AND kind = ? AND consumed = 0 ORDER BY id DESC LIMIT 1")
      .bind(toEmail, kind)
      .first<{ id: number; link_token: string }>();
  }
  async consumeOutbox(id: number): Promise<void> {
    await this.db.prepare("UPDATE email_outbox SET consumed = 1 WHERE id = ?").bind(id).run();
  }
}
