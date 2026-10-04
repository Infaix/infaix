# Security policy — INFAIX Core candidate

This describes the code in this candidate. It is not a penetration test, a
certification, a production approval, or a claim that public registration is
safe to open.

## Scope

Static Next.js export served by a Cloudflare Worker, plus the same-origin
account API in `worker/` (D1 and Web Crypto).

## Registration and legal acknowledgement

Public signup creates a base identity only: role `USER`, status
`PENDING_VERIFICATION`, `email_verified` 0, `ai_access` 0, and no product
grant. Client `role`, `ai_access`, newsletter flags, and legal `source` are
ignored. An operator invite, when present, is the only way a non-default role
is applied, and that role comes from the stored invitation.

The current Terms and Privacy versions are server constants. A missing, false,
or stale acknowledgement is rejected and creates nothing. The user row, the
`legal_acceptances` row, and the first verification token are inserted in one
D1 batch. A failed statement rolls the batch back. There is no create-then-delete
compensation.

Newsletter consent is a separate request. Accepting Terms does not subscribe
anyone.

Migration `0005_legal_acceptance.sql` must be applied before this registration
path is enabled. It has not been applied by this candidate.

## Public-signup kill switch

`publicSignupDecision` runs before registration does any storage or mail. In
production the request proceeds only when `PUBLIC_SIGNUP_ENABLED` is exactly
`"true"`. Missing, false, or malformed values return `403 SIGNUP_DISABLED`.
The client body cannot override the binding. `wrangler.jsonc` does not set the
variable, so this production configuration leaves public registration closed.

Development and test environments stay open so local work and the suite are
not coupled to that secret.

Opening the switch is not bot protection. The Worker does not verify a
Turnstile token. `TURNSTILE_SECRET_KEY` is parsed by `authSecurityConfig` and
is not consulted by any handler.

## Request bodies

Auth JSON is fully buffered and rejected above 32,768 characters before it is
parsed. That is a character cap, not a streaming byte limit.

## Abuse controls that are actually enforced

Live limits use `checkRateLimit` and `rate_limit_hits`. The window is fixed.
Defaults below apply unless an `RL_*` environment variable overrides them.
The limiter key for anonymous routes is `CF-Connecting-IP` as read by
`apiContext`. On a request that reaches this Worker through Cloudflare, that
header is set by the edge. The live path does not also require the `cf`
metadata object, and it does not read `X-Forwarded-For`. A missing header
shares the scope `unknown`. Storage errors are not caught inside
`checkRateLimit`, so the request fails instead of being admitted. There is no
scheduled prune of `rate_limit_hits`. Email scopes store the raw normalized
email in the counter key.

| Route | Status | Key | Default | Storage | On storage failure |
|---|---|---|---|---|---|
| `POST /api/auth/register` | Application enforced | `register:<ip>` | 10 / 3600s | `rate_limit_hits` | Request fails |
| `POST /api/auth/login` | Application enforced | `login:ip:<ip>` and `login:email:<email>` | 10 / 600s, email limit is twice the IP limit | `rate_limit_hits` | Request fails |
| `POST /api/auth/request-verification` | Application enforced | `verify-send:<ip>` and `verify-send:email:<email>` | 10 / 3600s and 5 / 3600s | `rate_limit_hits` | Request fails |
| `POST /api/auth/verify-email` | Application enforced | `verify-use:<ip>` | 10 / 3600s | `rate_limit_hits` | Request fails |
| `POST /api/auth/request-password-reset` | Application enforced | `reset:<ip>` and `reset:email:<email>` | 5 / 3600s each | `rate_limit_hits` | Request fails |
| `POST /api/auth/reset-password` | Application enforced | `reset-use:<ip>` | 5 / 3600s | `rate_limit_hits` | Request fails |
| `POST /api/newsletter/subscribe` | Application enforced | `newsletter:<ip>` and `newsletter:email:<email>` | 10 / 3600s and 5 / 3600s | `rate_limit_hits` | Request fails |
| `POST /api/newsletter/withdraw` | Application enforced | `newsletter-withdraw:<user id>` | 10 / 3600s | `rate_limit_hits` | Request fails |
| `POST /api/auth/change-password` | Application enforced | `change-pw:<user id>` | 10 / 600s | `rate_limit_hits` | Request fails |
| Admin invite and user routes | Application enforced | `admin-invite:<ip>` or `admin-users:<ip>` | 30 / 3600s | `rate_limit_hits` | Request fails |
| Core → Chat/Study handoff | Not implemented | — | — | — | No application limiter |

These counters are not a DDoS control. Shared NATs share a budget. Cloudflare
edge configuration, if any, is outside this repository.

## Hashed abuse store (present, not on the request path)

