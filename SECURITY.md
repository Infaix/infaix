# Security policy — INFAIX website & account system

## Scope

The public INFAIX site (static Next.js export on Cloudflare Workers Static
Assets) plus the same-origin account API in `worker/` (D1 + Web Crypto).

## What is protected, and how

| Area | Control |
|---|---|
| Passwords | PBKDF2-SHA256, unique salts, server-side only, never logged/returned |
| Sessions | Opaque tokens (hash at rest), `HttpOnly` + `Secure` + `SameSite=Lax`, fresh mint per login, 30-day sliding expiry |
| Registration | Invite-only; single-use atomic claim; expiry; revocation; email lock |
| Login | Generic errors (no enumeration), dummy-hash timing equalization, IP + per-email rate limits, status checks |
| Reset/verify | Single-use hashed expiring tokens, neutral responses, rate limits |
| Admin | Session role checks (`OWNER`/`ADMIN`) or one-time bootstrap token; destructive actions need sessions |
| CSRF | Same-origin `Origin`/`Referer` check + `SameSite=Lax` |
| Injection | All D1 access via bound parameters (`worker/auth/store.ts` only); strict input validators |
| XSS | React escaping; no `dangerouslySetInnerHTML` in auth UI; JSON-only API |
| Headers | `X-Content-Type-Options: nosniff` on Worker responses; no blanket CSP (would risk inline Next.js runtime) |
| Audit | Login/account/password/invitation events; no secrets in logs |

## Threat review (summary)

- **Auth bypass**: sessions verified by signature + DB row + expiry + live
  `ACTIVE` status on every request. No client-provided identity is trusted
  (tested: profile edits resolve identity from the session).
- **IDOR / privilege escalation**: no by-ID user endpoints except admin-gated
  ones; `ADMIN` cannot affect `OWNER`/other admins or self; invite roles
  cannot be escalated by non-owners (tested).
- **Session fixation**: fresh token minted at login; presented tokens ignored.
- **Brute force**: D1 sliding-window limits on login/register/reset/verify/admin
  with `429` + `Retry-After` (tested).
- **Enumeration**: identical responses/timing for unknown emails on login,
  reset request, and verification resend (tested).
- **Token replay**: all single-use tokens claimed with conditional
  `UPDATE … WHERE status='PENDING'` (atomic under concurrency) (tested).
- **Secret leakage**: responses expose only `PublicUser`; invite list strips
  token hashes; raw invite token returned once at creation (tested). No
  secrets committed (`.env*`/`.dev.vars` gitignored; history scanned).
- **Open redirect**: none — frontend uses fixed paths only.
- **Unsafe reset**: 1-hour expiry, single-use, kills all sessions on success.

## Known limitations (not claimed secure against)

- No 2FA / WebAuthn yet; sessions are bearer tokens — XSS in any page would
  be game over (standard mitigation: keep dependencies patched, no inline
  scripts in auth UI).
- Production email delivery needs a provider before reset/verify work live.
- `wrangler dev` serves D1 locally; review D1 access controls in Cloudflare.
- PBKDF2 cost assumes Workers CPU headroom (paid plan); verify under load.
- Rate limits are per-IP: shared NATs share budgets; authenticated-user
  scopes can be added if abuse appears.

## Reporting

Security issues: contact the INFAIX operator directly. Do not open public
issues with exploit details.
