# INFAIX account system

Invite-only identity for `infaix.com` (and later `ai.infaix.com` and future
INFAIX services). The static Next.js frontend renders the auth pages; **all
authentication runs server-side in the Cloudflare Worker** (`worker/`) backed
by D1. Passwords are hashed with PBKDF2-SHA256 (Web Crypto, zero new
dependencies). Sessions are opaque tokens in `HttpOnly` + `Secure` +
`SameSite=Lax` cookies.

## Architecture

```
Browser (/login, /register, /account, … — static export)
  → same-origin /api/auth/*, /api/admin/* (Cloudflare Worker)
    → D1 (users, invitations, sessions, resets, verifications, audit)
```

Key files:

| Path | Purpose |
|---|---|
| `worker/index.ts` | Worker entry: static hosting + `/api` router + cache/security headers |
| `worker/auth/handlers.ts` | Endpoint logic (pure functions, fully tested) |
| `worker/auth/router.ts` | `/api` route table (importable in tests) |
| `worker/auth/guard.ts` | `requireAuthentication()` / `requireRole()` for future endpoints |
| `worker/auth/crypto.ts` | PBKDF2, random tokens, SHA-256, HMAC (Web Crypto only) |
| `worker/auth/store.ts` | `Store` interface + `D1Store` (all SQL lives here) |
| `worker/auth/memory.ts` | In-memory `Store` for tests |
| `worker/auth/sessions.ts` | Session mint/verify, signed cookies |
| `worker/auth/ratelimit.ts` | D1-backed sliding-window limits |
| `worker/auth/audit.ts` | Security audit events |
| `worker/auth/mailer.ts` | Email abstraction (outbox in dev, null in prod) |
| `db/migrations/0001_init.sql` | D1 schema |
| `scripts/new-invite.mjs` | One-time invite generator (prints SQL + URL) |
| `src/app/login|register|account|forgot-password|reset-password|verify-email` | Static auth pages (INFAIX styling) |

## Invitation flow (invite-only; no public signup exists)

```
operator                     invitee
   │                            │
   │ node scripts/new-invite.mjs --email a@x --role USER
   │ wrangler d1 execute …      │
   │ ── registration URL (raw token, delivered once) ──▶
   │                            │  /register?token=… → email + display name + password
   │                            │  POST /api/auth/register (invite claimed atomically)
   │                            │◀─ 201 + verification link issued (24h, single-use)
   │                            │  /verify-email?token=… → status ACTIVE
   │                            │  /login → HttpOnly session cookie
```

Invitations: secure random 32-byte token (stored as SHA-256 only), single-use
atomic claim, configurable expiry (default 72h), revocation, optional email
lock, role grant. States: `PENDING | USED | EXPIRED | REVOKED`.

## Sessions

Opaque 32-byte tokens; only SHA-256 hashes stored. Cookie value is
`<token>.<hmac>` so tampering is detectable. Fresh token minted on every
login (fixation-safe). 30-day sliding expiry. Logout deletes the row and
clears the cookie. Password change/reset deletes other/all sessions.
**Every request re-checks `status = ACTIVE`** — disabling an account kills
access immediately. Disabled users cannot log in or use protected endpoints.

## Passwords

PBKDF2-SHA256, unique 16-byte salt, 210k iterations default
(`PBKDF2_ITERATIONS` tunable). Policy: 12–128 chars, 3 of 4 classes.
Server-side only; hashes never leave the database. Unknown-email logins run a
dummy verify so timing reveals nothing.

## Password reset / email verification

Single-use, hashed-at-rest, expiring tokens (reset 1h, verification 24h).
Request endpoints always return neutral `200` (no enumeration). Links are
emailed via the `Mailer` abstraction; without a provider, non-production
environments record them in the dev `email_outbox` table (test aid — see
`docs/auth.md`). Production without a provider sends nothing (documented gap
until a provider is wired in `worker/auth/mailer.ts`).

## Rate limiting / CSRF / headers

D1 sliding windows per IP (+ per-email for login), env-tunable, `429` +
`Retry-After`. State-changing POSTs require matching `Origin`/`Referer`
(CSRF) on top of `SameSite=Lax` cookies. Worker adds
`X-Content-Type-Options: nosniff`. No CORS (same-origin only).

## Roles (Phase-2 ready)

`users.role`: `OWNER | ADMIN | USER` (default `USER`). `requireRole()` in
`worker/auth/guard.ts` gates endpoints server-side. Admins manage invites and
disable/enable accounts (an `ADMIN` cannot touch non-`USER` accounts or
escalate invite roles; `OWNER` can). No role/permission is ever read from
client input.

## Owner AI access administration

AI entitlement (`users.ai_access`, default deny) is managed exclusively by
OWNER sessions — never the bootstrap token, never `ADMIN` sessions:

- UI: `/account/admin/ai-access` (owner-only; others see a denial, guests
  are sent to `/login`). OWNER rows display "Always on" with no toggle —
  the ownership bypass cannot be switched off.
- API: `GET /api/admin/users` (admin-safe projection, no hashes) and
  `POST /api/admin/users/:id/ai-access` with exactly `{ enabled: boolean }`
  (unknown fields rejected). Self-modification is rejected.
- Every mutation audits `AI_ACCESS_ENABLED` / `AI_ACCESS_DISABLED` with
  actor + target, and is covered by the admin rate limit.
- First OWNER: create via `scripts/new-invite.mjs --role OWNER`
  (bootstrap token is invite-scoped and cannot touch these endpoints).

## Audit log

`audit_log` records logins, logouts, account lifecycle, password events,
invitation events. Never: passwords, hashes, raw tokens, session tokens.

## Local development

```bash
npm install
npm run dev          # UI only (/api/* unavailable — pages show standby states)
npm run build && npx wrangler dev   # full stack: Worker API + static site + D1 (local)
npm test             # 49 vitest unit tests (no network)
```

D1 setup (once): `wrangler d1 create infaix-db`, paste the id into
`wrangler.jsonc`, `wrangler d1 execute infaix-db --file=db/migrations/0001_init.sql`,
`wrangler secret put SESSION_SECRET`, optionally `wrangler secret put ADMIN_BOOTSTRAP_TOKEN`.

## Remaining risks / Phase-2 notes

- Needs a real email provider for production reset/verification delivery.
- PBKDF2 210k needs Workers paid CPU headroom; tune `PBKDF2_ITERATIONS`.
- No WebAuthn/passkeys, no 2FA, no device sessions list UI yet.
- `ADMIN_BOOTSTRAP_TOKEN` must be rotated/removed after first admin exists.
- See `SECURITY.md` for the threat review and `docs/auth.md` for operations.
