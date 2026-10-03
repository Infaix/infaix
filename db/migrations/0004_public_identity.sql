-- INFAIX Phase 1 (public identity & trust) — newsletter consent + product grants.
-- Apply with: wrangler d1 execute infaix-db --file=db/migrations/0004_public_identity.sql
-- Forward-only additive migration: no existing table is altered, no row is
-- touched. Safe to apply to a database at 0001..0003; re-running is a no-op.
--
-- Rollback: there is no destructive rollback (rows in the new tables would be
-- lost on DROP). If the release is reverted, leave the tables in place —
-- application code at earlier versions never reads them, so they are inert.
-- To fully remove (dev only, never production): DROP TABLE product_grants;
-- DROP TABLE newsletter_subscriptions;

-- Newsletter consent, strictly separate from accounts. Registration MUST NOT
-- create rows here; only an explicit subscribe action (Phase 2 endpoint) may
-- insert, and unsubscribe never deletes (audit trail of consent lifecycle).
CREATE TABLE IF NOT EXISTS newsletter_subscriptions (
  email TEXT PRIMARY KEY,               -- subscriber address (lowercase)
  status TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION', -- SUBSCRIBED | UNSUBSCRIBED | PENDING_CONFIRMATION
  consent_at INTEGER,                   -- when consent was last given
  consent_source TEXT,                  -- surface that captured consent, e.g. 'footer-form'
  policy_version TEXT,                  -- consent text / privacy-policy version shown
  confirmed_at INTEGER,                 -- double-opt-in confirmation time
  unsubscribed_at INTEGER,              -- set on unsubscribe; row retained
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscriptions(status);

-- Product/beta access grants. Identity (users) grants NO product access by
-- itself; future invite-to-product redemption mints rows here with
-- source_invitation_id set, instead of widening the user row.
CREATE TABLE IF NOT EXISTS product_grants (
  id TEXT PRIMARY KEY,                  -- e.g. pgr_<24 hex>
  user_id TEXT NOT NULL,
  product TEXT NOT NULL,                -- e.g. 'chat', 'study', 'ai', 'beta:<slug>'
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | REVOKED | EXPIRED
  source_invitation_id TEXT,            -- invitation this grant was redeemed from, if any
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_invitation_id) REFERENCES invitations(id)
);
CREATE INDEX IF NOT EXISTS idx_grants_user ON product_grants(user_id, status);
CREATE INDEX IF NOT EXISTS idx_grants_product ON product_grants(product, status);
