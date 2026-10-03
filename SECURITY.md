# Security policy — INFAIX website & account system

## Scope

The public INFAIX site (static Next.js export on Cloudflare Workers Static
Assets) plus the same-origin account API in `worker/` (D1 + Web Crypto).

## What is protected, and how

This is a transitional local baseline, not approval for public release. The
approved signup/abuse-hardening plan has not been implemented or deployed.

| Area | Control |
|---|---|
| Passwords | PBKDF2-SHA256, unique salts, server-side only, never logged/returned |
| Sessions | Opaque tokens (hash at rest), `HttpOnly`, production `Secure; SameSite=None; Domain=.infaix.com`, dev host-only `SameSite=Lax`, fresh mint per login, 30-day sliding expiry |
| Registration | Public signup with least-privilege defaults (USER, PENDING_VERIFICATION, ai_access=0); privilege never from client input; optional operator-invite path with single-use atomic claim, expiry, revocation, email lock |
| Login | Generic invalid-credential errors, dummy hash work for unknown emails, IP + per-email rate limits, status checks; uniform timing is not guaranteed |
| Reset/verify | Single-use hashed expiring tokens (reset 1h, verify 24h), neutral responses, per-IP + per-address rate limits, sibling-token invalidation on use |
| Admin | Session role checks (`OWNER`/`ADMIN`) or one-time bootstrap token; destructive actions need sessions |
| CSRF | Origin/`Referer` allowlist check on state-changing API calls + `SameSite=Lax` (dev) / cross-subdomain `SameSite=None; Secure` with allowlist CORS in production |
| Injection | Bound parameters and input validators; auth JSON is fully buffered before a 32,768-character check, not a bounded byte-stream parser |
| XSS | React escaping; no `dangerouslySetInnerHTML` in auth UI; JSON-only API |
| Headers | `X-Content-Type-Options: nosniff` on Worker responses; no blanket CSP (would risk inline Next.js runtime) |
| Audit | Login/account/password/invitation events; log payloads must exclude secrets, but free-form error logging still needs hardening |

## Threat review (summary)

- **Auth bypass**: sessions verified by signature + DB row + expiry + live
  `ACTIVE` status on every request. No client-provided identity is trusted
  (tested: profile edits resolve identity from the session; registration
  ignores client privilege fields).
- **IDOR / privilege escalation**: no by-ID user endpoints except admin-gated
  ones; `ADMIN` cannot affect `OWNER`/other admins or self; invite roles
  cannot be escalated by non-owners (tested).
- **Session fixation**: fresh token minted at login; presented tokens ignored.
- **Brute force**: D1 fixed-window limits on login/register/reset/verify/admin
  with `429` + `Retry-After` (tested).
- **Enumeration**: reset/resend normally return the same success body for
  known and unknown emails, subject to rate-limit/provider errors. Work and
  timing differ because known accounts may mutate tokens and send mail.
  Public signup exposes duplicates through `409 ACCOUNT_EXISTS`; the approved
  generic `202` signup contract is not implemented.
- **Token replay**: all single-use tokens claimed with conditional
  `UPDATE … WHERE status='PENDING'` (atomic under concurrency); sibling
  pending tokens expire on successful use and on re-request (tested).
- **Secret leakage**: responses expose only `PublicUser`; invite list strips
  token hashes; raw invite token returned once at creation (tested). No
  secrets committed (`.env*`/`.dev.vars` gitignored; history scanned).
- **Redirects**: login accepts validated relative paths; product handoffs
  validate the callback origin only. Exact callback-path/query validation and
  persisted signup continuation are not implemented.
- **Unsafe reset**: 1-hour expiry, single-use, kills all sessions on success.

## Known limitations (not claimed secure against)

- No `PUBLIC_SIGNUP_ENABLED` kill switch, Managed Turnstile validation,
  login challenge step-up, hashed email abuse scopes, combined mail admission,
  or bounded auth-body parsing yet.
- User insertion, invite claim and verification-token creation are separate
  operations. Individual claims are conditional/atomic; the whole signup is
  not transactional. Invite role validation still trusts the stored role.
- Token claims, account updates and sibling invalidation are also separate
  operations. No transaction-wide atomicity is claimed.
- D1 counters increment and then read in separate queries; scopes include raw
  emails. Mail delivery has no bounded timeout or idempotency key yet.

- No 2FA / WebAuthn yet; sessions are bearer tokens — XSS in any page would
  be game over (standard mitigation: keep dependencies patched, no inline
  scripts in auth UI).
- Production email delivery needs a provider before reset/verify work live.
- `wrangler dev` serves D1 locally; review D1 access controls in Cloudflare.
- PBKDF2 cost assumes Workers CPU headroom (paid plan); verify under load.
- Rate limits include per-IP and selected per-email scopes: shared NATs share budgets; authenticated-user
  scopes can be added if abuse appears.

## Reporting

Security issues: contact the INFAIX operator directly. Do not open public
issues with exploit details.
