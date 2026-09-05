// Shared account-system types. Framework-free: used by the Cloudflare
// Worker at runtime and by vitest under node.

export type Role = "OWNER" | "ADMIN" | "USER";
export type AccountStatus = "ACTIVE" | "DISABLED" | "PENDING_VERIFICATION";
export type InviteStatus = "PENDING" | "USED" | "EXPIRED" | "REVOKED";
export type TokenStatus = "PENDING" | "USED" | "EXPIRED";

export interface Env {
  INFAIX_DB: D1Like;
  ASSETS?: {
    fetch(input: Request | URL | string, init?: RequestInit): Promise<Response>;
  };
  SESSION_SECRET?: string;
  ADMIN_BOOTSTRAP_TOKEN?: string;
  ENVIRONMENT?: string;
  APP_ORIGIN?: string;
  RL_LOGIN_LIMIT?: string;
  RL_LOGIN_WINDOW?: string;
  RL_REGISTER_LIMIT?: string;
  RL_REGISTER_WINDOW?: string;
  RL_RESET_LIMIT?: string;
  RL_RESET_WINDOW?: string;
  RL_VERIFY_LIMIT?: string;
  RL_VERIFY_WINDOW?: string;
  RL_ADMIN_LIMIT?: string;
  RL_ADMIN_WINDOW?: string;
  PBKDF2_ITERATIONS?: string;
  AI_GATEWAY_URL?: string;
  AI_GATEWAY_SECRET?: string;
  AI_GATEWAY_SECRET_PREVIOUS?: string;
  AI_GATEWAY_AUDIENCE?: string;
  AI_CHAT_USER_LIMIT?: string;
  AI_CHAT_USER_WINDOW?: string;
  AI_CHAT_IP_LIMIT?: string;
  AI_CHAT_IP_WINDOW?: string;
  AI_UPSTREAM_TIMEOUT_MS?: string;
  /** Parent-domain cookie scope in production (default ".infaix.com"). */
  COOKIE_DOMAIN?: string;
  /** Comma-separated extra allowed CORS origins (additive, https recommended). */
  CORS_EXTRA_ORIGINS?: string;
}

// Minimal structural subset of the Cloudflare D1 API we rely on, so the
// storage layer can be unit-tested without Cloudflare packages.
export interface D1Like {
  prepare(query: string): D1PreparedLike;
}
export interface D1PreparedLike {
  bind(...values: D1Value[]): D1PreparedLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}
export type D1Value = string | number | null | ArrayBuffer;

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
  status: AccountStatus;
  email_verified: number;
  ai_access: number; // 0 = denied (default), 1 = granted. OWNER bypasses via logic.
  created_at: number;
  updated_at: number;
  last_login_at: number | null;
}

export interface InvitationRow {
  id: string;
  token_hash: string;
  status: InviteStatus;
  intended_email: string | null;
  role: Role;
  inviter_user_id: string | null;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_by_user_id: string | null;
  revoked_at: number | null;
  note: string | null;
}

export interface SessionRow {
  id: string;
  user_id: string;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
  ip: string | null;
  user_agent: string | null;
}

export interface ResetRow {
  id: string;
  user_id: string;
  token_hash: string;
  status: TokenStatus;
  created_at: number;
  expires_at: number;
  used_at: number | null;
}

/** Same shape as password_resets. */
export type VerificationRow = ResetRow;

export interface AuditEvent {
  event: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  ip: string | null;
  detail: string | null;
  created_at: number;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface MessageRow {
  id: number;
  conversation_id: string;
  role: string;
  content: string;
  created_at: number;
}

/** Public user shape — the ONLY user data ever sent to clients. */
export interface PublicUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  status: AccountStatus;
  email_verified: boolean;
  ai_access: boolean;
  created_at: number;
  last_login_at: number | null;
}

export function toPublicUser(u: UserRow): PublicUser {
  return {
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    role: u.role,
    status: u.status,
    email_verified: u.email_verified === 1,
    ai_access: (u.ai_access ?? 0) === 1,
    created_at: u.created_at,
    last_login_at: u.last_login_at,
  };
}

export interface ApiError {
  error: { code: string; message: string };
}
