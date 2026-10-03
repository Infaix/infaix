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
| `invitations` | Optional operator-seeding signup path: token hash (unique), status, email lock, role grant, inviter, expiry/use/revoke timestamps. Preserved for future product-grant redemption |
| `newsletter_subscriptions` | Opt-in newsletter consent (0004; never auto-created by registration) |
| `product_grants` | Future product/beta access grants per user (0004; no writer yet) |
| `sessions` | Session id = SHA-256(token); user FK; expiry; last seen; IP/UA |
| `password_resets` | Single-use hashed 1-hour tokens |
| `email_verifications` | Single-use hashed 24-hour tokens |
| `audit_log` | Security events (no secrets, ever) |
| `rate_limit_hits` | Fixed-window counters; existing email scopes contain raw addresses |
| `email_outbox` | Dev/test delivery only: `password_reset`, `email_verification`, `account_welcome`, `password_changed`. Production never writes here |

Raw single-use tokens are never stored — only their SHA-256 hashes — except
inside `email_outbox` rows, which exist solely so developers can complete
flows without an email provider. Do not query that table in production code
paths outside the mailer.

Migration 0004 adds newsletter and product-grant tables. Newsletter endpoints
and account preferences require these tables before any future deployment.
Study handoff needs no new schema. This document does not establish the remote
migration state or authorize applying migrations. `IF NOT EXISTS` does not
validate the shape of a pre-existing table.
