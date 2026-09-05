-- INFAIX account system — initial schema (D1 / SQLite).
-- Apply with: wrangler d1 execute infaix-db --file=db/migrations/0001_init.sql
-- All timestamps are milliseconds since Unix epoch (INTEGER).
-- Raw tokens are NEVER stored; only SHA-256 hashes of tokens.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- e.g. usr_<24 hex>
  email TEXT NOT NULL UNIQUE,             -- stored lowercase
  password_hash TEXT NOT NULL,            -- pbkdf2-sha256$iter$salt$hash
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER',      -- OWNER | ADMIN | USER (Phase 2 RBAC)
  status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION', -- ACTIVE | DISABLED | PENDING_VERIFICATION
  email_verified INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,                    -- inv_<24 hex>
  token_hash TEXT NOT NULL UNIQUE,        -- SHA-256 of the single-use token
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | USED | EXPIRED | REVOKED
  intended_email TEXT,                    -- optional lock to one address (lowercase)
  role TEXT NOT NULL DEFAULT 'USER',      -- role granted on acceptance
  inviter_user_id TEXT,                   -- NULL for bootstrap invites
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  used_by_user_id TEXT,
  revoked_at INTEGER,
  note TEXT,
  FOREIGN KEY (inviter_user_id) REFERENCES users(id),
  FOREIGN KEY (used_by_user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,                    -- SHA-256 of the opaque session token
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,                    -- rst_<24 hex>
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | USED | EXPIRED
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_resets_token ON password_resets(token_hash);
CREATE INDEX IF NOT EXISTS idx_resets_user ON password_resets(user_id);

CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,                    -- evf_<24 hex>
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | USED | EXPIRED
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_verifications_token ON email_verifications(token_hash);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON email_verifications(user_id);

-- Security audit log. NEVER store passwords, raw tokens, or session tokens.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,                    -- LOGIN_SUCCESS, INVITATION_USED, ...
  actor_user_id TEXT,
  target_user_id TEXT,
  ip TEXT,
  detail TEXT,                            -- short non-sensitive context (no secrets)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_event ON audit_log(event);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at);

-- Sliding-window rate limit counters.
CREATE TABLE IF NOT EXISTS rate_limit_hits (
  scope TEXT NOT NULL,                    -- e.g. login:1.2.3.4 / register:1.2.3.4
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (scope, window_start)
);

-- Development-safe email outbox. Reset/verification links land here when no
-- production mail provider is configured. Raw tokens are stored ONLY here
-- (dev aid, never logged) so testers can complete flows without email.
CREATE TABLE IF NOT EXISTS email_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                     -- password_reset | email_verification
  to_email TEXT NOT NULL,
  link_token TEXT NOT NULL,               -- raw single-use token (dev only)
  created_at INTEGER NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_outbox_email ON email_outbox(to_email);
