-- AI access grant. Default deny: existing and new users get ai_access = 0
-- until explicitly granted. OWNER accounts bypass via application logic.
-- Apply with: wrangler d1 execute infaix-db --file=db/migrations/0002_ai_access.sql
ALTER TABLE users ADD COLUMN ai_access INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_ai_access ON users(ai_access);
