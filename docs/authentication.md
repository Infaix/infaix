# INFAIX authentication contract (for InfaixAI and other dependents)

The main INFAIX Worker (`infaix.com`) is the **single identity authority**.
There is exactly one user table, one session table, and one cookie. Nothing
here is duplicated in dependent services.

Related docs: `docs/auth.md` (account flows), `docs/ai-architecture.md`
(AI bridge + assertion contract), `SECURITY.md` (threat review).

## Cookie format

```text
infaix_session=<token>.<hmac-sha256-hex>
```

- `<token>`: 32 cryptographically random bytes, base64url (43 chars).
  The raw token is **never stored** — the database holds only its SHA-256.
- `<hmac-sha256-hex>`: HMAC-SHA-256 over the token with `SESSION_SECRET`
  (wrangler secret, ≥32 chars). Verified with WebCrypto `subtle.verify`
  (constant-time). Any failure — missing/foreign secret, malformed value,
  tampered signature, unknown hash, expired row, non-`ACTIVE` user — resolves
  to **unauthenticated** without revealing which step failed.

## Production cookie configuration

```text
Domain=.infaix.com; Path=/; HttpOnly; Secure; SameSite=None
```

- Shared by `https://infaix.com` and `https://ai.infaix.com`; the browser
  sends it automatically. Never exposed to JavaScript — no `localStorage`,
  `sessionStorage`, state, or URL copies anywhere in this repository.
- Non-production keeps host-only `SameSite=Lax` cookies (localhost cannot
  use a shared parent domain or `Secure`-over-HTTP).
- Logout deletes the session row **and** clears the cookie with a matching
  `Domain` (otherwise the browser would keep the real cookie).

## Session validation (`validateSession` equivalent)

`POST/GET` handlers call `verifySession()` (`worker/auth/sessions.ts`),
optionally via `requireAuthentication()` (`worker/auth/guard.ts`):

1. parse `infaix_session` from the `Cookie` header (fail closed),
2. timing-safe HMAC verification (fail closed),
3. `SHA-256(token)` → `sessions` lookup (fail closed),
4. `expires_at` check with lazy row deletion; 30-day sliding refresh,
5. live `users` lookup requiring `status = ACTIVE` (fail closed).

Revocation = row deletion (`logout` revokes one session; admin disable and
password change/reset revoke all). There is no `revoked_at` column by design
— deleted rows cannot authenticate.

## User identity

Canonical identity is `users.id` (`usr_<24 hex>`). No `ai_user_id` or sibling
identifiers exist or will be accepted. `GET /api/auth/me` (same-origin, or
cross-origin from the allowlist below with credentials) returns:

```json
{ "authenticated": true, "user": { "id": "...", "...": "public fields only" }, "ai": { "enabled": true } }
```

Unauthenticated callers receive `401 { error: { code: "UNAUTHENTICATED" } }`
— treat any 401 as `{ authenticated: false }`. Password hashes, session
tokens, and internals are never returned.

## AI entitlement (`canUseInfaixAI`)

`worker/auth/entitlement.ts` is the single server-authoritative check used by
`/api/ai/*` and documented for the InfaixAI `SessionValidator`:

```text
default = false
ACTIVE + (role = OWNER  OR  ai_access = 1)  →  true
anything else (missing, DISABLED, PENDING, grant = 0)  →  false
```

New accounts get `ai_access = 0` (migration `0002_ai_access.sql`; verified
against pre-existing rows). Grants are changed only via admin-authenticated
paths or direct D1 administration — never via public endpoints and never
from client input.

## CORS expectations

- Allowlist: `https://infaix.com`, `https://ai.infaix.com`
  (+ the Worker's own origin; localhost ports in non-production only;
  additive `CORS_EXTRA_ORIGINS`, https-only in production). No wildcard, no
  reflection; `Vary: Origin`.
- Credentialed cross-origin calls send `Origin: https://ai.infaix.com` and
  receive `Access-Control-Allow-Origin: https://ai.infaix.com` +
  `Access-Control-Allow-Credentials: true`.
- `OPTIONS /api/*` preflight → `204` (allowed) or `403` (denied).

## CSRF model (why `SameSite=None` is safe here)

`SameSite=None` means the browser will send the cookie on cross-site
requests, so CSRF rests on two deliberate layers:

1. **Origin gate**: every state-changing `/api/*` request (`POST/PUT/PATCH/
   DELETE`) must carry a present, allowlisted `Origin` (or `Referer`).
   Absent headers fail closed. `GET` endpoints are read-only.
2. **CORS**: even a successful cross-site request is unreadable to any
   origin outside the allowlist.

## Rate limiting, enumeration, logging

Login/register/reset/verify/AI endpoints share D1 sliding-window limits
(`429` + `Retry-After`); auth responses are enumeration-neutral (generic
errors, dummy-hash timing equalization on login). Audit (`audit_log`) holds
metadata only — never passwords, hashes, tokens, cookies, secrets, or
`Authorization` values.

## Session expiration summary

`created_at` / `expires_at` / `last_seen_at` on `sessions`; 30-day sliding
TTL refreshed on use; expiry deletes lazily and rejects. No permanent
sessions exist.

## Deployment dependencies (manual, Cloudflare-side)

- `wrangler d1 execute infaix-db --file=db/migrations/0002_ai_access.sql`
  (and `0003` for conversations) — safe, additive, existing rows default
  `ai_access = 0` (verified against a legacy-schema database).
- `wrangler secret put SESSION_SECRET` (≥32 chars) — production API returns
  `503` without it, by design.
- `ENVIRONMENT=production` in `wrangler.jsonc` vars (already set) to enable
  the cross-subdomain cookie scope. Optional `COOKIE_DOMAIN` override.
- No DNS/Tunnel/D1-data changes were made from this repository.
