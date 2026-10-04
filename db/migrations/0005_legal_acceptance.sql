-- INFAIX legal acknowledgement at registration.
-- Apply with: wrangler d1 execute infaix-db --file=db/migrations/0005_legal_acceptance.sql
-- Additive. Does not alter users or newsletter_subscriptions.
--
-- Rollback: leave the table in place on revert (unread by older code).
-- Dev-only removal: DROP TABLE legal_acceptances;

-- One row per acknowledgement. Registration writes this only after the
-- server has checked the current Terms and Privacy versions. No IP, no
-- user agent, no newsletter state.
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  source TEXT NOT NULL,                 -- registration
  accepted_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user ON legal_acceptances(user_id, accepted_at);
