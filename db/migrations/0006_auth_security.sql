-- Additive security primitives; timestamps are Unix milliseconds.
-- Apply only after 0001--0005, with separate owner approval. No sessions or credentials.
ALTER TABLE email_verifications ADD COLUMN continuation TEXT;

CREATE TABLE auth_attempt_windows (
  scope_digest TEXT NOT NULL CHECK(length(scope_digest) = 64 AND scope_digest NOT GLOB '*[^0-9a-f]*'),
  window_start INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL CHECK(window_seconds > 0),
  count INTEGER NOT NULL CHECK(count > 0),
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (scope_digest, window_start, window_seconds)
);
CREATE INDEX idx_auth_attempt_expiry ON auth_attempt_windows(expires_at);

CREATE TABLE auth_email_send_admission (
  email_digest TEXT PRIMARY KEY NOT NULL CHECK(length(email_digest) = 64 AND email_digest NOT GLOB '*[^0-9a-f]*'),
  window_start INTEGER NOT NULL,
  total_count INTEGER NOT NULL CHECK(total_count > 0),
  verification_count INTEGER NOT NULL CHECK(verification_count >= 0),
  recovery_count INTEGER NOT NULL CHECK(recovery_count >= 0),
  cooldown_until INTEGER NOT NULL,
  reservation_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  CHECK(total_count = verification_count + recovery_count)
);
CREATE INDEX idx_auth_email_admission_expiry ON auth_email_send_admission(expires_at);
