// Security audit logging. Records WHO did WHAT and WHEN — never secrets.
// Raw tokens, passwords, hashes, and session tokens must never reach this.
import type { Store } from "./store";

export const AUDIT_EVENTS = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "LOGOUT",
  "ACCOUNT_CREATED",
  "ACCOUNT_DISABLED",
  "PROFILE_UPDATED",
  "ACCOUNT_ENABLED",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "EMAIL_VERIFIED",
  "EMAIL_VERIFICATION_SENT",
  "INVITATION_CREATED",
  "INVITATION_USED",
  "INVITATION_REVOKED",
  "AI_ACCESS_ENABLED",
  "AI_ACCESS_DISABLED",
  "AI_ACCESS_DENIED",
  "AI_AUTH_FAILURE",
  "AI_REQUEST",
  "AI_GATEWAY_FAILURE",
] as const;

export type AuditEventName = (typeof AUDIT_EVENTS)[number];

export async function audit(
  store: Store,
  event: AuditEventName,
  opts: { actor?: string | null; target?: string | null; ip?: string | null; detail?: string | null; now: number }
): Promise<void> {
  await store.insertAudit({
    event,
    actor_user_id: opts.actor ?? null,
    target_user_id: opts.target ?? null,
    ip: opts.ip ?? null,
    detail: opts.detail ? opts.detail.slice(0, 200) : null,
    created_at: opts.now,
  });
}