`worker/auth/abuse.ts` and `worker/auth/security-store.ts` came from a
concurrent workstream and were reviewed before this candidate included them.
No handler, router, or handoff calls them.

`abuseDigest` is HMAC-SHA256 over `purpose`, a NUL, and the signal. Email
purposes use `normalizeEmail` first, so case and surrounding whitespace do not
create a second key. The secret is `AUTH_ABUSE_HASH_SECRET` only. It must be
32–4096 bytes with no surrounding whitespace. A missing or malformed secret
throws `AuthSecurityUnavailable`. The digest does not contain the raw signal.

`networkSignal` returns a canonical IP only when the caller passes an injected
signal, or when the request has Cloudflare `cf` metadata and
`CF-Connecting-IP` parses as one IPv4 or IPv6 address. `X-Forwarded-For` is
ignored. Invalid or missing values share the label `shared-untrusted`. This
function is not what `apiContext` uses today.

`D1SecurityStore.hitAttempt` upserts `auth_attempt_windows` in one statement.
`reserveEmailSend` upserts `auth_email_send_admission` in one statement
(60-second cooldown, 5 combined sends per hour, 3 per purpose). A lost race
does not receive the winner's reservation id. Any thrown storage error,
including a missing table, returns `allowed: false` with reason `UNAVAILABLE`.
That is fail closed for a caller that used the store. Because no route uses
it, a missing migration `0006` does not change live registration, login, or
mail behavior.

Rows store a 64-character hex digest, window start, counts, and expiry
timestamps. They do not store a raw IP, raw email, account id, user agent, or
device id. `expires_at` is set 48 hours ahead. `pruneExpired` can delete
expired rows, and nothing schedules it. Do not treat 48 hours as an enforced
retention period.

`0006` is additive. It also adds a nullable `continuation` column on
`email_verifications`. No handler reads or writes that column. Do not apply
`0006` until a later change actually calls this store.

## Enumeration and mail

Password-reset request and verification resend return `{ ok: true }` for an
unknown address, a known address whose mail is sent, and a known address whose
provider throws. Provider failures are logged by error name only. Authenticated
password change and reset still return `passwordChanged` and
`notificationDelivered` separately, and the UI claims a security email only
when delivery succeeded.

Registration still returns `409 ACCOUNT_EXISTS` for a duplicate email.

## Verification and recovery

Verification tokens are 24 hours, reset tokens are 1 hour, both stored as
SHA-256, single-use via a conditional claim. The verify page suppresses a
second client submission of the same token. The server remains authoritative
for used, expired, and invalid tokens.

## Sessions

Opaque token, hash at rest, `HttpOnly`. Production cookies are `Secure`,
`SameSite=None`, `Domain=.infaix.com`. A new login mints a new session.

## Product handoff

`/api/auth/chat` and `/api/auth/study` validate the callback with
`validateHandoffContinuation` before a session is read and before an assertion
is attached. The callback must be an exact configured `https` origin plus the
product callback path. Protocol-relative URLs, `javascript:` and `data:` URLs,
userinfo, fragments, unexpected ports, encoded path tricks, and duplicate
routing parameters are rejected. Production reads `CHAT_ORIGIN` and
`CHAT_PRODUCTION_EXTRA_ORIGINS` only. `CHAT_EXTRA_ORIGINS` is ignored when
`ENVIRONMENT` is `production`, so a development `*.workers.dev` origin in that
variable is not a production assertion recipient. Study uses the same split.
The committed `wrangler.jsonc` sets `CHAT_ORIGIN` to `https://chat.infaix.com`
and sets no extra origin. The assertion audience is `infaix-chat`. Handoff
does not grant Chat access by itself; the product still redeems the assertion.

## Security headers

The Worker sets these when the response does not already have them:

- `Content-Security-Policy`: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'`
- `Strict-Transport-Security`: `max-age=31536000; includeSubDomains` only when `ENVIRONMENT` is `production`
- `X-Content-Type-Options`: `nosniff`
- `Referrer-Policy`: `no-referrer`
- `Permissions-Policy`: accelerometer, camera, geolocation, gyroscope, magnetometer, microphone, payment, and usb are denied

`script-src` allows `'unsafe-inline'` because the static export's RSC
bootstrap is inline and this Worker does not attach a per-response nonce.
Nothing here is a claim that the headers are active in production until this
candidate is deployed.

## Known prerequisites

- Apply `0005` before enabling the registration path that writes `legal_acceptances`.
- Do not apply `0006` for its own sake. Nothing reads it.
- Do not set `PUBLIC_SIGNUP_ENABLED=true` until a real bot check exists. Turnstile is not implemented.
- Handoff has no application rate limit.
- Live rate-limit and audit rows still contain raw network addresses, and mail-scope counters contain raw emails.
