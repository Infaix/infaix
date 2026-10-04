import type { AbuseDigest } from "./abuse";
import type { D1Like } from "./types";

const RETENTION_MS = 48 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const TOTAL_CAP = 5;
const PURPOSE_CAP = 3;
let nextPruneAt = -Infinity; // Shared by every store instance in this isolate.

export type EmailPurpose = "verification" | "recovery";
type Unavailable = { allowed: false; reason: "UNAVAILABLE"; retryAfter: number };
export type AttemptAdmission = Unavailable | { allowed: boolean; reason: "ALLOWED" | "LIMIT"; count: number; retryAfter: number };
export type EmailAdmission = Unavailable |
  { allowed: true; reason: "ALLOWED"; reservationId: string; retryAfter: 0 } |
  { allowed: false; reason: "COOLDOWN" | "COMBINED_LIMIT" | "PURPOSE_LIMIT"; retryAfter: number };

export interface SecurityStore {
  hitAttempt(scope: AbuseDigest, rule: { limit: number; windowSeconds: number }, nowMs: number): Promise<AttemptAdmission>;
  reserveEmailSend(email: AbuseDigest, purpose: EmailPurpose, nowMs: number): Promise<EmailAdmission>;
  pruneExpired(nowMs: number): Promise<{ ran: boolean; ok: boolean; deleted: number }>;
}

const unavailable = (): Unavailable => ({ allowed: false, reason: "UNAVAILABLE", retryAfter: 60 });
const validDigest = (digest: string) => typeof digest === "string" && /^[0-9a-f]{64}$/.test(digest);
const validTime = (now: number) => Number.isSafeInteger(now) && now >= 0 && Number.isSafeInteger(now + RETENTION_MS);
const retry = (until: number, now: number) => Math.max(1, Math.ceil((until - now) / 1000));

interface EmailState {
  window_start: number; total_count: number; verification_count: number; recovery_count: number;
  cooldown_until: number; expires_at: number;
}

/** Internal admission metadata, never a public quota response. No raw identifiers or logging. */
export class D1SecurityStore implements SecurityStore {
  constructor(private readonly db: D1Like) {}

