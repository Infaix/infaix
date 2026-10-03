# Core data & privacy inventory (Phase 1 — for the legal/privacy phase)

Source of truth: this repository only. Nothing below is inferred from
production systems. Where behavior is unknown, it says so.

## 1. Account information (`users`)

Stored per account: `id` (`usr_<24hex>`), `email` (lowercase, unique),
`password_hash` (PBKDF2-SHA256 string, salted — never plaintext),
`display_name`, `role` (`OWNER|ADMIN|USER`), `status`
(`ACTIVE|DISABLED|PENDING_VERIFICATION`), `email_verified` (0/1),
`ai_access` (0/1, default deny), `created_at`, `updated_at`,
`last_login_at` (nullable). No other profile fields exist.

## 2. Sessions (`sessions`)

Per login: `id` = SHA-256 of the opaque token (raw token only in the
`HttpOnly` cookie, never stored), `user_id`, `created_at`, `expires_at`
(30-day sliding), `last_seen_at`, `ip` (`cf-connecting-ip` at mint), truncated
`user_agent` (200 chars). Revoked on logout / password change (others) /
password reset (all) / account disable (all + immediate access cut).

Cookie: `infaix_session=<token>.<hmac>`; production
`Domain=.infaix.com; SameSite=None; Secure; HttpOnly`; dev/test host-only
`SameSite=Lax`. See `worker/auth/sessions.ts`.

## 3. IP / network metadata

- Sessions store mint-time IP + UA (above).
- `audit_log` rows store the request IP (`ip` column) per event (below).
- Worker access logging (`worker/index.ts` → `telemetry.ts`) emits per API
  request: route label (bounded enum, no IDs/query), method, status,
  latency, auth result for logins only. No headers, bodies, cookies, or query
  strings. Cloudflare edge/network logs are outside this repo — unknown here.

## 4. Audit / security events (`audit_log`)

`event, actor_user_id, target_user_id, ip, detail (≤200 chars), created_at`.
Events: `LOGIN_SUCCESS/FAILURE, LOGOUT, ACCOUNT_CREATED, ACCOUNT_DISABLED/
ENABLED, PROFILE_UPDATED, PASSWORD_CHANGED, PASSWORD_RESET_REQUESTED/
COMPLETED, EMAIL_VERIFIED, EMAIL_VERIFICATION_SENT, INVITATION_CREATED/USED/
REVOKED, AI_ACCESS_ENABLED/DISABLED/DENIED, AI_AUTH_FAILURE, AI_REQUEST,
AI_GATEWAY_FAILURE`. Never stored: passwords, hashes, raw tokens, session
tokens (enforced by convention + tests).

## 5. Single-use tokens (`invitations`, `password_resets`, `email_verifications`)

Only SHA-256 hashes stored. Raw values exist transiently in mail bodies (and
dev-only `email_outbox`). Lifetimes: invites configurable (default 72 h),
resets 1 h, verifications 24 h. Consumed/expired rows are status-flagged,
not deleted.

## 6. Cookies

Only `infaix_session` (functional, auth). No analytics/marketing cookies in
this repo. Static pages set none.

## 7. AI entitlement data

`users.ai_access` flag + `canUseInfaixAI()` rule (OWNER bypass; ACTIVE +
flag required otherwise). AI chat content: `conversations`/`messages`
(`user_id`-scoped, server-resolved). Gateway assertions are short-lived JWTs
minted per request; no AI data persists outside D1 tables above.

## 8. App access data

No per-user product entitlement rows exist yet for end users. Discovery-only
`src/lib/app-registry.ts` (public listing; `url: null` + `canLaunch()=false`
for unavailable products). New: `product_grants` table (migration 0004,
currently unwritten by any endpoint) reserved for future beta/product access.

## 9. Logs

Application: structured JSON to stdout (Worker logs): request metadata
(telemetry), auth phase diagnostics (`request_id`, phase, elapsed — no PII),
error cases still include free-form exception messages and some stacks. No
guarantee that arbitrary upstream exception text excludes PII/secrets is made;
closed-reason-code logging remains planned. No log retention is configured in-repo
(Cloudflare log retention applies — unknown here, confirm in dashboard).

## 10. Third-party processors / services visible from the repo

| Service | Evidence | Data shared |
|---|---|---|
| Cloudflare (Workers, D1, Static Assets) | `wrangler.jsonc`, `worker/` | All of the above (hosting + DB) |
| Resend (transactional email) | `worker/auth/mailer.ts`, `EMAIL_PROVIDER=resend`, `EMAIL_FROM=noreply@infaix.com` | Recipient address + verification/reset link, only when configured |
| AI gateway (separate InfaixAI backend) | `AI_GATEWAY_URL`, `worker/auth/ai.ts` | Short-lived signed assertion + user chat content per proxied request |
| Chat / Study products (handoff) | `/api/auth/chat`, `/api/auth/study` | Signed identity assertion (`iss/aud/sub/iat/exp/jti` — no profile data) on user-initiated handoff |

No analytics, ads, fonts, captchas, or other third parties are referenced.

## 11. Retention behavior (verifiable)

- No automated deletion/TTL exists for `users`, `audit_log`,
  `email_verifications`, `password_resets`, `invitations`,
  `newsletter_subscriptions` (unsubscribe retains the row), `conversations/
  messages`. Only `sessions` (expiry prune point exists but no scheduled
  cron wires it) and `rate_limit_hits` (prunable; no schedule in-repo).
- **No retention periods are promised anywhere in code.** Legal phase must
  define: account deletion, audit-log retention, token-row cleanup,
  newsletter erasure, conversation retention, log retention.
