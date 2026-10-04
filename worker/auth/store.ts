// Storage layer: explicit methods over D1, plus an in-memory
// implementation for tests. No raw SQL outside this file (except schema).
import type {
  AuditEvent,
  ConversationRow,
  D1Like,
  D1PreparedLike,
  InvitationRow,
  MessageRow,
  LegalAcceptanceRow,
  NewsletterSubscriptionRow,
  ProductGrantRow,
  ResetRow,
  Role,
  SessionRow,
  UserRow,
  VerificationRow,
} from "./types";
import type { OperationsSnapshot } from "../../src/lib/operations-contract";

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
  operationsSnapshot(from: number, to: number, bucketMs: number): Promise<OperationsSnapshot>;
  // users
  getUserById(id: string): Promise<UserRow | null>;
  getUserByEmail(email: string): Promise<UserRow | null>;
  insertUser(u: UserRow): Promise<void>;
  /**
   * Account, required acknowledgement, initial verification and optional
   * invitation claim. A failure commits none of the registration writes.
   */
  registerAccount(user: UserRow, acceptance: LegalAcceptanceRow, verification: VerificationRow, invitation?: InvitationRow): Promise<void>;
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
  // newsletter consent (separate from accounts; never auto-created)
  getNewsletterByEmail(email: string): Promise<NewsletterSubscriptionRow | null>;
  upsertNewsletter(sub: NewsletterSubscriptionRow): Promise<void>;
  setNewsletterStatus(email: string, status: NewsletterSubscriptionRow["status"], now: number): Promise<boolean>;
  insertLegalAcceptance(row: LegalAcceptanceRow): Promise<void>;
  listLegalAcceptancesForUser(userId: string): Promise<LegalAcceptanceRow[]>;
  // product/beta access grants (future invite-grant target; identity ≠ access)
  insertProductGrant(g: ProductGrantRow): Promise<void>;
  listProductGrantsForUser(userId: string): Promise<ProductGrantRow[]>;
  revokeProductGrant(id: string, now: number): Promise<boolean>;
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

  async operationsSnapshot(from: number, to: number, bucketMs: number): Promise<OperationsSnapshot> {
    const [users, sessions, events, recent, activity] = await Promise.all([
      this.db.prepare("SELECT COUNT(*) AS totalUsers, COALESCE(SUM(CASE WHEN created_at >= ? AND created_at < ? THEN 1 ELSE 0 END), 0) AS recentUsers FROM users").bind(from, to).first<{ totalUsers: number; recentUsers: number }>(),
      this.db.prepare("SELECT COUNT(*) AS count FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.expires_at > ? AND u.status = 'ACTIVE'").bind(to).first<{ count: number }>(),
      this.db.prepare("SELECT event, COUNT(*) AS count FROM audit_log WHERE created_at >= ? AND created_at < ? GROUP BY event").bind(from, to).all<{ event: string; count: number }>(),
      this.db.prepare("SELECT event, created_at FROM audit_log WHERE created_at >= ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT 30").bind(from, to).all<{ event: string; created_at: number }>(),
      this.db.prepare("SELECT CAST((created_at - ?) / ? AS INTEGER) AS bucket, COUNT(*) AS count FROM audit_log WHERE created_at >= ? AND created_at < ? GROUP BY bucket ORDER BY bucket").bind(from, bucketMs, from, to).all<{ bucket: number; count: number }>(),
    ]);
    if (!users || !sessions) throw new Error("Missing aggregates");
    return { ...users, activeSessions: sessions.count, events: events.results, recentEvents: recent.results, activity: activity.results };
  }

  async getUserById(id: string): Promise<UserRow | null> {
    return this.db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  }
  async getUserByEmail(email: string): Promise<UserRow | null> {
    return this.db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
  }
  private userInsert(u: UserRow): D1PreparedLike {
    return this.db
      .prepare(
        "INSERT INTO users (id, email, password_hash, display_name, role, status, email_verified, ai_access, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(u.id, u.email, u.password_hash, u.display_name, u.role, u.status, u.email_verified, u.ai_access ?? 0, u.created_at, u.updated_at, u.last_login_at);
  }
  private acceptanceInsert(row: LegalAcceptanceRow): D1PreparedLike {
    return this.db
      .prepare(
        "INSERT INTO legal_acceptances (id, user_id, terms_version, privacy_version, source, accepted_at) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(row.id, row.user_id, row.terms_version, row.privacy_version, row.source, row.accepted_at);
  }
  async insertUser(u: UserRow): Promise<void> {
    await this.userInsert(u).run();
  }
  async registerAccount(user: UserRow, acceptance: LegalAcceptanceRow, verification: VerificationRow, invitation?: InvitationRow): Promise<void> {
    if (acceptance.user_id !== user.id || verification.user_id !== user.id) throw new Error("Registration user mismatch");
    // D1 batch rolls back every statement on failure. Recheck the invitation
    // INSIDE the transaction: a lost claim makes role NULL, deliberately
    // violating users.role NOT NULL before an account can be inserted.
    // Unlike INSERT OR IGNORE this never swallows unexpected constraints.
    const insertUser = invitation ? this.db.prepare(
      "INSERT INTO users (id, email, password_hash, display_name, role, status, email_verified, ai_access, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, CASE WHEN EXISTS (SELECT 1 FROM invitations WHERE id = ? AND status = 'PENDING' AND expires_at > ? AND (intended_email IS NULL OR intended_email = ?) AND role = ?) THEN ? ELSE NULL END, ?, ?, ?, ?, ?, ?)"
    ).bind(user.id, user.email, user.password_hash, user.display_name, invitation.id, user.created_at, user.email, user.role, user.role, user.status, user.email_verified, user.ai_access, user.created_at, user.updated_at, user.last_login_at) : this.userInsert(user);
    const statements = [insertUser, this.acceptanceInsert(acceptance), this.verificationInsert(verification)];
    if (invitation) {
      statements.push(this.db.prepare("UPDATE invitations SET status = 'USED', used_at = ?, used_by_user_id = ? WHERE id = ? AND status = 'PENDING'").bind(user.created_at, user.id, invitation.id));
    }
    await this.db.batch(statements);
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

  private verificationInsert(v: VerificationRow): D1PreparedLike {
    return this.db
      .prepare("INSERT INTO email_verifications (id, user_id, token_hash, status, created_at, expires_at, used_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(v.id, v.user_id, v.token_hash, v.status, v.created_at, v.expires_at, v.used_at);
  }
  async insertVerification(v: VerificationRow): Promise<void> {
    await this.verificationInsert(v).run();
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

  async getNewsletterByEmail(email: string): Promise<NewsletterSubscriptionRow | null> {
    return this.db.prepare("SELECT * FROM newsletter_subscriptions WHERE email = ?").bind(email).first<NewsletterSubscriptionRow>();
  }
  async upsertNewsletter(sub: NewsletterSubscriptionRow): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO newsletter_subscriptions (email, status, consent_at, consent_source, policy_version, confirmed_at, unsubscribed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) " +
          "ON CONFLICT(email) DO UPDATE SET status = excluded.status, consent_at = excluded.consent_at, consent_source = excluded.consent_source, policy_version = excluded.policy_version, confirmed_at = excluded.confirmed_at, unsubscribed_at = excluded.unsubscribed_at, updated_at = excluded.updated_at"
      )
      .bind(sub.email, sub.status, sub.consent_at, sub.consent_source, sub.policy_version, sub.confirmed_at, sub.unsubscribed_at, sub.created_at, sub.updated_at)
      .run();
  }
  async setNewsletterStatus(email: string, status: NewsletterSubscriptionRow["status"], now: number): Promise<boolean> {
    const unsubscribedAt = status === "UNSUBSCRIBED" ? now : null;
    const r = await this.db
      .prepare("UPDATE newsletter_subscriptions SET status = ?, unsubscribed_at = ?, updated_at = ? WHERE email = ?")
      .bind(status, unsubscribedAt, now, email)
      .run();
    return r.meta.changes > 0;
  }

  async insertLegalAcceptance(row: LegalAcceptanceRow): Promise<void> {
    await this.acceptanceInsert(row).run();
  }
  async listLegalAcceptancesForUser(userId: string): Promise<LegalAcceptanceRow[]> {
    const r = await this.db
      .prepare("SELECT * FROM legal_acceptances WHERE user_id = ? ORDER BY accepted_at DESC")
      .bind(userId)
      .all<LegalAcceptanceRow>();
    return r.results;
  }

  async insertProductGrant(g: ProductGrantRow): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO product_grants (id, user_id, product, status, source_invitation_id, created_at, updated_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(g.id, g.user_id, g.product, g.status, g.source_invitation_id, g.created_at, g.updated_at, g.revoked_at)
      .run();
  }
  async listProductGrantsForUser(userId: string): Promise<ProductGrantRow[]> {
    const r = await this.db.prepare("SELECT * FROM product_grants WHERE user_id = ? ORDER BY created_at DESC").bind(userId).all<ProductGrantRow>();
    return r.results;
  }
  async revokeProductGrant(id: string, now: number): Promise<boolean> {
    const r = await this.db
      .prepare("UPDATE product_grants SET status = 'REVOKED', revoked_at = ?, updated_at = ? WHERE id = ? AND status = 'ACTIVE'")
      .bind(now, now, id)
      .run();
    return r.meta.changes > 0;
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
