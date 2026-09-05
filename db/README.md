# INFAIX account database (Cloudflare D1)

## Setup (once)

```bash
wrangler d1 create infaix-db
# paste database_id into wrangler.jsonc
wrangler d1 execute infaix-db --file=db/migrations/0001_init.sql
```

For local full-stack dev, `wrangler dev` provisions a local D1 automatically;
apply the migration to it with:

```bash
wrangler d1 execute infaix-db --local --file=db/migrations/0001_init.sql
```

## Tables

| Table | Purpose |
|---|---|
| `users` | id, email (unique, lowercase), password_hash, display_name, role, status, email_verified, timestamps, last_login_at |
| `invitations` | Invite-only signup: token hash (unique), status, email lock, role grant, inviter, expiry/use/revoke timestamps |
| `sessions` | Session id = SHA-256(token); user FK; expiry; last seen; IP/UA |
| `password_resets` | Single-use hashed 1-hour tokens |
| `email_verifications` | Single-use hashed 24-hour tokens |
| `audit_log` | Security events (no secrets, ever) |
| `rate_limit_hits` | Sliding-window counters |
| `email_outbox` | Dev-only reset/verification links (no production mailer yet) |

Raw single-use tokens are never stored — only their SHA-256 hashes — except
inside `email_outbox` rows, which exist solely so developers can complete
flows without an email provider. Do not query that table in production code
paths outside the mailer.