  async hitAttempt(scope: AbuseDigest, rule: { limit: number; windowSeconds: number }, nowMs: number): Promise<AttemptAdmission> {
    if (!validDigest(scope) || !validTime(nowMs) || !Number.isSafeInteger(rule.limit) || rule.limit <= 0 ||
        !Number.isSafeInteger(rule.windowSeconds) || rule.windowSeconds <= 0 || rule.windowSeconds > 86400) return unavailable();
    const windowStart = Math.floor(nowMs / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000;
    try {
      const row = await this.db.prepare(`
        INSERT INTO auth_attempt_windows (scope_digest,window_start,window_seconds,count,expires_at)
        VALUES (?,?,?,1,?)
        ON CONFLICT(scope_digest,window_start,window_seconds) DO UPDATE SET
          count=CASE WHEN auth_attempt_windows.expires_at <= ? THEN 1 ELSE auth_attempt_windows.count+1 END,
          expires_at=excluded.expires_at
        RETURNING count
      `).bind(scope, windowStart, rule.windowSeconds, nowMs + RETENTION_MS, nowMs).first<{ count: number }>();
      if (!row || !Number.isSafeInteger(row.count) || row.count <= 0) return unavailable();
      const allowed = row.count <= rule.limit;
      return { allowed, reason: allowed ? "ALLOWED" : "LIMIT", count: row.count, retryAfter: allowed ? 0 : retry(windowStart + rule.windowSeconds * 1000, nowMs) };
    } catch { return unavailable(); }
  }

  async reserveEmailSend(email: AbuseDigest, purpose: EmailPurpose, nowMs: number): Promise<EmailAdmission> {
    if (!validDigest(email) || !validTime(nowMs) || (purpose !== "verification" && purpose !== "recovery")) return unavailable();
    const windowStart = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
    const verification = purpose === "verification" ? 1 : 0;
    const recovery = purpose === "recovery" ? 1 : 0;
    // This expression is exclusively internal SQL, never assembled from a caller.
    const reset = "auth_email_send_admission.expires_at <= ? OR auth_email_send_admission.window_start < excluded.window_start";
    try {
      // Candidate nonce is issued/persisted as a reservation ONLY by the winning
      // atomic mutation; losers neither receive an ID nor replace the winner.
      const reservationId = crypto.randomUUID();
      const row = await this.db.prepare(`
        INSERT INTO auth_email_send_admission
          (email_digest,window_start,total_count,verification_count,recovery_count,cooldown_until,reservation_id,expires_at)
        VALUES (?,?,1,?,?,?,?,?)
        ON CONFLICT(email_digest) DO UPDATE SET
          total_count=CASE WHEN ${reset} THEN 1 ELSE auth_email_send_admission.total_count+1 END,
          verification_count=CASE WHEN ${reset} THEN excluded.verification_count ELSE auth_email_send_admission.verification_count+excluded.verification_count END,
          recovery_count=CASE WHEN ${reset} THEN excluded.recovery_count ELSE auth_email_send_admission.recovery_count+excluded.recovery_count END,
          window_start=excluded.window_start,
          cooldown_until=excluded.cooldown_until,
          reservation_id=excluded.reservation_id,
          expires_at=excluded.expires_at
        WHERE (auth_email_send_admission.expires_at <= ? OR auth_email_send_admission.cooldown_until <= ?)
          AND (auth_email_send_admission.expires_at <= ? OR auth_email_send_admission.window_start < excluded.window_start
            OR (auth_email_send_admission.window_start = excluded.window_start
              AND auth_email_send_admission.total_count < ?
              AND ((excluded.verification_count=1 AND auth_email_send_admission.verification_count < ?)
                OR (excluded.recovery_count=1 AND auth_email_send_admission.recovery_count < ?))))
        RETURNING reservation_id
      `).bind(email, windowStart, verification, recovery, nowMs + COOLDOWN_MS, reservationId, nowMs + RETENTION_MS,
        nowMs, nowMs, nowMs, nowMs, nowMs, nowMs, TOTAL_CAP, PURPOSE_CAP, PURPOSE_CAP).first<{ reservation_id: string }>();
      if (row) return row.reservation_id === reservationId ? { allowed: true, reason: "ALLOWED", reservationId, retryAfter: 0 } : unavailable();

      // Denial-only observation for retry metadata. It can NEVER grant permission;
      // another isolate's later mutation can only make this hint conservative.
      const state = await this.db.prepare(`SELECT window_start,total_count,verification_count,recovery_count,cooldown_until,expires_at
        FROM auth_email_send_admission WHERE email_digest=?`).bind(email).first<EmailState>();
      if (!state || state.expires_at <= nowMs) return unavailable();
      if (state.cooldown_until > nowMs) return { allowed: false, reason: "COOLDOWN", retryAfter: retry(state.cooldown_until, nowMs) };
      if (state.total_count >= TOTAL_CAP) return { allowed: false, reason: "COMBINED_LIMIT", retryAfter: retry(state.window_start + HOUR_MS, nowMs) };
      if ((purpose === "verification" ? state.verification_count : state.recovery_count) >= PURPOSE_CAP) {
        return { allowed: false, reason: "PURPOSE_LIMIT", retryAfter: retry(state.window_start + HOUR_MS, nowMs) };
      }
      return unavailable();
    } catch { return unavailable(); }
  }

  /** Later callers may schedule this through waitUntil; no cron or live wiring here. */
  async pruneExpired(nowMs: number): Promise<{ ran: boolean; ok: boolean; deleted: number }> {
    if (!validTime(nowMs)) return { ran: false, ok: false, deleted: 0 };
    if (nowMs < nextPruneAt) return { ran: false, ok: true, deleted: 0 };
    nextPruneAt = nowMs + 60_000; // Before the first await: concurrent instances share the guard.
    let deleted = 0;
    try {
      const attempt = await this.db.prepare(`DELETE FROM auth_attempt_windows
        WHERE (scope_digest,window_start,window_seconds) IN
          (SELECT scope_digest,window_start,window_seconds FROM auth_attempt_windows WHERE expires_at <= ? ORDER BY expires_at LIMIT 500)
      `).bind(nowMs).run();
      if (!attempt.success || !Number.isSafeInteger(attempt.meta.changes) || attempt.meta.changes < 0 || attempt.meta.changes > 500) throw new Error();
      deleted = attempt.meta.changes;
      if (deleted < 500) {
        const email = await this.db.prepare(`DELETE FROM auth_email_send_admission WHERE email_digest IN
          (SELECT email_digest FROM auth_email_send_admission WHERE expires_at <= ? ORDER BY expires_at LIMIT ?)
        `).bind(nowMs, 500 - deleted).run();
        if (!email.success || !Number.isSafeInteger(email.meta.changes) || email.meta.changes < 0 || email.meta.changes > 500 - deleted) throw new Error();
        deleted += email.meta.changes;
      }
      return { ran: true, ok: true, deleted };
    } catch { return { ran: true, ok: false, deleted }; }
  }
}
