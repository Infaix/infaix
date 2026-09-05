-- Conversation persistence for INFAIX AI (main D1 — see docs/ai-architecture.md).
-- Ownership always derives from the server-side session's users.id; every
-- query below is scoped by user_id in application code. Messages are removed
-- automatically when their conversation is deleted.
-- Apply with: wrangler d1 execute infaix-db --file=db/migrations/0003_conversations.sql
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,                    -- e.g. convo_<24 hex>
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,                     -- system | user | assistant
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id);
